import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ShieldAlert, Clock, Target, BookOpen, Maximize2, Minimize2,
  Sparkles, Download, ChevronLeft, ChevronRight
} from "lucide-react";
import { SCurveTimeline } from "./SCurveTimeline";
import { WeeklyView } from "./WeeklyView";
import { MonthlyView } from "./MonthlyView";
import { ExportJournalModal } from "./ExportJournalModal";
import { WikiVaultView } from "./WikiVaultView";
import type { ActivityNode, MemoryNode, SubSessionEvent, DistractionEvent, DailySummary, HourlyMetric } from "../types";
import { getWeekRange, getLocalDateString } from "../hooks/useActivityData";
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
  onAddJournal: (activity: any) => void;
  onDeleteLog: (id: number) => void;
  onDeleteMemoryNode?: (id: number) => void;
  activeNodeStartTime?: string;
  isZenMode?: boolean;
  onToggleZenMode?: () => void;
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
  isZenMode,
  onToggleZenMode,
}) => {
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [mainTab, setMainTab] = useState<"timeline" | "vault">("timeline");
  const [isGeneratingPeriodNote, setIsGeneratingPeriodNote] = useState(false);
  const [isGroupedTimeline, setIsGroupedTimeline] = useState<boolean>(true);
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
            <div className="flex bg-[var(--bg-color)]/60 dark:bg-zinc-800/40 p-1 rounded-2xl border border-[var(--border-color)] shrink-0">
              <button
                onClick={() => setViewMode("daily")}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  viewMode === "daily"
                    ? "bg-violet-600 text-white shadow-md shadow-violet-500/20"
                    : "text-[var(--text-muted)] hover:text-[var(--text-color)]"
                }`}
              >
                <span>Day</span>
              </button>
              <button
                onClick={() => setViewMode("weekly")}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  viewMode === "weekly"
                    ? "bg-violet-600 text-white shadow-md shadow-violet-500/20"
                    : "text-[var(--text-muted)] hover:text-[var(--text-color)]"
                }`}
              >
                <span>Week</span>
              </button>
              <button
                onClick={() => setViewMode("monthly")}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  viewMode === "monthly"
                    ? "bg-violet-600 text-white shadow-md shadow-violet-500/20"
                    : "text-[var(--text-muted)] hover:text-[var(--text-color)]"
                }`}
              >
                <span>Month</span>
              </button>
            </div>
          )}
        </div>

        {/* Date Scrubber & Action Buttons (Only shown in Timeline mode) */}
        {mainTab === "timeline" && (
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            {/* Primary Creative Action: Synthesize Day / Period */}
            <button
              onClick={handleGeneratePeriodNote}
              disabled={isGeneratingPeriodNote}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-violet-500/30 bg-violet-600/15 hover:bg-violet-600 text-violet-300 hover:text-white font-semibold text-xs transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0 shadow-xs"
              title={`Synthesize and view ${viewMode === "monthly" ? "Month" : viewMode === "weekly" ? "Week" : "Day"} Note in Knowledge Vault`}
            >
              {isGeneratingPeriodNote ? (
                <div className="w-3.5 h-3.5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin shrink-0" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              )}
              <span className="whitespace-nowrap">
                {isGeneratingPeriodNote
                  ? "Synthesizing..."
                  : viewMode === "monthly"
                  ? "✨ Synthesize Month"
                  : viewMode === "weekly"
                  ? "✨ Synthesize Week"
                  : "✨ Synthesize Day"}
              </span>
            </button>

            {/* Secondary Export Action */}
            <button
              onClick={() => setIsExportOpen(true)}
              className="hidden sm:flex items-center justify-center p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/40 hover:bg-zinc-500/10 text-[var(--text-muted)] hover:text-[var(--text-color)] transition-all cursor-pointer shrink-0"
              title="Export Work Journal (Markdown, CSV, JSON)"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {onToggleZenMode && (
              <button
                onClick={onToggleZenMode}
                className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                  isZenMode
                    ? "border-violet-500 bg-violet-600 text-white shadow-md shadow-violet-500/25"
                    : "border-[var(--border-color)] bg-[var(--bg-color)]/40 hover:bg-zinc-500/10 text-[var(--text-muted)] hover:text-[var(--text-color)]"
                }`}
                title={isZenMode ? "Exit Zen Mode (⌘D / Ctrl+D)" : "Zen Mode (⌘D / Ctrl+D) — Expand Timeline"}
              >
                {isZenMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span className="whitespace-nowrap">Zen</span>
              </button>
            )}

            {viewMode === "daily" && (
              <div className="hidden sm:flex items-center p-0.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/40 text-[11px] font-semibold shrink-0">
                <button
                  onClick={() => setIsGroupedTimeline(true)}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    isGroupedTimeline
                      ? "bg-violet-600 text-white shadow-xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text-color)]"
                  }`}
                  title="Curated flow episodes (cohesive chapters)"
                >
                  Episodes
                </button>
                <button
                  onClick={() => setIsGroupedTimeline(false)}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    !isGroupedTimeline
                      ? "bg-violet-600 text-white shadow-xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text-color)]"
                  }`}
                  title="Individual moments (ungrouped activities)"
                >
                  Moments
                </button>
              </div>
            )}

            <div className="flex items-center gap-1 shrink-0">
              {/* Smart 'Today' return pill — appears when exploring past dates */}
              {selectedDate !== getLocalDateString() && onSelectDate && (
                <button
                  onClick={() => onSelectDate(getLocalDateString())}
                  className="mr-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white border border-violet-500/30 transition-all cursor-pointer shadow-xs animate-in fade-in"
                  title="Return to Today"
                >
                  Today
                </button>
              )}

              <button
                onClick={handlePrevPeriod}
                className="p-1.5 sm:p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/30 hover:bg-zinc-500/10 text-[var(--text-muted)] hover:text-[var(--text-color)] cursor-pointer transition-all shrink-0"
                title="Previous period"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
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
                <ChevronRight className="w-3.5 h-3.5" />
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
          <div className="px-6 py-2 border-b border-[var(--border-color)] bg-[var(--bg-color)]/20">
        {activeIntention ? (
          <div className="flex items-center justify-between bg-violet-500/10 border border-violet-500/20 rounded-lg px-3.5 py-1.5 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-violet-500 shrink-0 shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">Active Focus:</span>
                <span className="text-xs text-[var(--text-color)] font-medium">{activeIntention}</span>
              </div>
            </div>
            <button
              onClick={handleStopFocus}
              className="px-2.5 py-1 bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white border border-violet-500/30 text-[11px] font-semibold rounded-md transition-all cursor-pointer"
            >
              Clear Focus
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <Target className="w-3.5 h-3.5 text-violet-500 shrink-0" />
              <input
                type="text"
                value={intentionInput}
                onChange={(e) => setIntentionInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleStartFocus() }}
                placeholder="What are you focusing on right now?"
                className="flex-1 bg-transparent border-none text-xs text-[var(--text-color)] focus:outline-none placeholder:text-[var(--text-muted)]/50 min-w-0"
              />
            </div>
            
            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto text-[11px]">
              {[
                { label: "💻 Coding", value: "Deep Coding" },
                { label: "📝 Writing", value: "Writing Documentation" },
                { label: "🔍 Research", value: "Research & Analysis" },
                { label: "🎨 Design", value: "UI Design & Polish" },
                { label: "🐛 Debugging", value: "Debugging Code" },
              ].map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => {
                    setIntentionInput(preset.value);
                  }}
                  className="px-2 py-0.5 rounded-md bg-[var(--bg-color)]/60 hover:bg-violet-500/15 border border-[var(--border-color)] hover:border-violet-500/40 text-[var(--text-muted)] hover:text-violet-400 font-medium transition-all shrink-0 cursor-pointer text-[10px]"
                >
                  {preset.label}
                </button>
              ))}
              <button
                onClick={handleStartFocus}
                disabled={!intentionInput.trim()}
                className="ml-1 px-3 py-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[11px] font-semibold rounded-md transition-colors cursor-pointer shrink-0"
              >
                Start Focus
              </button>
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
            isGrouped={isGroupedTimeline}
            onToggleGrouped={setIsGroupedTimeline}
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
