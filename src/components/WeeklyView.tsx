import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Clock, Sparkles, Sun, Moon, ChevronDown, ChevronUp } from "lucide-react";
import { DailySummary, HourlyMetric } from "../types";
import { mapAppToCategory, CATEGORIES, ActivityCategory, getCategoryOverrides } from "../utils/categoryMapper";
import { formatDuration, parseLocalDate } from "../utils/formatDuration";

interface WeeklyViewProps {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  summaryData: DailySummary[];
  heatmapData: HourlyMetric[];
  onSelectDate?: (dateStr: string) => void;
}

export const WeeklyView: React.FC<WeeklyViewProps> = ({
  startDate,
  summaryData,
  heatmapData,
  onSelectDate,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ActivityCategory | null>(null);
  const [categoryOverrides, setCategoryOverrides] = useState(getCategoryOverrides);

  useEffect(() => {
    const handleOverridesChange = () => setCategoryOverrides(getCategoryOverrides());
    window.addEventListener("category_overrides_changed", handleOverridesChange);
    return () => window.removeEventListener("category_overrides_changed", handleOverridesChange);
  }, []);

  const [hoveredStack, setHoveredStack] = useState<{
    day: string;
    app: string;
    duration: number;
    category: ActivityCategory;
    x: number; // viewport clientX
    y: number; // viewport clientY
  } | null>(null);

  const [hoveredHeatCell, setHoveredHeatCell] = useState<{
    dayName: string;
    hour: number;
    duration: number;
    x: number; // viewport clientX
    y: number; // viewport clientY
  } | null>(null);

  const [showDetailedHeatmap, setShowDetailedHeatmap] = useState(false);

  // Build the 7-day list starting at startDate.
  // IMPORTANT: parse using local date components — new Date("YYYY-MM-DD") is UTC
  // midnight which drifts one day behind in UTC+ timezones (e.g. IST +05:30).
  const getDaysOfWeek = (): string[] => {
    const days: string[] = [];
    const current = parseLocalDate(startDate);
    for (let i = 0; i < 7; i++) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, "0");
      const d = String(current.getDate()).padStart(2, "0");
      days.push(`${y}-${m}-${d}`);
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const daysOfWeek = getDaysOfWeek();
  const dayNamesShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];


  const dataByDay = daysOfWeek.reduce((acc, dateStr) => {
    const daySummaries = summaryData.filter((s) => s.date === dateStr);
    
    // Aggregate by app and map to categories
    const appMap = new Map<string, { duration: number; category: ActivityCategory }>();
    let totalSecs = 0;

    daySummaries.forEach((s) => {
      const cat = mapAppToCategory(s.app_name, "", s.source === "Browser" ? "Browser" : "", categoryOverrides);
      const existing = appMap.get(s.app_name) || { duration: 0, category: cat };
      existing.duration += s.total_duration;
      appMap.set(s.app_name, existing);
      totalSecs += s.total_duration;
    });

    // Sort apps by duration descending
    const appsSorted = Array.from(appMap.entries())
      .map(([name, val]) => ({ name, ...val }))
      .sort((a, b) => b.duration - a.duration);

    acc[dateStr] = {
      apps: appsSorted,
      totalDuration: totalSecs,
    };
    return acc;
  }, {} as Record<string, { apps: { name: string; duration: number; category: ActivityCategory }[]; totalDuration: number }>);

  // Max daily duration for scaling column heights
  const maxDailyDuration = Math.max(
    ...Object.values(dataByDay).map((d) => d.totalDuration),
    3600 // minimum 1 hour scale height to keep visual balance
  );

  // Masterpiece Day calculation
  const masterpieceEntry = useMemo(() => {
    return Object.entries(dataByDay).reduce<{ dateStr: string; duration: number } | null>(
      (best, [dateStr, data]) => {
        if (data.totalDuration > 0 && (!best || data.totalDuration > best.duration)) {
          return { dateStr, duration: data.totalDuration };
        }
        return best;
      },
      null
    );
  }, [dataByDay]);

  // Chronotype & Golden Hours Calculation
  const chronotypeData = useMemo(() => {
    let morningSecs = 0;
    let afternoonSecs = 0;
    let eveningSecs = 0;
    const hourlyTotals = new Array(24).fill(0);

    heatmapData.forEach((h) => {
      const hHour = h.hour;
      hourlyTotals[hHour] += h.total_duration;
      if (hHour >= 6 && hHour < 12) {
        morningSecs += h.total_duration;
      } else if (hHour >= 12 && hHour < 18) {
        afternoonSecs += h.total_duration;
      } else {
        eveningSecs += h.total_duration;
      }
    });

    const totalTracked = morningSecs + afternoonSecs + eveningSecs;

    let bestWindowStart = 9;
    let bestWindowSecs = 0;
    for (let i = 0; i <= 21; i++) {
      const windowSum = hourlyTotals[i] + hourlyTotals[i + 1] + hourlyTotals[i + 2];
      if (windowSum > bestWindowSecs) {
        bestWindowSecs = windowSum;
        bestWindowStart = i;
      }
    }

    const windowEnd = (bestWindowStart + 3) % 24;
    const formatHour = (hr: number) => {
      const h12 = hr % 12 === 0 ? 12 : hr % 12;
      const ampm = hr < 12 ? "AM" : "PM";
      return `${h12}:00 ${ampm}`;
    };

    const windowPct = totalTracked > 0 ? Math.round((bestWindowSecs / totalTracked) * 100) : 0;
    const morningPct = totalTracked > 0 ? Math.round((morningSecs / totalTracked) * 100) : 0;
    const afternoonPct = totalTracked > 0 ? Math.round((afternoonSecs / totalTracked) * 100) : 0;
    const eveningPct = totalTracked > 0 ? Math.max(0, 100 - morningPct - afternoonPct) : 0;

    let chronotypeInsight = "Balanced focus rhythm across the day.";
    if (morningPct >= 50) {
      chronotypeInsight = "You are an early-day architect. The majority of your creative breakthroughs occur before noon.";
    } else if (afternoonPct >= 50) {
      chronotypeInsight = "You find your deep flow in the afternoon. Post-lunch hours are your prime creative sanctuary.";
    } else if (eveningPct >= 40) {
      chronotypeInsight = "You are a night navigator. Your craft flourishes when the day turns quiet.";
    } else {
      chronotypeInsight = "Your energy flows steadily between morning exploration and afternoon deep work.";
    }

    return {
      morningSecs,
      afternoonSecs,
      eveningSecs,
      morningPct,
      afternoonPct,
      eveningPct,
      goldenWindow: `${formatHour(bestWindowStart)} – ${formatHour(windowEnd)}`,
      windowPct,
      chronotypeInsight,
      totalTracked,
    };
  }, [heatmapData]);

  // Heatmap processing
  // Days of week index 0 (Sunday) to 6 (Saturday)
  const heatmapGrid = Array.from({ length: 7 }, (_, dIndex) => {
    return Array.from({ length: 24 }, (_, hour) => {
      const match = heatmapData.find((h) => h.day_of_week === dIndex && h.hour === hour);
      return match ? match.total_duration : 0;
    });
  });

  const maxHeatmapHourSecs = Math.max(
    ...heatmapGrid.flatMap((row) => row),
    60 // minimum 1 min to avoid divide by zero
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 7-Column Stack Grid */}
      <div className="glass rounded-3xl p-6 border border-[var(--border-color)] bg-[var(--card-bg)] text-left relative">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-bold tracking-wider text-[var(--text-muted)] uppercase">Weekly Focus Distribution</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Shows absolute focus duration stacked by app categories.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {masterpieceEntry && (
              <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1.5 rounded-xl shadow-xs font-semibold">
                <span>👑</span>
                <span>
                  Masterpiece: {dayNamesShort[new Date(masterpieceEntry.dateStr).getDay()]} ({formatDuration(masterpieceEntry.duration)})
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] bg-[var(--bg-color)]/50 px-2.5 py-1.5 rounded-xl border border-[var(--border-color)]">
              <Clock className="w-3.5 h-3.5 text-violet-400" />
              <span>Total: {formatDuration(summaryData.reduce((sum, s) => sum + s.total_duration, 0))}</span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-8 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mr-1">Filter Category:</span>
          {Object.entries(CATEGORIES).map(([key, info]) => {
            const isSelected = selectedCategory === key;
            const isAnySelected = selectedCategory !== null;
            
            return (
              <button
                key={key}
                onClick={() => setSelectedCategory(isSelected ? null : (key as ActivityCategory))}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-violet-500/20 border-violet-500 text-[var(--text-color)] font-semibold shadow-sm"
                    : isAnySelected
                    ? "bg-[var(--bg-color)]/30 border-transparent text-[var(--text-muted)] opacity-50 hover:opacity-100"
                    : "bg-[var(--bg-color)]/50 border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-color)] hover:border-violet-500/40"
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: info.color }} />
                <span className="font-medium">{info.name}</span>
              </button>
            );
          })}
          {selectedCategory && (
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-[10px] font-semibold text-violet-400 hover:text-violet-300 underline ml-2 cursor-pointer"
            >
              Clear Filter
            </button>
          )}
        </div>

        {/* Custom SVG/HTML Stacked Columns */}
      <div className="h-64 flex items-end justify-between gap-4 mt-4 px-2 select-none">
        {daysOfWeek.map((dateStr) => {
          const dayData = dataByDay[dateStr];
            const dateObj = new Date(dateStr);
            const dayLabel = dayNamesShort[dateObj.getDay()];
            const dayNum = dateObj.getDate();
            const colHeightPct = (dayData.totalDuration / maxDailyDuration) * 100;

            return (
              <div 
                key={dateStr} 
                className="flex-1 flex flex-col items-center h-full group cursor-pointer transition-transform hover:scale-[1.02]"
                onClick={() => onSelectDate?.(dateStr)}
                title={`Click to view ${dayLabel}'s detailed timeline`}
              >
                {/* Masterpiece Day Crown */}
                {dateStr === masterpieceEntry?.dateStr && (
                  <div className="mb-1 flex items-center justify-center animate-bounce">
                    <span className="text-xs" title={`👑 Masterpiece Day (${formatDuration(masterpieceEntry.duration)})`}>👑</span>
                  </div>
                )}

                {/* Column wrapper */}
                <div className="w-full relative bg-[var(--bg-color)]/20 dark:bg-zinc-800/10 rounded-xl border border-[var(--border-color)] group-hover:border-violet-500/50 transition-all flex flex-col justify-end overflow-hidden" style={{ height: "80%" }}>
                  
                  {/* Empty filler if duration is 0 */}
                  {dayData.totalDuration === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] text-[var(--text-muted)] font-medium font-mono opacity-40">
                      0h
                    </div>
                  )}

                  <div className="w-full flex flex-col justify-end" style={{ height: `${colHeightPct}%` }}>
                    {dayData.apps.map((app) => {
                      const appHeightPct = (app.duration / dayData.totalDuration) * 100;
                      const catInfo = CATEGORIES[app.category];
                      const isDimmed = selectedCategory !== null && app.category !== selectedCategory;

                      return (
                        <div
                          key={app.name}
                          className={`w-full transition-all border-b border-[var(--bg-color)] last:border-0 relative ${
                            isDimmed ? "opacity-20 saturate-50" : "hover:brightness-110 active:brightness-95"
                          }`}
                          style={{
                            height: `${appHeightPct}%`,
                            backgroundColor: catInfo.color,
                          }}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredStack({
                              day: new Date(dateStr).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }),
                              app: app.name,
                              duration: app.duration,
                              category: app.category,
                              x: rect.left + rect.width / 2,
                              y: rect.top - 10,
                            });
                          }}
                          onMouseLeave={() => setHoveredStack(null)}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Date Label */}
                <div className="mt-3 text-center group-hover:text-violet-400 transition-colors">
                  <span className="block text-xs font-bold text-[var(--text-color)] group-hover:text-violet-400">{dayLabel}</span>
                  <span className="block text-[10px] text-[var(--text-muted)] font-mono">{dayNum}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Hover Stack Tooltip — Portalled to document.body to break out of CSS transform/filter containing blocks */}
        {hoveredStack && createPortal(
          <div
            className="fixed z-[99999] glass rounded-xl p-3 shadow-xl border border-[var(--border-color)] text-xs pointer-events-none transition-all duration-75 flex flex-col gap-1 select-none transform -translate-x-1/2 -translate-y-full"
            style={{ left: hoveredStack.x, top: hoveredStack.y }}
          >
            <div className="font-bold text-[var(--text-color)]">{hoveredStack.day}</div>
            <div className="flex items-center gap-1.5 font-medium mt-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORIES[hoveredStack.category].color }} />
              <span className="text-[var(--text-color)] truncate max-w-[150px]">{hoveredStack.app}</span>
            </div>
            <div className="text-[var(--text-muted)] font-mono mt-0.5">
              Duration: {formatDuration(hoveredStack.duration)}
            </div>
            <div className="text-[10px] text-violet-400 font-medium mt-1 pt-1 border-t border-[var(--border-color)]/40">
              Click column to view daily timeline
            </div>
          </div>,
          document.body
        )}
      </div>

      {/* Chronotype & Golden Focus Arc */}
      <div className="glass rounded-3xl p-6 border border-[var(--border-color)] bg-[var(--card-bg)] text-left relative space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <h3 className="text-sm font-bold tracking-wider text-[var(--text-muted)] uppercase">Focus Chronotype & Energy Arc</h3>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Reveals your biological rhythm and prime creative window across the 7-day cycle.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 rounded-xl bg-violet-600/15 border border-violet-500/30 text-violet-300 font-semibold text-xs shadow-xs">
              ⚡ Golden Window: <span className="text-white font-bold">{chronotypeData.goldenWindow}</span> ({chronotypeData.windowPct}%)
            </div>
            <button
              onClick={() => setShowDetailedHeatmap(!showDetailedHeatmap)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-color)] rounded-xl border border-[var(--border-color)] hover:bg-zinc-500/10 transition-colors cursor-pointer"
              title="Toggle detailed 24-hour matrix"
            >
              <span>{showDetailedHeatmap ? "Hide Matrix" : "Hourly Matrix"}</span>
              {showDetailedHeatmap ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* 3-Band Energy Flow Spectrum Bar */}
        <div className="space-y-2">
          <div className="h-4 w-full rounded-full overflow-hidden flex bg-[var(--bg-color)]/60 border border-[var(--border-color)] shadow-inner">
            <div
              style={{ width: `${chronotypeData.morningPct}%` }}
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500 relative group cursor-pointer"
              title={`Morning Surge (6am-12pm): ${chronotypeData.morningPct}% (${formatDuration(chronotypeData.morningSecs)})`}
            />
            <div
              style={{ width: `${chronotypeData.afternoonPct}%` }}
              className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-500 relative group cursor-pointer"
              title={`Afternoon River (12pm-6pm): ${chronotypeData.afternoonPct}% (${formatDuration(chronotypeData.afternoonSecs)})`}
            />
            <div
              style={{ width: `${chronotypeData.eveningPct}%` }}
              className="h-full bg-gradient-to-r from-sky-600 to-blue-500 transition-all duration-500 relative group cursor-pointer"
              title={`Evening & Night (6pm-6am): ${chronotypeData.eveningPct}% (${formatDuration(chronotypeData.eveningSecs)})`}
            />
          </div>

          {/* Spectrum Legend */}
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-1 px-1 flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-medium text-[var(--text-color)]">Morning Surge (6am–12pm):</span>
              <span className="font-mono font-bold text-amber-400">{chronotypeData.morningPct}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span className="font-medium text-[var(--text-color)]">Afternoon Flow (12pm–6pm):</span>
              <span className="font-mono font-bold text-violet-400">{chronotypeData.afternoonPct}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Moon className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-medium text-[var(--text-color)]">Evening & Night (6pm–6am):</span>
              <span className="font-mono font-bold text-sky-400">{chronotypeData.eveningPct}%</span>
            </div>
          </div>
        </div>

        {/* Biographer's Chronotype Observation */}
        <div className="p-3.5 rounded-2xl bg-[var(--bg-color)]/40 border border-[var(--border-color)] text-xs text-[var(--text-color)] leading-relaxed italic font-medium flex items-center gap-2.5">
          <span className="text-violet-400 font-bold not-italic font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 shrink-0">
            Biographer Insight
          </span>
          <span>"{chronotypeData.chronotypeInsight}"</span>
        </div>

        {/* Optional Collapsible 24-Hour Matrix */}
        {showDetailedHeatmap && (
          <div className="pt-4 border-t border-[var(--border-color)] animate-in fade-in duration-200">
            <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Granular 24-Hour Grid</h4>
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[700px] flex flex-col gap-1.5 select-none py-2 px-1">
                {/* Hours Header */}
                <div className="flex items-center mb-1">
                  <div className="w-12 shrink-0" />
                  <div className="flex-1 flex justify-between text-[10px] text-[var(--text-muted)] font-semibold font-mono px-1">
                    <span>00</span><span>03</span><span>06</span><span>09</span><span>12</span><span>15</span><span>18</span><span>21</span><span>23</span>
                  </div>
                </div>

                {/* Days Rows */}
                {dayNamesShort.map((dayName, dayIdx) => (
                  <div key={dayName} className="flex items-center h-6">
                    <span className="w-12 text-xs font-bold text-[var(--text-muted)] shrink-0 text-left">{dayName}</span>
                    <div className="flex-1 flex gap-1 h-full">
                      {heatmapGrid[dayIdx].map((duration, hour) => {
                        const intensity = duration > 0 ? 0.15 + (duration / maxHeatmapHourSecs) * 0.85 : 0;
                        return (
                          <div
                            key={hour}
                            className="flex-1 rounded-sm border border-[var(--border-color)]/25 dark:border-white/5 transition-all hover:scale-110 cursor-pointer"
                            style={{
                              backgroundColor: duration > 0 ? `rgba(139, 92, 246, ${intensity})` : "transparent",
                              boxShadow: duration > 0 ? `0 0 4px rgba(139, 92, 246, ${intensity * 0.25})` : "none",
                            }}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHoveredHeatCell({
                                dayName: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayIdx],
                                hour,
                                duration,
                                x: rect.left + rect.width / 2,
                                y: rect.top - 10,
                              });
                            }}
                            onMouseLeave={() => setHoveredHeatCell(null)}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Heatmap Tooltip */}
        {hoveredHeatCell && createPortal(
          <div
            className="fixed z-[99999] glass rounded-xl p-3 shadow-xl border border-[var(--border-color)] text-xs pointer-events-none transition-all duration-75 flex flex-col gap-0.5 select-none transform -translate-x-1/2 -translate-y-full"
            style={{ left: hoveredHeatCell.x, top: hoveredHeatCell.y }}
          >
            <div className="font-bold text-[var(--text-color)]">
              {hoveredHeatCell.dayName} at {String(hoveredHeatCell.hour).padStart(2, "0")}:00
            </div>
            <div className="text-[var(--text-muted)] font-mono mt-0.5">
              Active Focus: {formatDuration(hoveredHeatCell.duration)}
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};
