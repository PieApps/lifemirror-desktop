import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Edit2, MessageSquare, Trash2, FileText, Sparkles, Copy, FolderOpen, CheckCheck, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl, openPath } from '@tauri-apps/plugin-opener';
import { TimelineNode, getGroupedSessionTitle, formatCleanTitle } from './SCurveTimeline';
import AppIcon, { extractDomain } from './AppIcon';
import { ConfirmModal } from './ConfirmModal';
import { formatDurationFull, formatDuration, formatTime } from '../utils/formatDuration';
import { MarkdownRenderer } from '../utils/markdownRenderer';
import { mapAppToCategory, CATEGORIES } from '../utils/categoryMapper';
import { sound } from '../utils/sound';

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
  metadata?: string;
  isActivity: boolean;
}

interface TimelineSidebarProps {
  node: TimelineNode | null;
  onClose: () => void;
  onDeleteLog?: (id: number) => void;
  onDeleteMemoryNode?: (id: number) => void;
  onUngroup?: () => void;
}

export default function TimelineSidebar({ node, onClose, onDeleteLog, onDeleteMemoryNode, onUngroup }: TimelineSidebarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [markdownContent, setMarkdownContent] = useState("");
  const [isCompiling, setIsCompiling] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [showCompiledNote, setShowCompiledNote] = useState(false);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isDeleteNoteModalOpen, setIsDeleteNoteModalOpen] = useState(false);
  const [drawerWidth, setDrawerWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("lifemirror_session_drawer_width");
      return saved ? Math.max(380, Math.min(850, parseInt(saved, 10))) : 460;
    } catch {
      return 460;
    }
  });
  const [isResizingDrawer, setIsResizingDrawer] = useState<boolean>(false);

  const startResizingDrawer = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingDrawer(true);
  }, []);

  useEffect(() => {
    if (!isResizingDrawer) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(360, Math.min(Math.min(900, window.innerWidth - 60), window.innerWidth - e.clientX));
      setDrawerWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingDrawer(false);
      localStorage.setItem("lifemirror_session_drawer_width", String(drawerWidth));
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingDrawer, drawerWidth]);

  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void, onCancel: () => void}>({
    isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {}
  });

  useEffect(() => {
    if (node?.isMemoryNode && node.memoryData) {
      setSummaryText(node.memoryData.summary || "");
    } else {
      setSummaryText("");
    }
    setIsEditing(false);
    setIsEditingNote(false);
    setSavedPath(null);
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
            metadata: sub.metadata,
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
          metadata: sub.metadata,
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
        if (!prev.metadata && item.metadata) prev.metadata = item.metadata;
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

  const compileMarkdown = useCallback(async (summaryOverride?: string) => {
    if (!node) return;
    setIsCompiling(true);
    try {
      const title = getGroupedSessionTitle(node);
      const payload = {
        session_id: node.isMemoryNode ? node.memoryData?.id : null,
        title,
        start_time: node.start_time,
        duration_seconds: activeDuration || node.duration || 0,
        app_name: node.app_name || "Application",
        category: CATEGORIES[mapAppToCategory(node.app_name, node.domain_tag)]?.name || "General",
        activities: (node.originalActivities || []).map(a => ({
          title: formatCleanTitle(a.window_title, a.app_name, a.domain_tag, a.url),
          app_name: a.app_name,
          duration: a.duration,
          url: a.url || undefined,
          notes: a.notes || undefined,
        })),
        sub_events: (node.subEvents || []).map(s => ({
          title: formatCleanTitle(s.title, s.parent_app_name, s.context_tag, s.primary_uri),
          primary_uri: s.primary_uri || undefined,
          metadata: s.metadata || undefined,
          timestamp: s.timestamp,
        })),
        ai_summary: summaryOverride ?? (summaryText || (node.isMemoryNode ? node.memoryData?.summary : undefined)),
        notes: node.notes || undefined,
      };
      const md = await invoke<string>("compile_session_markdown", { payload });
      setMarkdownContent(md);

      // Auto-persist session note to the Knowledge Vault
      try {
        const datePart = (node.start_time.split("T")[0] || "session").replace(/-/g, "");
        const timePart = (node.start_time.split("T")[1] || "00-00").substring(0, 5).replace(":", "");
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 30) || "session";
        const filename = `${datePart}_${timePart}_${slug}.md`;

        const relPath = await invoke<string>("save_session_to_vault", {
          relativeFilename: filename,
          content: md,
          title,
        });
        setSavedPath(relPath);
      } catch (saveErr) {
        console.warn("Could not auto-save session note to vault:", saveErr);
      }
      return md;
    } catch (err) {
      console.error("Failed to compile session markdown:", err);
      return undefined;
    } finally {
      setIsCompiling(false);
    }
  }, [node, activeDuration, summaryText]);

  useEffect(() => {
    if (node) {
      compileMarkdown();
    }
  }, [node, compileMarkdown]);

  const handleEnrichWithAI = async () => {
    if (!node || isEnriching) return;
    setIsEnriching(true);
    sound.playClick();
    try {
      const sessionTitle = getGroupedSessionTitle(node);
      const activitiesSummary = timelineItems.map(it => {
        const noteStr = it.notes ? ` [User Note: "${it.notes}"]` : "";
        return `- ${it.app}: ${it.title} (${getFormatDuration(it.duration)})${noteStr}`;
      }).join("\n");
      const enriched = await invoke<string>("enrich_session_note", {
        sessionTitle,
        activitiesSummary: activitiesSummary || sessionTitle,
      });
      setSummaryText(enriched);
      if (node.isMemoryNode && node.memoryData?.id) {
        await invoke("update_memory_node_summary", { id: node.memoryData.id, summary: enriched });
        node.memoryData.summary = enriched;
      }
      await compileMarkdown(enriched);
      sound.playFocusIgnite();
    } catch (err) {
      console.error("AI enrichment failed:", err);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleImmortalizeToVault = async () => {
    if (!node) return;
    sound.playFocusIgnite();
    try {
      let content = markdownContent;
      if (!content) {
        const compiled = await compileMarkdown();
        content = compiled || "";
      }
      const title = getGroupedSessionTitle(node);
      const datePart = (node.start_time.split("T")[0] || "session").replace(/-/g, "");
      const timePart = (node.start_time.split("T")[1] || "00-00").substring(0, 5).replace(":", "");
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 30) || "session";
      const filename = `${datePart}_${timePart}_${slug}.md`;

      const relPath = await invoke<string>("save_session_to_vault", {
        relativeFilename: filename,
        content,
        title,
      });
      setSavedPath(relPath);
      sound.playCelebration();
    } catch (err) {
      console.error("Failed to immortalize session to vault:", err);
    }
  };

  const handleOpenInEditor = async () => {
    if (!savedPath) return;
    try {
      const vaultDir = await invoke<string>("get_vault_directory");
      const fullFilePath = `${vaultDir.replace(/[\\\/]$/, "")}/${savedPath}`;
      await openPath(fullFilePath);
      sound.playClick();
    } catch (err) {
      console.error("Failed to open file in editor:", err);
    }
  };

  const handleSaveEditedNote = async () => {
    if (!node || !markdownContent) return;
    try {
      const title = getGroupedSessionTitle(node);
      const datePart = (node.start_time.split("T")[0] || "session").replace(/-/g, "");
      const timePart = (node.start_time.split("T")[1] || "00-00").substring(0, 5).replace(":", "");
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 30) || "session";
      const filename = savedPath || `${datePart}_${timePart}_${slug}.md`;

      const relPath = await invoke<string>("save_session_to_vault", {
        relativeFilename: filename,
        content: markdownContent,
        title,
      });
      setSavedPath(relPath);
      setIsEditingNote(false);
      sound.playClick();
    } catch (err) {
      console.error("Failed to save edited note:", err);
    }
  };

  const handleCopyMarkdown = async () => {
    if (!markdownContent) return;
    await navigator.clipboard.writeText(markdownContent);
    setCopySuccess(true);
    sound.playClick();
    setTimeout(() => setCopySuccess(false), 2000);
  };

  if (!node) return null;

  return (
    <>
      {/* Backdrop overlay for clicking outside to close */}
      <div 
        className="fixed inset-0 bg-black/20 dark:bg-black/60 z-[50] transition-opacity backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Sidebar Panel */}
      <div 
        style={{ width: `${drawerWidth}px`, maxWidth: '92vw' }}
        className="fixed inset-y-0 right-0 glass bg-[var(--bg-color)]/95 backdrop-blur-3xl border-l border-[var(--border-color)] shadow-2xl z-[60] flex flex-col transform transition-transform duration-300 translate-x-0"
      >
        {/* Left Edge Draggable Resizer Bar */}
        <div
          onMouseDown={startResizingDrawer}
          className={`absolute left-0 inset-y-0 w-2 -translate-x-1/2 cursor-col-resize select-none z-20 group flex items-center justify-center transition-colors ${
            isResizingDrawer ? "bg-violet-600/40" : "hover:bg-violet-500/30"
          }`}
          title="Drag to resize session panel width"
        >
          <div className={`w-0.5 h-12 rounded-full transition-colors ${
            isResizingDrawer ? "bg-violet-600" : "bg-[var(--border-color)] group-hover:bg-violet-500"
          }`} />
          {/* Hit area expander */}
          <div className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize" />
        </div>
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)] bg-[var(--card-bg)]/50">
          <div className="min-w-0 pr-4">
            <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest block mb-0.5">
              Episode Chronicle
            </span>
            <h2 className="text-sm font-bold text-[var(--text-color)] truncate" title={getGroupedSessionTitle(node)}>
              {getGroupedSessionTitle(node)}
            </h2>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onUngroup && node.isGroupedSession && node.originalActivities.length > 1 && (
              <button
                onClick={onUngroup}
                className="p-1.5 hover:bg-violet-500/10 text-[var(--text-muted)] hover:text-violet-400 rounded-lg transition-colors cursor-pointer"
                title="Expand into individual moments on timeline"
              >
                <Layers className="w-4 h-4" />
              </button>
            )}
            {onDeleteLog && (
              <button
                onClick={() => {
                  setConfirmModal({
                    isOpen: true,
                    title: "Remove Episode",
                    message: "Remove this focus episode and its recorded timeline trail?",
                    onConfirm: () => {
                      if (node.isShield) {
                        node.distractionEvents?.forEach(ev => onDeleteLog(-ev.id));
                      } else if (node.isGroupedSession) {
                        node.originalActivities.forEach(act => {
                          if (act.id) onDeleteLog(act.id);
                        });
                        if (node.isMemoryNode && onDeleteMemoryNode && node.id) {
                          onDeleteMemoryNode(node.id);
                        }
                      } else if (node.id) {
                        onDeleteLog(node.id);
                      }
                      onClose();
                    },
                    onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
                  });
                }}
                className="p-1.5 hover:bg-rose-500/10 text-[var(--text-muted)] hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                title="Remove Episode"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-5 h-5 text-[var(--text-muted)]" />
            </button>
          </div>
        </div>

        {/* Single Unified Reading Flow */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-6">
          
          {/* Section 1: Hero Episode Card */}
          <div className="glass rounded-2xl p-4 border border-[var(--border-color)] bg-[var(--card-bg)] flex items-center gap-4">
            <AppIcon
              appName={node.app_name}
              url={node.url}
              iconUrl={node.icon_url}
              domainTag={node.domain_tag}
              source={node.source}
              className="w-12 h-12 shrink-0 rounded-xl"
              showBadge={true}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[var(--text-color)] font-mono">
                  {getFormatDuration(activeDuration)}
                </span>
                <span className="text-xs text-violet-400 font-semibold uppercase tracking-wider">Focused</span>
              </div>

              <div className="text-xs text-[var(--text-muted)] font-mono flex items-center gap-1.5 flex-wrap mt-0.5">
                <span>{formatTime(node.start_time)} – {formatTime(node.end_time || node.start_time)}</span>
                {totalDuration > activeDuration && (
                  <>
                    <span>•</span>
                    <span title="Total elapsed span">{formatDuration(totalDuration)} span</span>
                  </>
                )}
              </div>

              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] font-semibold text-zinc-300 px-2 py-0.5 rounded-full bg-zinc-800/60 border border-white/5 inline-block">
                  {node.isMemoryNode ? '✨ Synthesized Flow' : `${node.source} Episode`}
                </span>
                {node.isGroupedSession && (
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    {timelineItems.length} moments
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: The Biographer's Episode Story */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                <span>Biographer's Narrative</span>
              </h3>
              {summaryText && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-[11px] text-[var(--text-muted)] hover:text-violet-400 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              )}
            </div>

            {summaryText ? (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent border border-violet-500/25 relative">
                {!isEditing ? (
                  <p className="text-xs text-[var(--text-color)] leading-relaxed font-serif whitespace-pre-wrap">
                    "{summaryText}"
                  </p>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={summaryText}
                      onChange={(e) => setSummaryText(e.target.value)}
                      className="w-full text-xs text-[var(--text-color)] leading-relaxed bg-[var(--bg-color)] border border-violet-500/40 rounded-xl p-3 focus:outline-none focus:border-violet-500 custom-scrollbar resize-none font-serif"
                      rows={4}
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-2.5 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-color)]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveSummary}
                        className="px-3 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-semibold"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--card-bg)]/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                <div className="text-xs text-[var(--text-muted)]">
                  Turn this {getFormatDuration(activeDuration)} session into a synthesized literary chronicle.
                </div>
                <button
                  onClick={handleEnrichWithAI}
                  disabled={isEnriching}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white flex items-center gap-1.5 shrink-0 shadow-sm shadow-violet-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isEnriching ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>{isEnriching ? "Synthesizing..." : "Synthesize Narrative"}</span>
                </button>
              </div>
            )}
          </div>

          {/* Section 3: User Notes (if manually annotated) */}
          {(node.notes && !node.isMemoryNode) && (
            <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block mb-1">Session Note</span>
              <p className="text-[var(--text-color)] italic">"{node.notes}"</p>
            </div>
          )}

          {/* Section 4: The Artifact Journey (Touched Windows & Activities) */}
          {node.isGroupedSession && !node.isShield && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Artifacts & Windows ({timelineItems.length})
                </h3>
              </div>
              
              <div className="space-y-2 relative before:absolute before:inset-y-0 before:left-[19px] before:w-[2px] before:bg-black/5 dark:before:bg-white/5">
                {timelineItems.map((event, idx) => {
                  const formattedDur = event.duration > 0 ? getFormatDuration(event.duration) : "<1s";

                  return (
                    <div key={event.id ?? idx} className="relative flex items-start gap-3.5 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                      <div className="relative z-10 w-9 h-9 shrink-0 bg-[var(--bg-primary)] p-0.5 rounded-xl shadow-xs">
                        <AppIcon
                          appName={event.app || node.app_name}
                          url={event.url}
                          iconUrl={event.icon}
                          domainTag={event.context}
                          source={event.source}
                          className="w-full h-full rounded-lg"
                          showBadge={false}
                        />
                      </div>
                      <div className="flex flex-col flex-1 min-w-0 pt-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold text-[var(--text-color)] truncate" title={event.title}>
                            {event.title}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
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
                                className="p-1 rounded text-rose-500 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                title="Delete activity"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                            <span className="text-[10px] font-mono text-[var(--text-muted)] bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded">
                              {formattedDur}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] mt-0.5">
                          <span className="truncate">{extractDomain(event.url) || event.app}</span>
                          {event.url && event.url.startsWith("http") && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (event.url) {
                                  openUrl(event.url).catch((err) => console.warn("Failed to open external url:", err));
                                }
                              }}
                              className="text-violet-400 hover:underline px-1 py-0.5 rounded hover:bg-violet-500/10 transition-colors cursor-pointer text-[10px]"
                              title={`Open ${event.url}`}
                            >
                              ↗
                            </button>
                          )}
                        </div>

                        {event.notes && (
                          <div className="mt-1 p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-[11px] text-violet-300 italic flex items-center gap-1.5">
                            <MessageSquare className="w-3 h-3 text-violet-400 shrink-0" />
                            <span>"{event.notes}"</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {node.isShield && (
            <div>
              <h3 className="text-[11px] font-bold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                Interdicted Distractions
              </h3>
              <div className="space-y-2">
                {node.distractionEvents?.map((event, idx) => (
                  <div key={event.id || idx} className="flex flex-col gap-1 p-3 rounded-xl bg-red-500/5 border border-red-500/15">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs font-semibold text-red-400 truncate">{event.app_name}: {event.window_title}</span>
                      <span className="text-[10px] font-mono text-red-400/80 bg-red-500/10 px-1.5 py-0.5 rounded">{getFormatDuration(event.duration_blocked)}</span>
                    </div>
                    <span className="text-[11px] text-red-400/70 italic">"{event.interception_reason}"</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 5: Collapsible Markdown Note Preview */}
          <div className="pt-2 border-t border-[var(--border-color)]">
            <button
              onClick={() => setShowCompiledNote(!showCompiledNote)}
              className="flex items-center justify-between w-full py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-color)] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-violet-400" />
                <span>Vault Note Source</span>
              </div>
              {showCompiledNote ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showCompiledNote && (
              <div className="mt-2 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">
                    {savedPath ? `Vault: ${savedPath}` : "Draft ready to immortalize"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleCopyMarkdown}
                      className="px-2 py-1 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] hover:bg-zinc-500/10 text-[var(--text-muted)] hover:text-[var(--text-color)] transition-colors text-[10px] flex items-center gap-1 cursor-pointer"
                    >
                      {copySuccess ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copySuccess ? "Copied" : "Copy"}</span>
                    </button>
                    {isEditingNote ? (
                      <button
                        onClick={handleSaveEditedNote}
                        className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[10px] cursor-pointer"
                      >
                        Save Edits
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsEditingNote(true)}
                        className="px-2 py-1 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] hover:bg-zinc-500/10 text-[var(--text-muted)] hover:text-[var(--text-color)] transition-colors text-[10px] cursor-pointer"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                {isEditingNote ? (
                  <textarea
                    value={markdownContent}
                    onChange={(e) => setMarkdownContent(e.target.value)}
                    className="w-full h-64 p-3 text-xs font-mono rounded-xl bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-color)] focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none custom-scrollbar"
                  />
                ) : (
                  <div className="p-3.5 rounded-xl bg-[var(--bg-color)]/60 border border-[var(--border-color)] text-xs">
                    <MarkdownRenderer content={markdownContent} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sticky Immortalize Action Footer */}
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-color)]/90 backdrop-blur-md flex items-center justify-between gap-3">
          {savedPath ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                <span className="text-xs font-semibold text-emerald-400">Immortalized to Vault</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenInEditor}
                  className="px-3 py-1.5 rounded-xl bg-[var(--card-bg)] hover:bg-[var(--border-color)] border border-[var(--border-color)] text-xs font-medium text-[var(--text-color)] flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-violet-400" />
                  <span>Open in Vault</span>
                </button>
                <button
                  onClick={handleCopyMarkdown}
                  className="p-1.5 rounded-xl bg-[var(--card-bg)] hover:bg-[var(--border-color)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-color)] cursor-pointer transition-colors"
                  title="Copy Markdown"
                >
                  {copySuccess ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleImmortalizeToVault}
              disabled={isCompiling}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>Immortalize to Personal Vault</span>
            </button>
          )}
        </div>
      </div>
      <ConfirmModal {...confirmModal} />
      <ConfirmModal
        isOpen={isDeleteNoteModalOpen}
        title="Move Session Note to Trash"
        message={`Move "${savedPath}" to the vault trash (.trash/)? You can always re-compile it from this activity.`}
        onConfirm={async () => {
          if (!savedPath) return;
          try {
            await invoke("delete_vault_file", { relativePath: savedPath });
            setSavedPath(null);
            setIsDeleteNoteModalOpen(false);
          } catch (err) {
            console.error("Failed to delete session note:", err);
          }
        }}
        onCancel={() => setIsDeleteNoteModalOpen(false)}
      />
    </>
  );
}
