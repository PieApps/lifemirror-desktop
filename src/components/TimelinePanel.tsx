import React, { useState } from "react";
import {
  ShieldAlert, Clock, Grid, Calendar, Target, FileText
} from "lucide-react";
import { SCurveTimeline } from "./SCurveTimeline";
import { WeeklyView } from "./WeeklyView";
import { MonthlyView } from "./MonthlyView";
import { ExportJournalModal } from "./ExportJournalModal";
import type { ActivityNode, SubSessionEvent, DistractionEvent, DailySummary, HourlyMetric } from "../types";
import { getWeekRange } from "../hooks/useActivityData";
import type { ProductivityMetrics } from "../services/analytics";

interface TimelinePanelProps {
  // View state
  viewMode: "daily" | "weekly" | "monthly";
  setViewMode: (mode: "daily" | "weekly" | "monthly") => void;
  selectedDate: string;

  // Navigation
  getPeriodLabel: () => string;
  handlePrevPeriod: () => void;
  handleNextPeriod: () => void;
  isNextDisabled: () => boolean;

  // Data
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
}

export const TimelinePanel: React.FC<TimelinePanelProps> = ({
  viewMode,
  setViewMode,
  selectedDate,
  getPeriodLabel,
  handlePrevPeriod,
  handleNextPeriod,
  isNextDisabled,
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
}) => {
  const [isExportOpen, setIsExportOpen] = useState(false);

  return (
    <div className="lg:col-span-2 relative min-h-[500px] bg-[var(--card-bg)] rounded-3xl border border-[var(--border-color)] overflow-hidden flex flex-col">
      <div className="p-6 border-b border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* View Mode switcher */}
        <div className="flex bg-[var(--bg-color)]/60 dark:bg-zinc-800/40 p-1 rounded-2xl border border-[var(--border-color)] w-fit">
          <button
            onClick={() => setViewMode("daily")}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              viewMode === "daily"
                ? "bg-violet-600 text-white shadow-md shadow-violet-500/20"
                : "text-[var(--text-muted)] hover:text-[var(--text-color)]"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Day</span>
          </button>
          <button
            onClick={() => setViewMode("weekly")}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              viewMode === "weekly"
                ? "bg-violet-600 text-white shadow-md shadow-violet-500/20"
                : "text-[var(--text-muted)] hover:text-[var(--text-color)]"
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Week</span>
          </button>
          <button
            onClick={() => setViewMode("monthly")}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              viewMode === "monthly"
                ? "bg-violet-600 text-white shadow-md shadow-violet-500/20"
                : "text-[var(--text-muted)] hover:text-[var(--text-color)]"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Month</span>
          </button>
        </div>

        {/* Date Scrubber */}
        <div className="flex items-center gap-2">
          {viewMode === "daily" && (
            <button
              onClick={() => setIsExportOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 mr-2 rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400 font-semibold text-xs transition-colors hover:bg-violet-500/20 cursor-pointer"
              title="Generate Work Journal"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          )}
          {viewMode === "daily" && distractionEvents.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 mr-2 rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 dark:text-red-400 font-mono text-xs shadow-sm" title="Distractions Deflected Today">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Deflected: {distractionEvents.length}</span>
            </div>
          )}
          <button
            onClick={handlePrevPeriod}
            className="p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/30 hover:bg-zinc-500/10 text-[var(--text-muted)] hover:text-[var(--text-color)] cursor-pointer transition-all"
          >
            &larr;
          </button>
          <span className="text-xs font-bold text-[var(--text-color)] min-w-[120px] text-center font-mono">
            {getPeriodLabel()}
          </span>
          <button
            onClick={handleNextPeriod}
            disabled={isNextDisabled()}
            className="p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/30 hover:bg-zinc-500/10 text-[var(--text-muted)] hover:text-[var(--text-color)] cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            &rarr;
          </button>
        </div>
      </div>
      
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
          <div className="flex items-center gap-3">
            <Target className="w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={intentionInput}
              onChange={(e) => setIntentionInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleStartFocus() }}
              placeholder="Set an intention to enable AI distraction evaluation (e.g., 'Writing Rust code')..."
              className="flex-1 bg-transparent border-none text-sm text-[var(--text-color)] focus:outline-none placeholder:text-[var(--text-muted)]/50"
            />
            <button
              onClick={handleStartFocus}
              disabled={!intentionInput.trim()}
              className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Start Focus
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto relative">
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
            activities={[...activities].reverse()} 
            subSessionEvents={subSessionEvents}
            distractionEvents={distractionEvents}
            onAddJournal={onAddJournal} 
            onDeleteLog={onDeleteLog}
          />
        ) : viewMode === "weekly" ? (
          <div className="p-6">
            <WeeklyView
              startDate={getWeekRange(selectedDate).start}
              endDate={getWeekRange(selectedDate).end}
              summaryData={weeklySummaries}
              heatmapData={heatmapData}
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
      
      {/* Export Modal */}
      {isExportOpen && viewMode === "daily" && (
        <ExportJournalModal
          date={selectedDate}
          activities={activities}
          metrics={metrics}
          onClose={() => setIsExportOpen(false)}
        />
      )}
    </div>
  );
};
