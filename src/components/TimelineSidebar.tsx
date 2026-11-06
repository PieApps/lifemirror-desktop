import { useState, useEffect, useMemo } from 'react';
import { X, Edit2, Check, MessageSquare, Trash2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { TimelineNode, getGroupedSessionTitle, formatCleanTitle } from './SCurveTimeline';
import AppIcon, { extractDomain } from './AppIcon';
import { ConfirmModal } from './ConfirmModal';
import { formatDurationFull, formatTime } from '../utils/formatDuration';

/**
 * Full-precision duration formatter (e.g. "3m 12s").
 * Named export preserved for backwards-compatibility with SCurveTimeline.tsx.
 */
export const getFormatDuration = formatDurationFull;

interface TimelineSidebarItem {
  id?: number;
  activityId?: number;
  timestamp: string;
  title: string;
  context: string;
  app: string;
  icon?: string;
  url?: string;
  source: string;
  duration: number;
  notes?: string;
  isActivity: boolean;
}

interface TimelineSidebarProps {
  node: TimelineNode | null;
  onClose: () => void;
  onDeleteLog?: (id: number) => void;
}

export default function TimelineSidebar({ node, onClose, onDeleteLog }: TimelineSidebarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void, onCancel: () => void}>({
    isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {}
  });

  useEffect(() => {
    if (node?.isMemoryNode && node.memoryData) {
      setSummaryText(node.memoryData.summary || "");
    }
    setIsEditing(false);
  }, [node]);

  // Escape key closes the panel
  useEffect(() => {
    if (!node) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [node]); // eslint-disable-line react-hooks/exhaustive-deps


  const handleSaveSummary = async () => {
    if (!node?.isMemoryNode || !node.memoryData?.id) return;
    try {
      await invoke("update_memory_node_summary", { id: node.memoryData.id, summary: summaryText });
      node.memoryData.summary = summaryText;
      setIsEditing(false);
    } catch (e) {
      console.error("Failed to update summary", e);
    }
  };

  // Memoize non-overlapping timeline breakdown items.
  // When an OS activity contains child sub-events (e.g. editor files or browser tabs),
  // the parent container is omitted and its duration is cleanly partitioned across its sub-events.
  // This guarantees that individual item durations sum 1:1 to the total session duration without duplicates.
  const timelineItems = useMemo<TimelineSidebarItem[]>(() => {
    if (!node) return [];

    const activities = node.originalActivities || [];
    const subEvents = node.subEvents || [];

    const matchedSubIds = new Set<number>();
    const items: TimelineSidebarItem[] = [];

    const sortedActivities = [...activities].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    const sortedSubEvents = [...subEvents].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (const act of sortedActivities) {
      const actStartMs = new Date(act.start_time).getTime();
      const actEndMs = actStartMs + act.duration * 1000;

      // Find sub-events that took place during this activity window (+/- 5s slack)
      const actSubs = sortedSubEvents.filter(s => {
        const t = new Date(s.timestamp).getTime();
        return t >= actStartMs - 5000 && t <= actEndMs + 5000;
      });

      if (actSubs.length === 0) {
        items.push({
          id: act.id,
          activityId: act.id,
          timestamp: act.start_time,
          title: formatCleanTitle(act.window_title, act.app_name, act.domain_tag, act.url),
          context: act.domain_tag || extractDomain(act.url) || act.app_name,
          app: act.app_name,
          icon: act.icon_url,
          url: act.url,
          source: act.source,
          duration: act.duration,
          notes: act.notes,
          isActivity: true,
        });
      } else {
        actSubs.forEach(s => { if (s.id != null) matchedSubIds.add(s.id); });

        let allocatedSeconds = 0;
        const count = actSubs.length;

        for (let i = 0; i < count; i++) {
          const sub = actSubs[i];
          const subStartMs = i === 0 
            ? actStartMs 
            : new Date(sub.timestamp).getTime();
          const subEndMs = i < count - 1 
            ? new Date(actSubs[i + 1].timestamp).getTime() 
            : actEndMs;

          let dur = Math.max(0, Math.round((subEndMs - subStartMs) / 1000));
          if (i === count - 1) {
            dur = Math.max(0, act.duration - allocatedSeconds);
          } else {
            dur = Math.min(dur, Math.max(0, act.duration - allocatedSeconds));
          }
          allocatedSeconds += dur;

          items.push({
            id: sub.id,
            activityId: act.id,
            timestamp: sub.timestamp,
            title: formatCleanTitle(sub.title, sub.parent_app_name || act.app_name || node.app_name, sub.context_tag, sub.primary_uri),
            context: sub.context_tag || extractDomain(sub.primary_uri) || sub.parent_app_name || act.app_name || node.app_name,
            app: sub.parent_app_name || act.app_name || node.app_name,
            icon: sub.icon_url || act.icon_url,
            url: sub.primary_uri,
            source: sub.session_type || 'Editor',
            duration: dur,
            notes: i === 0 ? act.notes : undefined,
            isActivity: false,
          });
        }
      }
    }

    // Handle any orphan sub-events not enclosed in an activity window
    const orphanSubs = sortedSubEvents.filter(s => s.id == null || !matchedSubIds.has(s.id));
    if (orphanSubs.length > 0) {
      let allocatedSeconds = 0;
      const totalAvailable = node.duration > 0 ? node.duration : orphanSubs.length * 60;
      for (let i = 0; i < orphanSubs.length; i++) {
        const sub = orphanSubs[i];
        const subStartMs = new Date(sub.timestamp).getTime();

        // Find the earliest subsequent event (next orphan sub, next activity start, or session end)
        const allNextTimes: number[] = [];
        if (i < orphanSubs.length - 1) {
          allNextTimes.push(new Date(orphanSubs[i + 1].timestamp).getTime());
        }
        for (const act of sortedActivities) {
          const aS = new Date(act.start_time).getTime();
          if (aS > subStartMs) allNextTimes.push(aS);
        }
        if (node.end_time) {
          allNextTimes.push(new Date(node.end_time).getTime());
        }

        const nextTimeMs = allNextTimes.length > 0 
          ? Math.min(...allNextTimes) 
          : (subStartMs + 60000);

        let dur = Math.max(1, Math.round((nextTimeMs - subStartMs) / 1000));
        dur = Math.min(dur, Math.max(60, totalAvailable - allocatedSeconds));
        allocatedSeconds += dur;

        items.push({
          id: sub.id,
          timestamp: sub.timestamp,
          title: formatCleanTitle(sub.title, sub.parent_app_name || node.app_name, sub.context_tag, sub.primary_uri),
          context: sub.context_tag || extractDomain(sub.primary_uri) || sub.parent_app_name || node.app_name,
          app: sub.parent_app_name || node.app_name,
          icon: sub.icon_url,
          url: sub.primary_uri,
          source: sub.session_type || 'SubSession',
          duration: dur,
          notes: undefined,
          isActivity: false,
        });
      }
    }

    const sorted = items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Consolidate consecutive items with identical title, app, and context
    const consolidatedItems: TimelineSidebarItem[] = [];
    for (const item of sorted) {
      const prev = consolidatedItems[consolidatedItems.length - 1];
      if (prev && prev.title === item.title && prev.app === item.app && prev.context === item.context) {
        prev.duration += item.duration;
        if (!prev.notes && item.notes) prev.notes = item.notes;
      } else {
        consolidatedItems.push({ ...item });
      }
    }

    return consolidatedItems;
  }, [node]);

  const sessionSpanSeconds = (node?.end_time && node.end_time !== node.start_time)
    ? Math.max(0, Math.round((new Date(node.end_time).getTime() - new Date(node.start_time).getTime()) / 1000))
    : 0;

  const totalDuration = node?.total_duration || sessionSpanSeconds || node?.duration || 0;

  const rawActiveSum = (node?.isGroupedSession && timelineItems.length > 0)
    ? timelineItems.reduce((acc, it) => acc + it.duration, 0)
    : (node?.duration || 0);

  const activeDuration = totalDuration > 0 ? Math.min(rawActiveSum, totalDuration) : rawActiveSum;

  if (!node) return null;

  return (
    <>
      {/* Backdrop overlay for clicking outside to close */}
      <div 
        className="fixed inset-0 bg-black/20 dark:bg-black/60 z-[50] transition-opacity backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Sidebar Panel */}
      <div className="fixed inset-y-0 right-0 w-[420px] glass bg-[var(--bg-color)]/95 backdrop-blur-3xl border-l border-[var(--border-color)] shadow-2xl z-[60] flex flex-col transform transition-transform duration-300 translate-x-0">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)]">
          <h2 className="text-sm font-semibold text-[var(--text-color)] truncate pr-4" title={getGroupedSessionTitle(node)}>
            {getGroupedSessionTitle(node)}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors shrink-0">
            <X className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          <div className="mb-6 flex items-center gap-4">
            <AppIcon
              appName={node.app_name}
              url={node.url}
              iconUrl={node.icon_url}
              domainTag={node.domain_tag}
              source={node.source}
              className="w-12 h-12 shrink-0"
              showBadge={true}
            />
            <div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-base font-semibold text-[var(--text-color)] font-mono">
                  {getFormatDuration(activeDuration)}
                </span>
                <span className="text-xs text-[var(--text-muted)] font-normal">active</span>
                {totalDuration > activeDuration && (
                  <span className="text-xs text-[var(--text-muted)] font-mono opacity-80" title="Total wall-clock session duration">
                    • {getFormatDuration(totalDuration)} total
                  </span>
                )}
                {node.isGroupedSession && node.end_time && node.end_time !== node.start_time && (
                  <span className="text-xs text-[var(--text-muted)] font-mono opacity-80">
                    • {formatTime(node.start_time)} - {formatTime(node.end_time)}
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--text-muted)] capitalize px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/5 inline-block">
                {node.isMemoryNode ? 'AI Processed Session' : node.source}
              </div>
            </div>
          </div>

          {node.isMemoryNode && node.memoryData && (
            <div className="mb-8 space-y-4">
              <div className="flex flex-wrap gap-2 text-xs font-mono">
                <span className="bg-violet-500/10 text-violet-500 dark:text-violet-400 px-2.5 py-1.5 rounded border border-violet-500/20 flex items-center gap-1.5">
                  <span className="opacity-70">Score:</span> {(node.memoryData.importance_score || 0).toFixed(1)}
                </span>
                <span className="bg-blue-500/10 text-blue-500 dark:text-blue-400 px-2.5 py-1.5 rounded border border-blue-500/20 flex items-center gap-1.5">
                  <span className="opacity-70">Conf:</span> {(node.memoryData.confidence || 0).toFixed(2)}
                </span>
                <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1.5 rounded border border-emerald-500/20 capitalize">
                  {node.memoryData.status}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-violet-500/5 dark:bg-violet-500/10 border border-violet-500/20 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-violet-500/10 rounded-bl-full -mr-8 -mt-8" />
                <div className="flex items-center justify-between mb-3 relative z-10">
                  <h3 className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-violet-500"></span>
                    AI Summary
                  </h3>
                  {!isEditing ? (
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="p-1.5 rounded hover:bg-violet-500/10 text-violet-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Edit Summary"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button 
                      onClick={handleSaveSummary}
                      className="p-1.5 rounded hover:bg-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400 transition-colors"
                      title="Save Summary"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                
                <div className="relative z-10">
                  {!isEditing ? (
                    <p className="text-sm text-[var(--text-color)] leading-relaxed min-h-[40px] whitespace-pre-wrap">
                      {node.memoryData.summary || "No summary available."}
                    </p>
                  ) : (
                    <textarea
                      value={summaryText}
                      onChange={(e) => setSummaryText(e.target.value)}
                      className="w-full text-sm text-[var(--text-color)] leading-relaxed bg-white/50 dark:bg-black/20 border border-violet-500/30 rounded p-2 focus:outline-none focus:border-violet-500 custom-scrollbar resize-none"
                      rows={4}
                      autoFocus
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {(node.notes && !node.isMemoryNode) && (
            <div className="mb-8 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
              <h3 className="text-[11px] font-semibold text-blue-500 uppercase tracking-widest mb-2">Notes</h3>
              <p className="text-sm text-[var(--text-color)] leading-relaxed italic">"{node.notes}"</p>
            </div>
          )}

          {node.isGroupedSession && !node.isShield && (
            <div>
              <h3 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-4 h-[1px] bg-[var(--text-muted)] opacity-30"></span>
                Event Timeline ({timelineItems.length})
                <span className="flex-1 h-[1px] bg-[var(--text-muted)] opacity-30"></span>
              </h3>
              
              <div className="space-y-2.5 relative before:absolute before:inset-y-0 before:left-[19px] before:w-[2px] before:bg-black/5 dark:before:bg-white/5">
                {timelineItems.map((event, idx) => {
                  const formattedDur = event.duration > 0 ? getFormatDuration(event.duration) : "<1s";

                  return (
                    <div key={event.id ?? idx} className="relative flex items-start gap-4 p-2.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                      <div className="relative z-10 w-10 h-10 shrink-0 bg-[var(--bg-primary)] p-0.5 rounded-full shadow-sm">
                        <AppIcon
                          appName={event.app || node.app_name}
                          url={event.url}
                          iconUrl={event.icon}
                          domainTag={event.context}
                          source={event.source}
                          className="w-full h-full"
                          showBadge={false}
                        />
                      </div>
                      <div className="flex flex-col flex-1 min-w-0 pt-0.5">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold text-[var(--text-color)] truncate" title={event.title}>
                            {event.title}
                          </span>
                          <div className="flex items-center gap-2">
                            {(event.isActivity || event.activityId) && onDeleteLog && (
                              <button
                                onClick={() => {
                                  const actId = event.activityId || event.id;
                                  if (actId) {
                                    setConfirmModal({
                                      isOpen: true,
                                      title: "Delete Activity",
                                      message: "Delete this individual activity?",
                                      onConfirm: () => onDeleteLog(actId),
                                      onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
                                    });
                                  }
                                }}
                                className="p-1 rounded text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-pointer"
                                title="Delete activity"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0 bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded group-hover:bg-black/10 dark:group-hover:bg-white/10 transition-colors">
                              {formattedDur}
                            </span>
                          </div>
                        </div>
                        <span className="text-[11px] text-[var(--text-muted)] truncate flex items-center gap-1.5">
                          {event.context || extractDomain(event.url) || event.app}
                          {event.url && event.url.startsWith("http") && (
                            <a
                              href={event.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-500 hover:underline px-1 py-0.5 rounded hover:bg-blue-500/10 transition-colors"
                            >
                              ↗
                            </a>
                          )}
                        </span>
                        {event.notes && (
                          <div className="mt-1.5 p-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-[11px] text-violet-600 dark:text-violet-300 italic flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                            <span>"{event.notes}"</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {timelineItems.length === 0 && (
                  <div className="text-sm text-[var(--text-muted)] italic text-center py-8">No granular events recorded</div>
                )}
              </div>
            </div>
          )}

          {node.isShield && (
            <div>
              <h3 className="text-[11px] font-semibold text-red-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-red-500"></span>
                Blocked Distractions
              </h3>
              <div className="space-y-3">
                {node.distractionEvents?.map((event, idx) => (
                  <div key={event.id || idx} className="flex flex-col gap-1.5 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs font-semibold text-red-500 dark:text-red-400 truncate">{event.app_name}: {event.window_title}</span>
                      <span className="text-[10px] font-mono text-red-400/80 bg-red-500/10 px-1.5 py-0.5 rounded">{getFormatDuration(event.duration_blocked)}</span>
                    </div>
                    <span className="text-[11px] text-red-400/80 italic">"{event.interception_reason}"</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <ConfirmModal {...confirmModal} />
    </>
  );
}
