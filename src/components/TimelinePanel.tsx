import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ShieldAlert, Clock, Grid, Calendar, Target, FileText, BookOpen
} from "lucide-react";
import { SCurveTimeline } from "./SCurveTimeline";
import { WeeklyView } from "./WeeklyView";
import { MonthlyView } from "./MonthlyView";
import { ExportJournalModal } from "./ExportJournalModal";
import { WikiVaultView } from "./WikiVaultView";
import type { ActivityNode, MemoryNode, SubSessionEvent, DistractionEvent, DailySummary, HourlyMetric } from "../types";
import { getWeekRange } from "../hooks/useActivityData";
import type { ProductivityMetrics } from "../services/analytics";

interface TimelinePanelProps {
  // View state
  viewMode: "daily" | "weekly" | "monthly";
  setViewMode: (mode: "daily" | "weekly" | "monthly") => void;
  selectedDate: string;
  onSelectDate?: (dateStr: string) => void;

  // Navigation
  getPeriodLabel: () => string;
  handlePrevPeriod: () => void;
  handleNextPeriod: () => void;
  isNextDisabled: () => boolean;

  // Data
  memoryNodes: MemoryNode[];
  activities: ActivityNode[];
  subSessionEvents: SubSessionEvent[];
  distractionEvents: DistractionEvent[];
  weeklySummaries: DailySummary[];
  monthlySummaries: DailySummary[];
  heatmapData: HourlyMetric[];
  metrics: ProductivityMetrics;

  // Incognito
  isIncognito: boolean;
  onToggleIncognito: () => void;

  // Focus
  activeIntention: string;
  intentionInput: string;
  setIntentionInput: (v: string) => void;
  handleStartFocus: () => void;
  handleStopFocus: () => void;

  // Actions
  onAddJournal: (activity: ActivityNode) => void;
  onDeleteLog: (id: number) => void;
  onDeleteMemoryNode?: (id: number) => void;
  activeNodeStartTime?: string;
}

export const TimelinePanel: React.FC<TimelinePanelProps> = ({
  viewMode,
  setViewMode,
  selectedDate,
  onSelectDate,
  getPeriodLabel,
  handlePrevPeriod,
  handleNextPeriod,
  isNextDisabled,
  memoryNodes,
  activities,
  subSessionEvents,
  distractionEvents,
  weeklySummaries,
  monthlySummaries,
  heatmapData,
  metrics,
  isIncognito,
  onToggleIncognito,
  activeIntention,
  intentionInput,
  setIntentionInput,
  handleStartFocus,
  handleStopFocus,
  onAddJournal,
  onDeleteLog,
  onDeleteMemoryNode,
  activeNodeStartTime,
}) => {
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [mainTab, setMainTab] = useState<"timeline" | "vault">("timeline");
  const [isGeneratingPeriodNote, setIsGeneratingPeriodNote] = useState(false);
  const [initialVaultFile, setInitialVaultFile] = useState<string | undefined>(undefined);

  const handleGeneratePeriodNote = async () => {
    setIsGeneratingPeriodNote(true);
    try {
      const pType = viewMode === "monthly" ? "month" : viewMode === "weekly" ? "week" : "day";
      const relPath = await invoke<string>("compile_period_note", {
        periodType: pType,
        dateKey: selectedDate,
      });
      setInitialVaultFile(relPath);
      setMainTab("vault");
    } catch (err) {
      console.error("Failed to compile periodic note:", err);
    } finally {
      setIsGeneratingPeriodNote(false);
    }
  };

  return (
    <div className="timeline-panel-wrapper relative min-h-[350px] sm:min-h-0 sm:h-full bg-[var(--card-bg)] rounded-3xl border border-[var(--border-color)] overflow-hidden flex flex-col">
      <div className="p-3 sm:px-5 sm:py-3.5 border-b border-[var(--border-color)] flex flex-wrap items-center justify-between gap-3">
        {/* Main Navigation: Timeline vs Knowledge Vault */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="flex bg-[var(--bg-color)]/60 dark:bg-zinc-800/40 p-1 rounded-2xl border border-[var(--border-color)] shrink-0">
            <button
              onClick={() => setMainTab("timeline")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                mainTab === "timeline"
                  ? "bg-violet-600 text-white shadow-md shadow-violet-500/20"
                  : "text-[var(--text-muted)] hover:text-[var(--text-color)]"
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>Timeline</span>
            </button>
            <button
              onClick={() => setMainTab("vault")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                mainTab === "vault"
                  ? "bg-violet-600 text-white shadow-md shadow-violet-500/20"
                  : "text-[var(--text-muted)] hover:text-[var(--text-color)]"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span>Knowledge Vault</span>
            </button>
          </div>

          {mainTab === "timeline" && (
            <div className="flex bg-[var(--bg-color)]/40 dark:bg-zinc-800/30 p-1 rounded-2xl border border-[var(--border-color)] shrink-0">
              <button
                onClick={() => setViewMode("daily")}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  viewMode === "daily"
                    ? "bg-zinc-700/80 dark:bg-zinc-700 text-white shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-color)]"
                }`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>Day</span>
              </button>
              <button
                onClick={() => setViewMode("weekly")}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  viewMode === "weekly"
                    ? "bg-zinc-700/80 dark:bg-zinc-700 text-white shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-color)]"
                }`}
              >
                <Grid className="w-3.5 h-3.5 shrink-0" />
                <span>Week</span>
              </button>
              <button
                onClick={() => setViewMode("monthly")}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  viewMode === "monthly"
                    ? "bg-zinc-700/80 dark:bg-zinc-700 text-white shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-color)]"
                }`}
              >
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>Month</span>
              </button>
            </div>
          )}
        </div>

        {/* Date Scrubber & Action Buttons (Only shown in Timeline mode) */}
        {mainTab === "timeline" && (
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            <button
              onClick={handleGeneratePeriodNote}
              disabled={isGeneratingPeriodNote}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-violet-500/20 bg-violet-600/10 hover:bg-violet-600/20 text-violet-600 dark:text-violet-400 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
              title={`Compile and view ${viewMode === "monthly" ? "Month" : viewMode === "weekly" ? "Week" : "Day"} Note in Knowledge Vault`}
            >
              {isGeneratingPeriodNote ? (
                <div className="w-3.5 h-3.5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin shrink-0" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-violet-500 shrink-0" />
              )}
              <span className="whitespace-nowrap">
                {isGeneratingPeriodNote
                  ? "Compiling..."
                  : viewMode === "monthly"
                  ? "Month Note"
                  : viewMode === "weekly"
                  ? "Week Note"
                  : "Day Note"}
              </span>
            </button>

            <button
              onClick={() => setIsExportOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400 font-semibold text-xs transition-colors hover:bg-violet-500/20 cursor-pointer whitespace-nowrap shrink-0"
              title="Generate Work Journal"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">Export</span>
            </button>
            {viewMode === "daily" && distractionEvents.length > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 dark:text-red-400 font-mono text-xs shadow-sm whitespace-nowrap shrink-0" title="Distractions Deflected Today">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">Deflected: {distractionEvents.length}</span>
              </div>
            )}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handlePrevPeriod}
                className="p-1.5 sm:p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/30 hover:bg-zinc-500/10 text-[var(--text-muted)] hover:text-[var(--text-color)] cursor-pointer transition-all shrink-0"
                title="Previous period"
              >
                &larr;
              </button>
              <span className="text-xs font-bold text-[var(--text-color)] min-w-[145px] text-center font-mono whitespace-nowrap select-none px-1 shrink-0">
                {getPeriodLabel()}
              </span>
              <button
                onClick={handleNextPeriod}
                disabled={isNextDisabled()}
                className="p-1.5 sm:p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/30 hover:bg-zinc-500/10 text-[var(--text-muted)] hover:text-[var(--text-color)] cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                title="Next period"
              >
                &rarr;
              </button>
            </div>
          </div>
        )}
      </div>

      {mainTab === "vault" ? (
        <div className="flex-1 overflow-hidden p-2 sm:p-4">
          <WikiVaultView
            onBackToTimeline={() => setMainTab("timeline")}
            initialRelativePath={initialVaultFile}
          />
        </div>
      ) : (
        <>
          {/* Active Intention Bar */}
          <div className="px-6 py-3 border-b border-[var(--border-color)] bg-[var(--bg-color)]/20">
        {activeIntention ? (
          <div className="flex items-center justify-between bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2">
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-rose-500 animate-pulse" />
              <div>
                <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Active Intention</div>
                <div className="text-sm text-[var(--text-color)] font-medium">{activeIntention}</div>
              </div>
            </div>
            <button
              onClick={handleStopFocus}
              className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Clear Intention
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Target className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              <input
                type="text"
                value={intentionInput}
                onChange={(e) => setIntentionInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleStartFocus() }}
                placeholder="Set an intention to enable AI distraction evaluation (e.g., 'Writing Rust code')..."
                className="flex-1 bg-transparent border-none text-sm text-[var(--text-color)] focus:outline-none placeholder:text-[var(--text-muted)]/50 min-w-0"
              />
              <button
                onClick={handleStartFocus}
                disabled={!intentionInput.trim()}
                className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
              >
                Start Focus
              </button>
            </div>
            
            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 pl-7 overflow-x-auto custom-scrollbar pb-0.5 text-[11px]">
              <span className="text-[10px] font-medium text-[var(--text-muted)] shrink-0">Presets:</span>
              {[
                { label: "💻 Deep Coding", value: "Deep Coding" },
                { label: "📝 Writing Docs", value: "Writing Documentation" },
                { label: "🔍 Research", value: "Research & Analysis" },
                { label: "🎨 UI Design", value: "UI Design & Polish" },
                { label: "🐛 Debugging", value: "Debugging Code" },
              ].map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => {
                    setIntentionInput(preset.value);
                  }}
                  className="px-2 py-0.5 rounded-md bg-[var(--bg-color)]/60 hover:bg-violet-500/15 border border-[var(--border-color)] hover:border-violet-500/40 text-[var(--text-muted)] hover:text-violet-400 font-medium transition-all shrink-0 cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto relative custom-scrollbar">
        {/* Visual Lock overlay for Incognito Mode */}
        {isIncognito && (
          <div className="absolute inset-0 bg-[var(--bg-color)]/90 backdrop-blur-md z-30 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
            <ShieldAlert className="w-16 h-16 text-amber-500/90 mb-4 animate-bounce" />
            <h3 className="text-xl font-bold text-[var(--text-color)]">Timeline Is Encrypted & Locked</h3>
            <p className="text-sm text-[var(--text-muted)] mt-2 max-w-sm">
              Active logs are disabled. Turn off Incognito Mode in configurations to resume database insertions.
            </p>
            <button
              onClick={onToggleIncognito}
              className="mt-6 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 font-semibold text-sm transition-all shadow-lg shadow-amber-500/20 cursor-pointer text-white"
            >
              Disable Incognito Mode
            </button>
          </div>
        )}
        
        {viewMode === "daily" ? (
          <SCurveTimeline 
            memoryNodes={memoryNodes}
            activities={[...activities].reverse()} 
            subSessionEvents={subSessionEvents}
            distractionEvents={distractionEvents}
            onAddJournal={onAddJournal} 
            onDeleteLog={onDeleteLog}
            onDeleteMemoryNode={onDeleteMemoryNode}
            activeNodeStartTime={activeNodeStartTime}
          />
        ) : viewMode === "weekly" ? (
          <div className="p-6">
            <WeeklyView
              startDate={getWeekRange(selectedDate).start}
              endDate={getWeekRange(selectedDate).end}
              summaryData={weeklySummaries}
              heatmapData={heatmapData}
              onSelectDate={(dateStr) => {
                if (onSelectDate) onSelectDate(dateStr);
                setViewMode("daily");
              }}
            />
          </div>
        ) : (
          <div className="p-6">
            <MonthlyView
              yearMonth={selectedDate.substring(0, 7)}
              summaryData={monthlySummaries}
            />
          </div>
        )}
      </div>
      </>
      )}
      
      {/* Export Modal */}
      {isExportOpen && (
        <ExportJournalModal
          date={selectedDate}
          activities={activities}
          metrics={metrics}
          weeklySummaries={weeklySummaries}
          monthlySummaries={monthlySummaries}
          viewMode={viewMode}
          onClose={() => setIsExportOpen(false)}
        />
      )}
    </div>
  );
};
