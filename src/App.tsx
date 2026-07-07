import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useSettings } from "./hooks/useSettings";
import { useActivityData } from "./hooks/useActivityData";
import { useFocus } from "./hooks/useFocus";
import { useOllama } from "./hooks/useOllama";
import { Header } from "./components/Header";
import { TimelinePanel } from "./components/TimelinePanel";
import { AISidebar } from "./components/AISidebar";
import { SettingsPanel } from "./components/SettingsPanel";
import { JournalModal } from "./components/JournalModal";
import { computeMetrics } from "./services/analytics";
import { ResumeLoadingSkeleton } from "./components/ResumeLoadingSkeleton";
import { ResumeContextCard } from "./components/ResumeContextCard";
import type { ResumeContextResponse } from "./types/resume";
import type { ActivityNode } from "./types";
import { invoke } from "@tauri-apps/api/core";

function App() {
  const settings = useSettings();
  const focus = useFocus();

  const data = useActivityData({
    trackingActive: settings.trackingActive,
    isIncognito: settings.isIncognito,
    setIsIncognito: settings.setIsIncognito,
  });

  const ollama = useOllama({
    ollamaUrl: settings.ollamaUrl,
    ollamaModel: settings.ollamaModel,
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

  const [missingModel, setMissingModel] = useState<string | null>(null);

  const [isResuming, setIsResuming] = useState(false);
  const [resumeContext, setResumeContext] = useState<ResumeContextResponse | null>(null);

  const handleResumeProject = async () => {
    setIsResuming(true);
    setResumeContext(null);
    try {
      const result = await invoke<ResumeContextResponse>("generate_resume_context", { projectId: null });
      setResumeContext(result);
    } catch (e) {
      console.error("Failed to generate resume context:", e);
      // Fallback or error handling can be shown here
    } finally {
      setIsResuming(false);
    }
  };

  // Load persisted intention and reflection on mount
  useEffect(() => {
    focus.loadIntention();
    ollama.loadReflection();

    const unlisten = listen('embedding-model-missing', (event: any) => {
      setMissingModel(event.payload.model);
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[var(--bg-color)] text-[var(--text-color)] flex flex-col transition-colors duration-300">
      <Header
        theme={settings.theme}
        setTheme={settings.setTheme}
        isIncognito={settings.isIncognito}
        showSettings={settings.showSettings}
        setShowSettings={settings.setShowSettings}
        onRefresh={data.loadData}
        onSearchSelect={(node) => {
          const timestamp = 'start_time' in node ? node.start_time : node.timestamp;
          const dateStr = timestamp.split('T')[0] || timestamp.split(' ')[0];
          data.setSelectedDate(dateStr);
          data.setViewMode("daily");
        }}
        onResumeClick={handleResumeProject}
      />

      {missingModel && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-600 dark:text-amber-400 p-3 text-center text-sm shadow-inner relative">
          <p className="font-semibold mb-1">Semantic Search Unavailable: Missing Ollama Model</p>
          <p className="opacity-90 max-w-2xl mx-auto">
            To enable intelligent global search, please run <code className="bg-amber-500/20 px-1.5 py-0.5 rounded font-mono select-all">ollama pull {missingModel}</code> in your terminal.
          </p>
          <button 
            onClick={() => setMissingModel(null)}
            className="absolute top-3 right-4 text-xs font-semibold hover:text-amber-500 transition-colors"
          >
            ✕ DISMISS
          </button>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 lg:overflow-hidden">
        <TimelinePanel
          viewMode={data.viewMode}
          setViewMode={data.setViewMode}
          selectedDate={data.selectedDate}
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
        />

        {/* Sidebar */}
        <div className="space-y-6 flex flex-col lg:h-full lg:overflow-y-auto custom-scrollbar lg:pr-2 lg:pb-6">
          {settings.showSettings ? (
            <SettingsPanel
              isIncognito={settings.isIncognito}
              onToggleIncognito={settings.handleToggleIncognito}
              ollamaUrl={settings.ollamaUrl}
              setOllamaUrl={settings.updateOllamaUrl}
              ollamaModel={settings.ollamaModel}
              setOllamaModel={settings.updateOllamaModel}
              trackingActive={settings.trackingActive}
              setTrackingActive={settings.handleToggleTracking}
              minLogDuration={settings.minLogDuration}
              setMinLogDuration={settings.updateMinLogDuration}
              minSubSessionDuration={settings.minSubSessionDuration}
              updateMinSubSessionDuration={settings.updateMinSubSessionDuration}
              isAutostartEnabled={settings.isAutostartEnabled}
              toggleAutostart={settings.toggleAutostart}
            />
          ) : (
            <AISidebar
              metrics={metrics}
              isIncognito={settings.isIncognito}
              getPeriodLabel={data.getPeriodLabel}
              aiReflection={ollama.aiReflection}
              aiLoading={ollama.aiLoading}
              generateAIReflection={ollama.generateAIReflection}
              activeAiTab={ollama.activeAiTab}
              setActiveAiTab={ollama.setActiveAiTab}
              chatMessages={data.chatMessages}
              volatileChatHistory={ollama.volatileChatHistory}
              chatInput={ollama.chatInput}
              setChatInput={ollama.setChatInput}
              chatLoading={ollama.chatLoading}
              chatSuggestions={ollama.chatSuggestions}
              loadingSuggestions={ollama.loadingSuggestions}
              handleSendChat={ollama.handleSendChat}
              handleGenerateSuggestions={ollama.handleGenerateSuggestions}
              clearChat={ollama.clearChat}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {(isResuming || resumeContext) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          {isResuming && !resumeContext ? (
            <ResumeLoadingSkeleton />
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
    </div>
  );
}

export default App;
