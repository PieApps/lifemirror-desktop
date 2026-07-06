import { useEffect, useMemo } from "react";
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

  // Load persisted intention and reflection on mount
  useEffect(() => {
    focus.loadIntention();
    ollama.loadReflection();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-color)] text-[var(--text-color)] flex flex-col transition-colors duration-300">
      <Header
        theme={settings.theme}
        setTheme={settings.setTheme}
        isIncognito={settings.isIncognito}
        showSettings={settings.showSettings}
        setShowSettings={settings.setShowSettings}
        onRefresh={data.loadData}
        onSearchSelect={data.setSelectedActivity}
      />

      {/* Main Grid Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TimelinePanel
          viewMode={data.viewMode}
          setViewMode={data.setViewMode}
          selectedDate={data.selectedDate}
          getPeriodLabel={data.getPeriodLabel}
          handlePrevPeriod={data.handlePrevPeriod}
          handleNextPeriod={data.handleNextPeriod}
          isNextDisabled={data.isNextDisabled}
          activities={data.activities}
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
        <div className="space-y-6 flex flex-col">
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

      {/* Manual Reflection Journal Overlay */}
      {data.selectedActivity && (
        <JournalModal
          activity={data.selectedActivity}
          onClose={() => data.setSelectedActivity(null)}
          onSave={data.handleSaveJournal}
        />
      )}
    </div>
  );
}

export default App;
