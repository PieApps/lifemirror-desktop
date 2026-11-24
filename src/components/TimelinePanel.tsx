import React, { useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ShieldAlert, Clock, Target, BookOpen, Maximize2, Minimize2,
  Sparkles, Download, ChevronLeft, ChevronRight, Waves, Headphones, ExternalLink, Moon, Calendar, Sunrise, Pencil
} from "lucide-react";
import { SCurveTimeline, formatCleanTitle, detectProjectContext } from "./SCurveTimeline";
import { WeeklyView } from "./WeeklyView";
import { MonthlyView } from "./MonthlyView";
import { ExportJournalModal } from "./ExportJournalModal";
import { WikiVaultView } from "./WikiVaultView";
import { EveningEpilogueModal } from "./EveningEpilogueModal";
import { FocusSoundtrackModal } from "./FocusSoundtrackModal";
import { sound } from "../utils/sound";
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
  onResumeClick?: () => void;
  isEpilogueOpen?: boolean;
  setIsEpilogueOpen?: (open: boolean) => void;
  onOpenMorningPrelude?: () => void;
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
  onResumeClick,
  isEpilogueOpen: propIsEpilogueOpen,
  setIsEpilogueOpen: propSetIsEpilogueOpen,
  onOpenMorningPrelude,
}) => {
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [mainTab, setMainTab] = useState<"timeline" | "vault">("timeline");
  const [isGeneratingPeriodNote, setIsGeneratingPeriodNote] = useState(false);
  const [isGroupedTimeline, setIsGroupedTimeline] = useState<boolean>(true);
  const [initialVaultFile, setInitialVaultFile] = useState<string | undefined>(undefined);
  const [localIsEpilogueOpen, setLocalIsEpilogueOpen] = useState(false);
  const isEpilogueOpen = propIsEpilogueOpen !== undefined ? propIsEpilogueOpen : localIsEpilogueOpen;
  const setIsEpilogueOpen = propSetIsEpilogueOpen !== undefined ? propSetIsEpilogueOpen : setLocalIsEpilogueOpen;
  const [lastSynthesizedMarkdown, setLastSynthesizedMarkdown] = useState<string | undefined>(undefined);
  const [isSoundtrackModalOpen, setIsSoundtrackModalOpen] = useState(false);
  const [soundtrackTitle, setSoundtrackTitle] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("lifemirror_soundtrack_title") || "Focus Soundtrack";
    }
    return "Focus Soundtrack";
  });

  // Synthesize curated project chapters for the Evening Epilogue ceremony
  const epilogueChapters = useMemo(() => {
    if (!activities || activities.length === 0) return [];
    const projectMap = new Map<string, { duration: number; apps: Set<string>; primaryTitle: string }>();

    activities.forEach(act => {
      const proj = detectProjectContext([act], []);
      const cleanTitle = formatCleanTitle(act.window_title, act.app_name, act.domain_tag, act.url);
      const key = proj || act.app_name || "Creative Flow";

      const existing = projectMap.get(key) || {
        duration: 0,
        apps: new Set<string>(),
        primaryTitle: proj ? `${proj} · ${cleanTitle}` : cleanTitle,
      };
      existing.duration += (act.duration || 60);
      if (act.app_name) existing.apps.add(act.app_name);
      projectMap.set(key, existing);
    });

    return Array.from(projectMap.entries())
      .sort((a, b) => b[1].duration - a[1].duration)
      .slice(0, 5)
      .map(([_, val]) => ({
        window_title: val.primaryTitle,
        app_name: Array.from(val.apps).join(", ") || "Active Craft",
        duration: val.duration,
        tools: Array.from(val.apps),
        toolsCount: val.apps.size,
      }));
  }, [activities]);

  const handleGeneratePeriodNote = async () => {
    setIsGeneratingPeriodNote(true);
    try {
      const pType = viewMode === "monthly" ? "month" : viewMode === "weekly" ? "week" : "day";
      const relPath = await invoke<string>("compile_period_note", {
        periodType: pType,
        dateKey: selectedDate,
      });
      setInitialVaultFile(relPath);

      if (pType === "day" || pType === "week") {
        try {
          const vaultContent = await invoke<string>("read_vault_file", { relativePath: relPath });
          setLastSynthesizedMarkdown(vaultContent);
        } catch (readErr) {
          console.warn("Could not read synthesized note for epilogue:", readErr);
        }
        setIsEpilogueOpen(true);
      } else {
        setMainTab("vault");
      }
    } catch (err) {
      console.error("Failed to compile periodic note:", err);
    } finally {
      setIsGeneratingPeriodNote(false);
    }
  };

  return (
    <div className="timeline-panel-wrapper relative min-h-[350px] sm:min-h-0 sm:h-full bg-[var(--card-bg)] rounded-3xl border border-[var(--border-color)] overflow-hidden flex flex-col">
      <div className="p-3 sm:px-5 sm:py-3.5 border-b border-[var(--border-color)] flex flex-wrap items-center justify-between gap-3">
        {/* Main Navigation & Temporal Baton */}
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
            <div className="flex items-center bg-[var(--bg-color)]/60 dark:bg-zinc-800/40 p-1 rounded-2xl border border-[var(--border-color)] shrink-0 gap-1">
              <div className="flex items-center">
                <button
                  onClick={() => setViewMode("daily")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                    viewMode === "daily"
                      ? "bg-violet-600 text-white shadow-xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text-color)]"
                  }`}
                  title="Daily River Timeline"
                >
                  <Calendar className="w-3 h-3 shrink-0" />
                  <span>Day</span>
                </button>
                <button
                  onClick={() => setViewMode("weekly")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                    viewMode === "weekly"
                      ? "bg-violet-600 text-white shadow-xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text-color)]"
                  }`}
                  title="Weekly Focus Distribution"
                >
                  Week
                </button>
                <button
                  onClick={() => setViewMode("monthly")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                    viewMode === "monthly"
                      ? "bg-violet-600 text-white shadow-xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text-color)]"
                  }`}
                  title="Monthly Focus Overview"
                >
                  Month
                </button>
              </div>

              <div className="h-4 w-px bg-[var(--border-color)] mx-1" />

              <div className="flex items-center gap-1">
                {selectedDate !== getLocalDateString() && onSelectDate && (
                  <button
                    onClick={() => onSelectDate(getLocalDateString())}
                    className="px-2 py-0.5 text-[11px] font-semibold rounded-lg bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white border border-violet-500/30 transition-all cursor-pointer shadow-xs animate-in fade-in"
                    title="Return to Today"
                  >
                    Today
                  </button>
                )}

                <button
                  onClick={handlePrevPeriod}
                  className="p-1 rounded-lg hover:bg-zinc-500/10 text-[var(--text-muted)] hover:text-[var(--text-color)] cursor-pointer transition-all"
                  title="Previous period"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-bold text-[var(--text-color)] min-w-[125px] text-center font-mono whitespace-nowrap select-none px-1">
                  {getPeriodLabel()}
                </span>
                <button
                  onClick={handleNextPeriod}
                  disabled={isNextDisabled()}
                  className="p-1 rounded-lg hover:bg-zinc-500/10 text-[var(--text-muted)] hover:text-[var(--text-color)] cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Next period"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Jewel (Only shown in Timeline mode) */}
        {mainTab === "timeline" && (
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            {/* Unified Hero Action Jewel */}
            <button
              onClick={handleGeneratePeriodNote}
              disabled={isGeneratingPeriodNote}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border font-semibold text-xs transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-xs ${
                viewMode === "daily"
                  ? "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 shadow-amber-500/10"
                  : "border-violet-500/30 bg-violet-600/20 hover:bg-violet-600 text-violet-200 hover:text-white shadow-violet-500/20"
              }`}
              title={
                viewMode === "daily"
                  ? "Synthesize today's chapters and open the Evening Epilogue closure ceremony"
                  : `Synthesize and compile ${viewMode === "weekly" ? "Week" : "Month"} Note into Vault`
              }
            >
              {isGeneratingPeriodNote ? (
                <div
                  className={`w-3.5 h-3.5 border-2 ${
                    viewMode === "daily" ? "border-amber-400" : "border-violet-400"
                  } border-t-transparent rounded-full animate-spin shrink-0`}
                />
              ) : viewMode === "daily" ? (
                <Moon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              )}
              <span className="whitespace-nowrap font-medium">
                {isGeneratingPeriodNote
                  ? "Synthesizing..."
                  : viewMode === "monthly"
                  ? "✨ Synthesize Month"
                  : viewMode === "weekly"
                  ? "✨ Synthesize Week"
                  : "🌅 Evening Epilogue"}
              </span>
            </button>

            {/* Utility Capsule: Zen and Export */}
            <div className="flex items-center gap-1 bg-[var(--bg-color)]/60 dark:bg-zinc-800/40 p-1 rounded-2xl border border-[var(--border-color)] shrink-0">
              {onToggleZenMode && (
                <button
                  onClick={() => {
                    sound.playTactileTick();
                    onToggleZenMode();
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-xl transition-all text-xs font-semibold cursor-pointer whitespace-nowrap ${
                    isZenMode
                      ? "bg-violet-600 text-white shadow-md shadow-violet-500/25"
                      : "text-[var(--text-muted)] hover:text-[var(--text-color)]"
                  }`}
                  title={isZenMode ? "Exit Zen Mode (⌘D / Ctrl+D)" : "Zen Mode (⌘D / Ctrl+D) — Expand Timeline"}
                >
                  {isZenMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  <span className="hidden md:inline whitespace-nowrap">Zen</span>
                </button>
              )}

              <button
                onClick={() => setIsExportOpen(true)}
                className="p-1.5 rounded-xl hover:bg-zinc-500/10 text-[var(--text-muted)] hover:text-[var(--text-color)] transition-all cursor-pointer shrink-0"
                title="Export Work Journal (Markdown, CSV, JSON)"
              >
                <Download className="w-3.5 h-3.5" />
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
          {/* Ambient Flow Sensing & Focus Ember */}
          <div className="px-5 py-2.5 border-b border-[var(--border-color)] bg-[var(--bg-color)]/20">
            {activeIntention ? (
              <div className="flex items-center justify-between bg-violet-500/10 border border-violet-500/30 rounded-xl px-4 py-2 shadow-sm animate-in fade-in">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative flex items-center justify-center shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.8)] animate-pulse" />
                    <div className="absolute w-5 h-5 rounded-full bg-violet-500/20 animate-ping" />
                  </div>
                  <div className="flex items-baseline gap-2 truncate">
                    <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider shrink-0">Active Focus:</span>
                    <span className="text-xs text-[var(--text-color)] font-semibold truncate">{activeIntention}</span>
                    {onOpenMorningPrelude && (
                      <button
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          onOpenMorningPrelude();
                        }}
                        className="p-1 hover:bg-violet-500/20 text-violet-300 hover:text-white rounded-md transition-colors cursor-pointer shrink-0 ml-0.5"
                        title="Refine Intention in Morning Prelude"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Focus Soundtrack Companion */}
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      setIsSoundtrackModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/60 hover:bg-zinc-800 border border-violet-500/25 text-zinc-300 hover:text-white text-[11px] font-medium transition-all cursor-pointer shadow-xs"
                    title="Focus Soundtrack (YouTube, Spotify, or Local Media)"
                  >
                    <Headphones className="w-3.5 h-3.5 text-violet-400" />
                    <span className="truncate max-w-[140px]">{soundtrackTitle}</span>
                    <ExternalLink className="w-2.5 h-2.5 text-zinc-500" />
                  </button>

                  <button
                    onClick={() => {
                      sound.playClearFocus();
                      handleStopFocus();
                    }}
                    className="px-3 py-1 bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white border border-violet-500/40 text-[11px] font-semibold rounded-lg transition-all cursor-pointer shrink-0 shadow-xs"
                  >
                    Clear Focus
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                {/* Ambient Flow Sensing Indicator */}
                <div className="hidden md:flex items-center gap-2 text-xs text-[var(--text-muted)] shrink-0 min-w-0 max-w-[55%]">
                  <Waves className="w-3.5 h-3.5 text-violet-400 shrink-0 animate-pulse" />
                  {activities.length > 0 ? (
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="truncate">
                        <span className="text-[var(--text-muted)]">Flowing in </span>
                        <span className="font-semibold text-violet-400">{activities[0].app_name}</span>
                        <span className="mx-1 text-[var(--text-muted)]/60">·</span>
                        <span className="text-[var(--text-color)]/90">
                          {formatCleanTitle(activities[0].window_title, activities[0].app_name, activities[0].domain_tag, activities[0].url)}
                        </span>
                      </div>
                      {onResumeClick && (
                        <button
                          onClick={() => {
                            sound.playTactileTick();
                            onResumeClick();
                          }}
                          className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-violet-600/15 hover:bg-violet-600/25 border border-violet-500/30 text-violet-300 hover:text-white text-[10px] font-semibold transition-all cursor-pointer shadow-xs shrink-0"
                          title="Reconstruct context and pick up where you left off"
                        >
                          <Sparkles className="w-3 h-3 text-violet-400" />
                          <span>Resume Flow</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="italic text-[var(--text-muted)]/70">Tranquil River · Ready when you are</span>
                  )}
                </div>

                {/* Serene Intention Input */}
                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                  {/* Focus Soundtrack Launcher */}
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      setIsSoundtrackModalOpen(true);
                    }}
                    className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900/40 hover:bg-zinc-900/80 border border-white/5 hover:border-violet-500/30 text-zinc-400 hover:text-white text-xs font-medium transition-all cursor-pointer shrink-0"
                    title="Launch external focus soundtrack (YouTube, Spotify, or Local Media)"
                  >
                    <Headphones className="w-3.5 h-3.5 text-violet-400" />
                    <span>Soundtrack</span>
                    <ExternalLink className="w-2.5 h-2.5 text-zinc-500" />
                  </button>

                  {onOpenMorningPrelude && (
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        onOpenMorningPrelude();
                      }}
                      className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:text-amber-200 text-xs font-semibold transition-all cursor-pointer shadow-xs shrink-0"
                      title="Set Today's Intention with Morning Prelude"
                    >
                      <Sunrise className="w-3.5 h-3.5 text-amber-400" />
                      <span>Morning Prelude</span>
                    </button>
                  )}

                  <div className="flex items-center gap-2 bg-[var(--bg-color)]/60 dark:bg-zinc-800/40 border border-[var(--border-color)] px-3 py-1.5 rounded-xl flex-1 max-w-md focus-within:border-violet-500/50 transition-colors">
                    <Target className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                    <input
                      type="text"
                      value={intentionInput}
                      onChange={(e) => setIntentionInput(e.target.value)}
                      onKeyDown={(e) => { 
                        if (e.key === "Enter" && intentionInput.trim()) {
                          sound.playIgniteFocus();
                          handleStartFocus();
                        }
                      }}
                      placeholder="Guiding intention for this session? (Enter to ignite)"
                      className="flex-1 bg-transparent border-none text-xs text-[var(--text-color)] focus:outline-none placeholder:text-[var(--text-muted)]/50 min-w-0"
                    />
                  </div>
                  <button
                    onClick={() => {
                      sound.playIgniteFocus();
                      handleStartFocus();
                    }}
                    disabled={!intentionInput.trim()}
                    className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shrink-0 shadow-xs"
                  >
                    Ignite Focus
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
            onResumeClick={onResumeClick}
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
              onSelectDate={(dateStr) => {
                if (onSelectDate) onSelectDate(dateStr);
                setViewMode("daily");
              }}
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

      {/* Floating Sanctum HUD in Zen Mode */}
      {isZenMode && (
        <div className="fixed top-4 inset-x-0 z-50 flex items-center justify-center pointer-events-none animate-in fade-in slide-in-from-top-3 duration-300">
          <div className="pointer-events-auto flex items-center gap-3 px-4 py-2 rounded-2xl border border-violet-500/30 shadow-2xl backdrop-blur-xl bg-[var(--card-bg)]/90 text-xs">
            {/* Focus Soundtrack Companion Pill */}
            <button
              onClick={() => {
                sound.playClick();
                setIsSoundtrackModalOpen(true);
              }}
              className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-xs font-medium text-violet-300 transition-colors cursor-pointer"
              title="Focus Soundtrack Companion"
            >
              <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
              <Headphones className="w-3.5 h-3.5 text-violet-400" />
              <span className="truncate max-w-[140px] font-semibold">{soundtrackTitle}</span>
            </button>

            <div className="h-4 w-px bg-[var(--border-color)]" />

            {/* Intention Capsule */}
            <div className="flex items-center gap-1.5 px-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-[var(--text-color)] font-mono">
                {activeIntention ? activeIntention : "Deep Flow Sanctum"}
              </span>
            </div>

            <div className="h-4 w-px bg-[var(--border-color)]" />

            {/* Exit Zen Button */}
            {onToggleZenMode && (
              <button
                onClick={() => {
                  sound.playTactileTick();
                  onToggleZenMode();
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-all cursor-pointer shadow-xs"
                title="Exit Zen Mode (⌘D / Esc)"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Exit (⌘D)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Evening Epilogue / Weekly Tapestry Postcard Modal */}
      {isEpilogueOpen && (
        <EveningEpilogueModal
          isOpen={isEpilogueOpen}
          periodType={viewMode === "weekly" ? "week" : viewMode === "monthly" ? "month" : "day"}
          dateStr={selectedDate}
          activitiesCount={activities.length}
          episodesCount={epilogueChapters.length > 0 ? epilogueChapters.length : (subSessionEvents.length > 0 ? subSessionEvents.length : activities.length)}
          totalFocusSeconds={metrics.totalActiveTime || 0}
          synthesisMarkdown={lastSynthesizedMarkdown}
          episodes={epilogueChapters}
          onClose={() => setIsEpilogueOpen(false)}
          onOpenVaultFile={() => {
            setIsEpilogueOpen(false);
            setMainTab("vault");
          }}
        />
      )}

      {/* Focus Soundtrack Companion Modal */}
      {isSoundtrackModalOpen && (
        <FocusSoundtrackModal
          isOpen={isSoundtrackModalOpen}
          onClose={() => setIsSoundtrackModalOpen(false)}
          onSelectSoundtrackTitle={(title) => setSoundtrackTitle(title)}
        />
      )}
    </div>
  );
};
