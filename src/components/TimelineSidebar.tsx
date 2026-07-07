import React from 'react';
import { X } from 'lucide-react';
import { TimelineNode, ActivityNode } from './SCurveTimeline';
import AppIcon from './AppIcon';
import { extractDomain } from '../utils/format';

export const getFormatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
};

interface TimelineSidebarProps {
  node: TimelineNode | null;
  onClose: () => void;
}

export default function TimelineSidebar({ node, onClose }: TimelineSidebarProps) {
  if (!node) return null;

  return (
    <>
      {/* Backdrop overlay for clicking outside to close */}
      <div 
        className="fixed inset-0 bg-black/10 dark:bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Sidebar Panel */}
      <div className="fixed inset-y-0 right-0 w-[420px] bg-[var(--bg-primary)] border-l border-[var(--border-color)] shadow-2xl z-50 flex flex-col transform transition-transform duration-300 translate-x-0">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)]">
          <h2 className="text-sm font-semibold text-[var(--text-color)] truncate pr-4" title={node.window_title}>
            {node.window_title}
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
              <div className="text-sm text-[var(--text-color)] font-mono mb-1">{getFormatDuration(node.duration)}</div>
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

              <div className="p-4 rounded-xl bg-violet-500/5 dark:bg-violet-500/10 border border-violet-500/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-violet-500/10 rounded-bl-full -mr-8 -mt-8" />
                <h3 className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-violet-500"></span>
                  AI Summary
                </h3>
                <p className="text-sm text-[var(--text-color)] leading-relaxed relative z-10">
                  {node.memoryData.summary || "No summary available."}
                </p>
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
                Event Timeline ({node.originalActivities.length + node.subEvents.length})
                <span className="flex-1 h-[1px] bg-[var(--text-muted)] opacity-30"></span>
              </h3>
              
              <div className="space-y-2.5 relative before:absolute before:inset-y-0 before:left-[19px] before:w-[2px] before:bg-black/5 dark:before:bg-white/5">
                {[...node.originalActivities.map(a => ({
                  id: a.id,
                  timestamp: a.start_time,
                  title: a.window_title,
                  context: a.domain_tag || extractDomain(a.url),
                  app: a.app_name,
                  icon: a.icon_url,
                  url: a.url,
                  source: a.source,
                  duration: a.duration
                })), ...node.subEvents.map(s => ({
                  id: s.id,
                  timestamp: s.timestamp,
                  title: s.title,
                  context: s.context_tag || extractDomain(s.primary_uri),
                  app: s.parent_app_name || node.app_name,
                  icon: s.icon_url,
                  url: s.primary_uri,
                  source: s.session_type,
                  duration: 0
                }))].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                .map((event, idx, arr) => {
                  let dur = event.duration;
                  if (dur === 0) {
                    if (idx < arr.length - 1) {
                      dur = Math.max(0, (new Date(arr[idx + 1].timestamp).getTime() - new Date(event.timestamp).getTime()) / 1000);
                    } else {
                      const groupStart = new Date(node.start_time).getTime();
                      const groupEnd = groupStart + node.duration * 1000;
                      dur = Math.max(0, (groupEnd - new Date(event.timestamp).getTime()) / 1000);
                    }
                  }
                  const formattedDur = dur > 0 ? getFormatDuration(Math.round(dur)) : "1s";

                  return (
                    <div key={event.id || idx} className="relative flex items-start gap-4 p-2.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
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
                          <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0 bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded group-hover:bg-black/10 dark:group-hover:bg-white/10 transition-colors">
                            {formattedDur}
                          </span>
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
                      </div>
                    </div>
                  );
                })}
                
                {node.originalActivities.length === 0 && node.subEvents.length === 0 && (
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
    </>
  );
}
