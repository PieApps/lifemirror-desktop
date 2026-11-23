import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useSettings } from "./hooks/useSettings";
import { useActivityData } from "./hooks/useActivityData";
import { useFocus } from "./hooks/useFocus";
import { useLocalAI } from "./hooks/useLocalAI";
import { Header } from "./components/Header";
import { TimelinePanel } from "./components/TimelinePanel";
import { AISidebar } from "./components/AISidebar";
import { SettingsPanel } from "./components/SettingsPanel";
import { JournalModal } from "./components/JournalModal";
import { SupportModal } from "./components/SupportModal";
import { DonateModal } from "./components/DonateModal";
import { AILockedModal } from "./components/AILockedModal";
import { AISetupModal } from "./components/AISetupModal";
import { computeMetrics } from "./services/analytics";
import { ResumeLoadingSkeleton } from "./components/ResumeLoadingSkeleton";
import { ResumeContextCard } from "./components/ResumeContextCard";
import { FirstLogCelebration } from "./components/FirstLogCelebration";
import type { ResumeContextResponse } from "./types/resume";
import type { ActivityNode, MemoryNode } from "./types";
import TimelineSidebar from "./components/TimelineSidebar";
import { type TimelineNode, type SubSessionEvent, formatCleanTitle } from "./components/SCurveTimeline";
import { calculateNonOverlappingDuration } from "./utils/formatDuration";

function createTimelineNodeFromSearchResult(
  node: ActivityNode | MemoryNode,
  subSessionEvents: SubSessionEvent[] = []
): TimelineNode {
  // Case 1: MemoryNode (Semantic Episode)
  if ('node_type' in node || !('app_name' in node)) {
    const mn = node as MemoryNode;
    let dominantAppName = mn.node_type === 'session' ? 'Semantic Session' : (mn.node_type || 'Memory');
    let dominantIcon: string | undefined = undefined;
    let dominantUrl: string | undefined = undefined;
    let dominantSource = 'AI Memory';
    
    if (mn.activities && mn.activities.length > 0) {
      const durations: Record<string, number> = {};
      mn.activities.forEach(a => {
        durations[a.app_name] = (durations[a.app_name] || 0) + a.duration;
      });
      let maxApp = mn.activities[0].app_name;
      let maxDur = 0;
      for (const [app, dur] of Object.entries(durations)) {
        if (dur > maxDur) { maxDur = dur; maxApp = app; }
      }
      const dominant = mn.activities.find(a => a.app_name === maxApp) || mn.activities[0];
      dominantAppName = dominant.app_name;
      dominantIcon = dominant.icon_url;
      dominantUrl = dominant.url;
      dominantSource = dominant.source;
    }

    let displayTitle = mn.title;
    if (displayTitle.startsWith("Session involving ") || displayTitle.endsWith(" Session") || displayTitle.startsWith("Chrome (http")) {
      if (dominantUrl) {
        try {
          const parsed = new URL(dominantUrl.startsWith("http") ? dominantUrl : `https://${dominantUrl}`);
          const host = parsed.hostname.replace(/^www\./, "");
          displayTitle = `${host.charAt(0).toUpperCase() + host.slice(1)} Flow`;
        } catch {
          displayTitle = `${dominantAppName} Flow`;
        }
      } else {
        displayTitle = `${dominantAppName} Flow`;
      }
    }

    const actStarts = (mn.activities || []).map(a => new Date(a.start_time).getTime());
    const actEnds = (mn.activities || []).map(a => new Date(a.start_time).getTime() + a.duration * 1000);
    const subTimes = (mn.sub_events || []).map(s => new Date(s.timestamp).getTime());
    const mnTime = new Date(mn.timestamp).getTime();
    const startMs = actStarts.length > 0 ? Math.min(...actStarts) : (subTimes.length > 0 ? Math.min(...subTimes, mnTime) : mnTime);
    let calculatedDuration = calculateNonOverlappingDuration(mn.activities || []);
    if (calculatedDuration === 0 && mn.sub_events && mn.sub_events.length > 0) {
      if (mn.sub_events.length > 1) {
        const span = Math.round((Math.max(...subTimes) - Math.min(...subTimes)) / 1000);
        calculatedDuration = Math.max(60, Math.min(span, mn.sub_events.length * 60));
      } else {
        calculatedDuration = 60;
      }
    }
    const endMs = actEnds.length > 0 ? Math.max(...actEnds) : (subTimes.length > 0 ? Math.max(...subTimes, startMs + calculatedDuration * 1000) : startMs + calculatedDuration * 1000);
    const spanSeconds = Math.max(0, Math.round((endMs - startMs) / 1000));
    const totalDur = Math.max(calculatedDuration, spanSeconds);

    return {
      isGroupedSession: true,
      id: mn.id || Math.abs(String(mn.timestamp).split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0)),
      app_name: dominantAppName,
      window_title: displayTitle,
      start_time: new Date(startMs).toISOString(),
      end_time: new Date(endMs).toISOString(),
      duration: Math.min(calculatedDuration, totalDur > 0 ? totalDur : calculatedDuration),
      total_duration: totalDur,
      source: dominantSource,
      url: dominantUrl,
      icon_url: dominantIcon,
      notes: mn.summary,
      originalActivities: mn.activities ? [...mn.activities] : [],
      subEvents: mn.sub_events ? [...mn.sub_events] : [],
      isMemoryNode: true,
      memoryData: mn
    };
  }

  // Case 2: ActivityNode (Granular OS Window / Moment)
  const act = node as ActivityNode;
  const actStartMs = new Date(act.start_time).getTime();
  const actDuration = act.duration || 60;
  const actEndMs = actStartMs + actDuration * 1000;

  const matchedSubEvents = subSessionEvents.filter(s => {
    const t = new Date(s.timestamp).getTime();
    return t >= actStartMs - 5000 && t <= actEndMs + 5000;
  });

  return {
    isGroupedSession: false,
    id: act.id,
    app_name: act.app_name,
    window_title: formatCleanTitle(act.window_title, act.app_name, act.domain_tag, act.url),
    start_time: act.start_time,
    end_time: new Date(actEndMs).toISOString(),
    duration: actDuration,
    total_duration: actDuration,
    source: act.source || "OS",
    url: act.url,
    icon_url: act.icon_url,
    domain_tag: act.domain_tag,
    notes: act.notes,
    originalActivities: [act],
    subEvents: matchedSubEvents,
    isMemoryNode: false
  };
}

function App() {
  const settings = useSettings();
  const focus = useFocus();

  const data = useActivityData({
    trackingActive: settings.trackingActive,
    isIncognito: settings.isIncognito,
    setIsIncognito: settings.setIsIncognito,
  });

  const [pullProgress, setPullProgress] = useState<{status: string, total: number, completed: number} | null>(null);
  const [pullingModel, setPullingModel] = useState(false);
  const [pullError, setPullError] = useState<string | null>(null);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isDonateOpen, setIsDonateOpen] = useState(false);
  const [lockedFeatureName, setLockedFeatureName] = useState<string | null>(null);
  const [isAISetupOpen, setIsAISetupOpen] = useState(false);
  const [settingsDefaultTab, setSettingsDefaultTab] = useState<"general" | "focus" | "ai" | "about">("general");
  const [searchSelectedTimelineNode, setSearchSelectedTimelineNode] = useState<TimelineNode | null>(null);

  // Zen Mode state (⌘D / Ctrl+D to toggle, persisted)
  const [isZenMode, setIsZenMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem("lifemirror_zen_mode") === "true";
    } catch {
      return false;
    }
  });

  const toggleZenMode = () => {
    setIsZenMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem("lifemirror_zen_mode", String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        toggleZenMode();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Resizable main sidepanel state (min 320px, max 750px, persisted)
  const [sidepanelWidth, setSidepanelWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("lifemirror_main_sidepanel_width");
      return saved ? Math.max(320, Math.min(750, parseInt(saved, 10))) : 460;
    } catch {
      return 460;
    }
  });
  const [isResizingSidepanel, setIsResizingSidepanel] = useState<boolean>(false);

  const startResizingSidepanel = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidepanel(true);
  };

  useEffect(() => {
    if (!isResizingSidepanel) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = document.getElementById("main-app-layout-container");
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const newWidth = Math.max(320, Math.min(Math.min(750, rect.width - 480), rect.right - e.clientX));
      setSidepanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSidepanel(false);
      localStorage.setItem("lifemirror_main_sidepanel_width", String(sidepanelWidth));
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
  }, [isResizingSidepanel, sidepanelWidth]);

  const handleAILockedClick = (featureName: string) => {
    setLockedFeatureName(featureName);
  };

  const handleOpenAISettings = () => {
    setLockedFeatureName(null);
    setSettingsDefaultTab("ai");
    settings.setShowSettings(true);
  };

  const localAI = useLocalAI({
    aiUrl: settings.ollamaUrl,
    aiModel: settings.ollamaModel,
    aiMode: settings.aiMode,
    cloudModel: settings.cloudModel,
    excludedDomains: settings.excludedDomains,
    isIncognito: settings.isIncognito,
    selectedDate: data.selectedDate,
    viewMode: data.viewMode,
    activities: data.activities,
    subSessionEvents: data.subSessionEvents,
    weeklySummaries: data.weeklySummaries,
    monthlySummaries: data.monthlySummaries,
    chatMessages: data.chatMessages,
    setChatMessages: data.setChatMessages,
    getPeriodLabel: data.getPeriodLabel,
  });

  const metrics = useMemo(() => {
    return computeMetrics(data.activities, data.distractionEvents, focus.activeIntention);
  }, [data.activities, data.distractionEvents, focus.activeIntention]);

  useEffect(() => {
    const onVis = () => {
      document.documentElement.classList.toggle("app-hidden", document.visibilityState === "hidden");
    };
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const [missingModel, setMissingModel] = useState<string | null>(null);

  const [isResuming, setIsResuming] = useState(false);
  const [resumeContext, setResumeContext] = useState<ResumeContextResponse | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);

  const handleResumeProject = async () => {
    setIsResuming(true);
    setResumeContext(null);
    setResumeError(null);
    try {
      const result = await invoke<ResumeContextResponse>("generate_resume_context", { projectId: null });
      setResumeContext(result);
    } catch (e) {
      console.error("Failed to generate resume context:", e);
      setResumeError(typeof e === "string" ? e : "Failed to generate context. Please check if your AI engine is running and you have recent activity.");
    } finally {
      setIsResuming(false);
    }
  };

  // Load persisted intention and reflection on mount
  useEffect(() => {
    focus.loadIntention();
    localAI.loadReflection();

    const unlisten = listen('embedding-model-missing', (event: any) => {
      setMissingModel(event.payload.model);
    });

    const unlistenPull = listen('model-pull-progress', (event: any) => {
      const p = event.payload;
      setPullProgress({
        status: p.status,
        total: p.total || 0,
        completed: p.completed || 0
      });
      if (p.status === "success") {
        setMissingModel(null);
        setPullingModel(false);
        setPullProgress(null);
        window.location.reload();
      }
    });

    return () => {
      unlisten.then(f => f());
      unlistenPull.then(f => f());
    };
  }, []);

  const handlePullModel = async () => {
    if (!missingModel) return;
    setPullingModel(true);
    setPullError(null);
    try {
      await invoke("pull_ai_model", { purpose: "embedding" });
    } catch (e) {
      setPullError(typeof e === "string" ? e : "Failed to pull model");
      setPullingModel(false);
    }
  };

  return (
    <div className="min-h-screen sm:h-screen sm:overflow-hidden bg-[var(--bg-color)] text-[var(--text-color)] flex flex-col transition-colors duration-300">
      <Header
        theme={settings.theme}
        setTheme={settings.setTheme}
        isIncognito={settings.isIncognito}
        trackingActive={settings.trackingActive}
        activeAppName={data.activeActivity?.app_name}
        showSettings={settings.showSettings}
        setShowSettings={settings.setShowSettings}
        onSearchSelect={(node) => {
          const timestamp = 'start_time' in node ? node.start_time : node.timestamp;
          const dateStr = timestamp.split('T')[0] || timestamp.split(' ')[0];
          data.setSelectedDate(dateStr);
          data.setViewMode("daily");
          const timelineNode = createTimelineNodeFromSearchResult(node, data.subSessionEvents);
          setSearchSelectedTimelineNode(timelineNode);
        }}
      />

      {missingModel && settings.aiProcessingMode === "continuous" && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-600 dark:text-amber-400 p-3 text-center text-sm shadow-inner relative">
          <p className="font-semibold mb-1">Semantic Search Unavailable: Missing AI Model</p>
          <p className="opacity-90 max-w-2xl mx-auto mb-3">
            To enable intelligent global search, you need the <span className="font-mono">{missingModel}</span> model installed locally.
          </p>
          {pullError && <p className="text-red-500 mb-2 font-semibold text-xs">{pullError}</p>}
          
          <button 
            onClick={handlePullModel}
            disabled={pullingModel}
            className="px-4 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 font-medium rounded-lg text-sm transition-colors border border-amber-500/30 flex items-center justify-center mx-auto min-w-[200px]"
          >
            {pullingModel ? (
              <span className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                {pullProgress?.total ? 
                  `Downloading... ${Math.round((pullProgress.completed / pullProgress.total) * 100)}%` : 
                  pullProgress?.status || "Starting..."
                }
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Download Model Native
              </span>
            )}
          </button>
          
          {pullingModel && pullProgress && pullProgress.total > 0 && (
            <div className="mt-3 max-w-sm mx-auto bg-amber-500/10 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-amber-500 h-full transition-all duration-300"
                style={{ width: `${(pullProgress.completed / pullProgress.total) * 100}%` }}
              ></div>
            </div>
          )}
          <button 
            onClick={() => setMissingModel(null)}
            className="absolute top-3 right-4 text-xs font-semibold hover:text-amber-500 transition-colors"
          >
            ✕ DISMISS
          </button>
        </div>
      )}

      {/* Main Layout */}
      <div 
        id="main-app-layout-container"
        className="main-app-container flex-1 max-w-[1600px] w-full mx-auto p-3 sm:p-6 sm:overflow-hidden relative"
      >
        <TimelinePanel
          viewMode={data.viewMode}
          setViewMode={data.setViewMode}
          selectedDate={data.selectedDate}
          onSelectDate={data.setSelectedDate}
          getPeriodLabel={data.getPeriodLabel}
          handlePrevPeriod={data.handlePrevPeriod}
          handleNextPeriod={data.handleNextPeriod}
          isNextDisabled={data.isNextDisabled}
          activities={data.activities}
          memoryNodes={data.memoryNodes}
          subSessionEvents={data.subSessionEvents}
          distractionEvents={data.distractionEvents}
          weeklySummaries={data.weeklySummaries}
          monthlySummaries={data.monthlySummaries}
          heatmapData={data.heatmapData}
          metrics={metrics}
          isIncognito={settings.isIncognito}
          onToggleIncognito={settings.handleToggleIncognito}
          activeIntention={focus.activeIntention}
          intentionInput={focus.intentionInput}
          setIntentionInput={focus.setIntentionInput}
          handleStartFocus={focus.handleStartFocus}
          handleStopFocus={focus.handleStopFocus}
          onAddJournal={(node) => data.setSelectedActivity(node)}
          onDeleteLog={data.handleDeleteLog}
          onDeleteMemoryNode={data.handleDeleteMemoryNode}
          activeNodeStartTime={data.activeActivity?.start_time}
          isZenMode={isZenMode}
          onToggleZenMode={toggleZenMode}
          onResumeClick={handleResumeProject}
        />

        {!isZenMode && (
          <>
            {/* Flexible Resizer Divider Bar between Timeline and Sidepanel */}
            <div
              onMouseDown={startResizingSidepanel}
              className={`hidden sm:flex items-center justify-center w-2 -mx-1 cursor-col-resize select-none shrink-0 transition-colors z-20 group relative ${
                isResizingSidepanel ? "bg-violet-600/30" : "hover:bg-violet-500/20"
              }`}
              title="Drag to resize sidepanel width"
            >
              <div className={`w-0.5 h-12 rounded-full transition-colors ${
                isResizingSidepanel ? "bg-violet-600" : "bg-[var(--border-color)] group-hover:bg-violet-500"
              }`} />
              {/* Invisible hit padding */}
              <div className="absolute inset-y-0 -left-1.5 -right-1.5 cursor-col-resize" />
            </div>

            {/* Sidebar */}
            <div 
              style={{ width: typeof window !== "undefined" && window.innerWidth >= 640 ? `${sidepanelWidth}px` : undefined }}
              className="sidebar-panel-wrapper space-y-3 sm:space-y-6 flex flex-col sm:h-full sm:overflow-hidden sm:pr-1 sm:pb-6"
            >
              {settings.showSettings ? (
                <SettingsPanel
                  isIncognito={settings.isIncognito}
                  onToggleIncognito={settings.handleToggleIncognito}
                  aiUrl={settings.ollamaUrl}
                  setAiUrl={settings.updateOllamaUrl}
                  aiModel={settings.ollamaModel}
                  setAiModel={settings.updateOllamaModel}
                  aiProcessingMode={settings.aiProcessingMode}
                  setAiProcessingMode={settings.updateAiProcessingMode}
                  trackingActive={settings.trackingActive}
                  setTrackingActive={settings.handleToggleTracking}
                  minLogDuration={settings.minLogDuration}
                  setMinLogDuration={settings.updateMinLogDuration}
                  minSubSessionDuration={settings.minSubSessionDuration}
                  updateMinSubSessionDuration={settings.updateMinSubSessionDuration}
                  isAutostartEnabled={settings.isAutostartEnabled}
                  toggleAutostart={settings.toggleAutostart}
                  onSupportClick={() => setIsSupportOpen(true)}
                  onDonateClick={() => setIsDonateOpen(true)}
                  initialTab={settingsDefaultTab}
                  onAiConnectionTested={settings.setIsAiAvailable}
                  excludedDomains={settings.excludedDomains}
                  unattachedNotes={settings.unattachedNotes}
                  onAddExcludedDomain={settings.addExcludedDomain}
                  onRemoveExcludedDomain={settings.removeExcludedDomain}
                  onPreviewPurge={settings.previewDomainPurge}
                  onRefreshUnattachedNotes={settings.loadUnattachedNotes}
                  aiMode={settings.aiMode}
                  onUpdateAiMode={settings.updateAiMode}
                  cloudProvider={settings.cloudProvider}
                  cloudApiKey={settings.cloudApiKey}
                  cloudBaseUrl={settings.cloudBaseUrl}
                  cloudModel={settings.cloudModel}
                  cloudDisclosureAccepted={settings.cloudDisclosureAccepted}
                  onSaveCloudConfig={settings.saveCloudConfig}
                  onRevokeCloudAccess={settings.revokeCloudAccess}
                />
              ) : (
                <AISidebar
                  metrics={metrics}
                  isIncognito={settings.isIncognito}
                  getPeriodLabel={data.getPeriodLabel}
                  chatMessages={data.chatMessages}
                  volatileChatHistory={localAI.volatileChatHistory}
                  chatInput={localAI.chatInput}
                  setChatInput={localAI.setChatInput}
                  chatLoading={localAI.chatLoading}
                  chatSuggestions={localAI.chatSuggestions}
                  loadingSuggestions={localAI.loadingSuggestions}
                  handleSendChat={localAI.handleSendChat}
                  handleGenerateSuggestions={localAI.handleGenerateSuggestions}
                  clearChat={localAI.clearChat}
                  isAiAvailable={settings.isAiAvailable}
                  onAILockedClick={handleAILockedClick}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {(isResuming || resumeContext || resumeError) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          {isResuming && !resumeContext && !resumeError ? (
            <ResumeLoadingSkeleton />
          ) : resumeError ? (
            <div className="bg-[var(--card-bg)] border border-red-500/50 rounded-xl p-8 max-w-md w-full shadow-2xl text-center relative">
                <button 
                  onClick={() => setResumeError(null)}
                  className="absolute top-4 right-4 p-2 hover:bg-[var(--border-color)] rounded-full transition-colors"
                >
                  <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-[var(--text-color)] mb-2">Resume Failed</h3>
                <p className="text-[var(--text-muted)] mb-8">{resumeError}</p>
                <button
                    onClick={() => setResumeError(null)}
                    className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg font-semibold transition-colors"
                >
                    Dismiss
                </button>
            </div>
          ) : resumeContext ? (
            <ResumeContextCard 
              context={resumeContext} 
              projectName="Recent Project" // In a real app we'd fetch the project name
              onClose={() => setResumeContext(null)} 
            />
          ) : null}
        </div>
      )}

      {data.selectedActivity && (
        <JournalModal
          activity={data.selectedActivity}
          onSave={data.handleSaveJournal}
          onClose={() => data.setSelectedActivity(null)}
        />
      )}

      {searchSelectedTimelineNode && (
        <TimelineSidebar
          node={searchSelectedTimelineNode}
          onClose={() => setSearchSelectedTimelineNode(null)}
          onDeleteLog={(id) => {
            data.handleDeleteLog(id);
            setSearchSelectedTimelineNode(null);
          }}
          onDeleteMemoryNode={(id) => {
            data.handleDeleteMemoryNode(id);
            setSearchSelectedTimelineNode(null);
          }}
        />
      )}
      {/* Support & Community Modals */}
      <SupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
      />
      <DonateModal
        isOpen={isDonateOpen}
        onClose={() => setIsDonateOpen(false)}
      />
      <AILockedModal
        isOpen={lockedFeatureName !== null}
        onClose={() => setLockedFeatureName(null)}
        onOpenSettings={handleOpenAISettings}
        onOpenSetupModal={() => {
          setLockedFeatureName(null);
          setIsAISetupOpen(true);
        }}
        featureName={lockedFeatureName || "This feature"}
        ollamaUrl={settings.ollamaUrl}
        ollamaModel={settings.ollamaModel}
      />

      <AISetupModal
        isOpen={isAISetupOpen}
        onClose={() => setIsAISetupOpen(false)}
        onSelectLocal={async (model, url) => {
          await settings.updateOllamaModel(model);
          await settings.updateOllamaUrl(url);
          await settings.updateAiMode("local");
        }}
        onSelectCloud={async (provider, apiKey, baseUrl, model) => {
          await settings.saveCloudConfig(provider, apiKey, baseUrl, model);
        }}
        onSkip={async () => {
          await settings.updateAiMode("off");
        }}
        currentOllamaUrl={settings.ollamaUrl}
        currentOllamaModel={settings.ollamaModel}
      />

      <FirstLogCelebration activityCount={data.activities.length} />
    </div>
  );
}

export default App;
