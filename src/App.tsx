import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
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
import type { TimelineNode } from "./components/SCurveTimeline";
import { calculateNonOverlappingDuration } from "./utils/formatDuration";

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
      setResumeError(typeof e === "string" ? e : "Failed to generate context. Please check if Local AI is running and you have recent activity.");
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
        onRefresh={data.loadData}
        onSearchSelect={(node) => {
          const timestamp = 'start_time' in node ? node.start_time : node.timestamp;
          const dateStr = timestamp.split('T')[0] || timestamp.split(' ')[0];
          data.setSelectedDate(dateStr);
          data.setViewMode("daily");
          data.setSelectedActivity(node);
        }}
        onResumeClick={handleResumeProject}
        onSupportClick={() => setIsSupportOpen(true)}
        onDonateClick={() => setIsDonateOpen(true)}
        isAiAvailable={settings.isAiAvailable}
        onAILockedClick={handleAILockedClick}
      />

      {/* One-time informative notice for users about the On-Demand battery & thermal optimization */}
      {!settings.hasSeenOnDemandNotice && (
        <div 
          role="status" 
          aria-live="polite"
          className="bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/15 border-b border-emerald-500/30 text-emerald-800 dark:text-emerald-200 px-4 py-2.5 text-xs shadow-sm flex items-center justify-between gap-4 z-50 animate-in fade-in slide-in-from-top-2 duration-300"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-400 shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <p className="leading-relaxed">
              <strong className="font-semibold text-emerald-700 dark:text-emerald-300">Quiet & Battery-Saving Update:</strong> Local AI is now set to <span className="font-semibold underline decoration-emerald-500/40">On-Demand</span> by default to keep cooling fans silent. Heavy background loops are paused until you request insights. You can customize this anytime in Settings.
            </p>
          </div>
          <button
            onClick={settings.dismissOnDemandNotice}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors shrink-0 shadow-sm cursor-pointer"
          >
            Got it
          </button>
        </div>
      )}

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

      {/* Main Grid Layout */}
      <div className="main-app-container flex-1 max-w-[1600px] w-full mx-auto p-3 sm:p-6 grid grid-cols-1 sm:grid-cols-5 gap-3 sm:gap-6 sm:overflow-hidden">
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

        />

        {/* Sidebar */}
        <div className="sidebar-panel-wrapper sm:col-span-2 space-y-3 sm:space-y-6 flex flex-col sm:h-full sm:overflow-hidden sm:pr-1 sm:pb-6">
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
              aiReflection={localAI.aiReflection}
              aiLoading={localAI.aiLoading}
              generateAIReflection={localAI.generateAIReflection}
              activeAiTab={localAI.activeAiTab}
              setActiveAiTab={localAI.setActiveAiTab}
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

      {data.selectedActivity && 'app_name' in data.selectedActivity && (
        <JournalModal
          activity={data.selectedActivity as ActivityNode}
          onSave={data.handleSaveJournal}
          onClose={() => data.setSelectedActivity(null)}
        />
      )}

      {data.selectedActivity && !('app_name' in data.selectedActivity) && (
        <TimelineSidebar
          node={(() => {
            const mn = data.selectedActivity as MemoryNode;
            let dominantAppName = mn.node_type === 'session' ? 'Semantic Session' : (mn.node_type || 'Memory');
            let dominantIcon = undefined;
            let dominantUrl = undefined;
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
            if (displayTitle.startsWith("Session involving ")) {
              displayTitle = `${dominantAppName} Session`;
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
            } as TimelineNode;
          })()}
          onClose={() => data.setSelectedActivity(null)}
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
