import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Edit2, Check, MessageSquare, Trash2, FileText, Sparkles, Copy, ExternalLink, FolderOpen, CheckCheck, Layers } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl, openPath } from '@tauri-apps/plugin-opener';
import { TimelineNode, getGroupedSessionTitle, formatCleanTitle } from './SCurveTimeline';
import AppIcon, { extractDomain } from './AppIcon';
import { ConfirmModal } from './ConfirmModal';
import { formatDurationFull, formatDuration, formatTime } from '../utils/formatDuration';
import { MarkdownRenderer } from '../utils/markdownRenderer';
import { mapAppToCategory, CATEGORIES } from '../utils/categoryMapper';

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
  const [activeTab, setActiveTab] = useState<"breakdown" | "note">("breakdown");
  const [isEditing, setIsEditing] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [markdownContent, setMarkdownContent] = useState("");
  const [isCompiling, setIsCompiling] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isDeleteNoteModalOpen, setIsDeleteNoteModalOpen] = useState(false);
  const [drawerWidth, setDrawerWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("lifemirror_session_drawer_width");
      return saved ? Math.max(360, Math.min(850, parseInt(saved, 10))) : 440;
    } catch {
      return 440;
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
    } catch (err) {
      console.error("Failed to compile session markdown:", err);
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
    } catch (err) {
      console.error("AI enrichment failed:", err);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleSaveAndOpen = async () => {
    if (!node || !markdownContent) return;
    try {
      const title = getGroupedSessionTitle(node);
      const datePart = (node.start_time.split("T")[0] || "session").replace(/-/g, "");
      const timePart = (node.start_time.split("T")[1] || "00-00").substring(0, 5).replace(":", "");
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 30) || "session";
      const filename = `${datePart}_${timePart}_${slug}.md`;

      const relPath = await invoke<string>("save_session_to_vault", {
        relativeFilename: filename,
        content: markdownContent,
        title,
      });

      const vaultDir = await invoke<string>("get_vault_directory");
      const fullFilePath = `${vaultDir.replace(/[\\\/]$/, "")}/${relPath}`;
      setSavedPath(relPath);
      await openPath(fullFilePath);
    } catch (err) {
      console.error("Failed to save and open markdown:", err);
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
    } catch (err) {
      console.error("Failed to save edited note:", err);
    }
  };

  const handleCopyMarkdown = async () => {
    if (!markdownContent) return;
    await navigator.clipboard.writeText(markdownContent);
    setCopySuccess(true);
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
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)]">
          <h2 className="text-sm font-semibold text-[var(--text-color)] truncate pr-4" title={getGroupedSessionTitle(node)}>
            {getGroupedSessionTitle(node)}
          </h2>
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
            <button onClick={onClose} className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors shrink-0 cursor-pointer">
              <X className="w-5 h-5 text-[var(--text-muted)]" />
            </button>
          </div>
        </div>

        {/* Tab Switcher: Timeline Journey vs Reflective Note */}
        <div className="flex border-b border-[var(--border-color)] bg-[var(--bg-color)]/50 px-5 pt-3 gap-2 shrink-0">
          <button
            onClick={() => setActiveTab("breakdown")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "breakdown"
                ? "border-violet-600 text-violet-600 dark:text-violet-400 font-bold"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-color)]"
            }`}
          >
            <span>Timeline Journey</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/5 dark:bg-white/10">{timelineItems.length}</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("note");
              if (!markdownContent) compileMarkdown();
            }}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "note"
                ? "border-violet-600 text-violet-600 dark:text-violet-400 font-bold"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-color)]"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Reflective Note</span>
            {summaryText && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          {activeTab === "breakdown" ? (
            <>
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
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-[var(--text-color)] font-mono whitespace-nowrap">
                  {getFormatDuration(activeDuration)}
                </span>
                <span className="text-xs text-[var(--text-muted)] font-medium">active</span>
              </div>

              {(node.isGroupedSession && node.end_time && node.end_time !== node.start_time) ? (
                <div className="text-xs text-[var(--text-muted)] font-mono opacity-80 flex items-center gap-1.5 flex-wrap mt-1">
                  <span className="whitespace-nowrap">{formatTime(node.start_time)} – {formatTime(node.end_time)}</span>
                  {totalDuration > activeDuration && (
                    <>
                      <span>•</span>
                      <span className="whitespace-nowrap" title="Total elapsed session span">
                        {formatDuration(totalDuration)} total
                      </span>
                    </>
                  )}
                </div>
              ) : (
                totalDuration > activeDuration && (
                  <div className="text-xs text-[var(--text-muted)] font-mono opacity-80 mt-1 whitespace-nowrap">
                    {formatDuration(totalDuration)} total
                  </div>
                )
              )}

              <div className="mt-2">
                <span className="text-xs text-[var(--text-muted)] capitalize px-2.5 py-0.5 rounded-full bg-black/5 dark:bg-white/5 inline-block">
                  {node.isMemoryNode ? 'Synthesized Flow Episode' : `${node.source} Episode`}
                </span>
              </div>
            </div>
          </div>

          {node.isMemoryNode && node.memoryData && (
            <div className="mb-6 space-y-3">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent border border-violet-500/25 shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between mb-2.5 relative z-10">
                  <h3 className="text-[10px] font-bold text-violet-500 dark:text-violet-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                    <span>Biographer's Synthesis</span>
                  </h3>
                  {!isEditing ? (
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="p-1 rounded hover:bg-violet-500/10 text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity"
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
                    <p className="text-sm text-[var(--text-color)] leading-relaxed min-h-[40px] whitespace-pre-wrap font-medium">
                      {node.memoryData.summary || "No summary available."}
                    </p>
                  ) : (
                    <textarea
                      value={summaryText}
                      onChange={(e) => setSummaryText(e.target.value)}
                      className="w-full text-sm text-[var(--text-color)] leading-relaxed bg-white/50 dark:bg-black/20 border border-violet-500/30 rounded-xl p-2.5 focus:outline-none focus:border-violet-500 custom-scrollbar resize-none"
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
                Journey Trail
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
                        <span className="text-[11px] text-[var(--text-muted)] truncate flex items-center gap-1.5 flex-wrap">
                          <span>{extractDomain(event.url) || event.app}</span>
                          {event.context && event.context !== extractDomain(event.url) && event.context !== event.app && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/20">
                              {event.context}
                            </span>
                          )}
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
                              className="text-blue-500 hover:underline px-1 py-0.5 rounded hover:bg-blue-500/10 transition-colors cursor-pointer text-[11px]"
                              title={`Open ${event.url}`}
                            >
                              ↗
                            </button>
                          )}
                        </span>
                        {event.metadata && (
                          <p className="mt-1 text-[11px] text-[var(--text-muted)] bg-black/5 dark:bg-white/5 px-2 py-1 rounded border-l-2 border-emerald-500 italic line-clamp-2 leading-relaxed">
                            "{event.metadata}"
                          </p>
                        )}
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
          </>
        ) : (
          /* Session Note View */
          <div className="space-y-4">
            {/* Action Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--bg-color)]/60 border border-[var(--border-color)] shadow-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={handleEnrichWithAI}
                  disabled={isEnriching}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  title="Synthesize session accomplishments and key takeaways with AI"
                >
                  {isEnriching ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>{isEnriching ? "Enriching..." : "Enrich with AI"}</span>
                </button>

                <button
                  onClick={handleSaveAndOpen}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--card-bg)] hover:bg-[var(--border-color)] text-[var(--text-color)] border border-[var(--border-color)] transition-colors cursor-pointer"
                  title="Save to vault and open in external editor (Obsidian / VS Code)"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-violet-500" />
                  <span>Open in Editor</span>
                </button>
              </div>

              <div className="flex items-center justify-end gap-1">
                {isEditingNote ? (
                  <button
                    onClick={handleSaveEditedNote}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-xs"
                    title="Save Changes to Vault"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                ) : null}
                <button
                  onClick={handleCopyMarkdown}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-[var(--border-color)] transition-colors cursor-pointer"
                  title="Copy Markdown"
                >
                  {copySuccess ? <CheckCheck className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setIsEditingNote(!isEditingNote)}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    isEditingNote ? "bg-violet-500/20 text-violet-500" : "text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-[var(--border-color)]"
                  }`}
                  title={isEditingNote ? "Cancel Editing" : "Edit Markdown"}
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {savedPath && (
                  <button
                    onClick={() => setIsDeleteNoteModalOpen(true)}
                    className="p-1.5 rounded-lg text-red-500/80 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Move Session Note to Trash (.trash/)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {savedPath && (
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg flex items-center justify-between">
                <span>Saved to: <code className="font-mono font-semibold">{savedPath}</code></span>
                <FolderOpen className="w-3.5 h-3.5 shrink-0" />
              </div>
            )}

            {/* Note Content */}
            {isCompiling ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-xs text-[var(--text-muted)]">
                <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                <span>Compiling session note...</span>
              </div>
            ) : isEditingNote ? (
              <textarea
                value={markdownContent}
                onChange={(e) => setMarkdownContent(e.target.value)}
                className="w-full h-[450px] p-3 text-xs font-mono rounded-xl bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-color)] focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none custom-scrollbar"
                placeholder="Write or edit markdown..."
              />
            ) : (
              <div className="p-4 rounded-2xl bg-[var(--bg-color)]/40 border border-[var(--border-color)] shadow-xs">
                <MarkdownRenderer content={markdownContent} />
              </div>
            )}
          </div>
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
