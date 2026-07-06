import React, { useState } from "react";
import { Clock } from "lucide-react";
import { DailySummary, HourlyMetric } from "../types";
import { mapAppToCategory, CATEGORIES, ActivityCategory } from "../utils/categoryMapper";

interface WeeklyViewProps {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  summaryData: DailySummary[];
  heatmapData: HourlyMetric[];
}

export const WeeklyView: React.FC<WeeklyViewProps> = ({
  startDate,
  summaryData,
  heatmapData,
}) => {
  const [hoveredStack, setHoveredStack] = useState<{
    day: string;
    app: string;
    duration: number;
    category: ActivityCategory;
    x: number;
    y: number;
  } | null>(null);

  const [hoveredHeatCell, setHoveredHeatCell] = useState<{
    dayName: string;
    hour: number;
    duration: number;
    x: number;
    y: number;
  } | null>(null);

  // Generate date list for the week (7 days) starting at startDate
  const getDaysOfWeek = (): string[] => {
    const days: string[] = [];
    const current = new Date(startDate);
    for (let i = 0; i < 7; i++) {
      days.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const daysOfWeek = getDaysOfWeek();
  const dayNamesShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Helper to format duration
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) {
      const remainingMins = mins % 60;
      return remainingMins > 0 ? `${hrs}h ${remainingMins}m` : `${hrs}h`;
    }
    return `${mins}m`;
  };

  // Group summary data by local date
  const dataByDay = daysOfWeek.reduce((acc, dateStr) => {
    const daySummaries = summaryData.filter((s) => s.date === dateStr);
    
    // Aggregate by app and map to categories
    const appMap = new Map<string, { duration: number; category: ActivityCategory }>();
    let totalSecs = 0;

    daySummaries.forEach((s) => {
      const cat = mapAppToCategory(s.app_name, "", s.source === "Browser" ? "Browser" : "");
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-bold tracking-wider text-[var(--text-muted)] uppercase">Weekly Focus Distribution</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Shows absolute focus duration stacked by app categories.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] bg-[var(--bg-color)]/50 px-2.5 py-1.5 rounded-xl border border-[var(--border-color)]">
            <Clock className="w-3.5 h-3.5 text-violet-400" />
            <span>Total: {formatDuration(summaryData.reduce((sum, s) => sum + s.total_duration, 0))}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 mb-8 text-xs">
          {Object.entries(CATEGORIES).map(([key, info]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: info.color }} />
              <span className="text-[var(--text-muted)] font-medium">{info.name}</span>
            </div>
          ))}
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
              <div key={dateStr} className="flex-1 flex flex-col items-center h-full group">
                {/* Column wrapper */}
                <div className="w-full relative bg-[var(--bg-color)]/20 dark:bg-zinc-800/10 rounded-xl border border-[var(--border-color)] hover:border-violet-500/30 transition-all flex flex-col justify-end overflow-hidden cursor-pointer" style={{ height: "80%" }}>
                  
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

                      return (
                        <div
                          key={app.name}
                          className="w-full transition-all hover:brightness-110 active:brightness-95 border-b border-[var(--bg-color)] last:border-0 relative"
                          style={{
                            height: `${appHeightPct}%`,
                            backgroundColor: catInfo.color,
                          }}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const parentRect = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
                            setHoveredStack({
                              day: new Date(dateStr).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }),
                              app: app.name,
                              duration: app.duration,
                              category: app.category,
                              x: rect.left - (parentRect?.left || 0) + rect.width / 2,
                              y: rect.top - (parentRect?.top || 0) - 10,
                            });
                          }}
                          onMouseLeave={() => setHoveredStack(null)}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Date Label */}
                <div className="mt-3 text-center">
                  <span className="block text-xs font-bold text-[var(--text-color)]">{dayLabel}</span>
                  <span className="block text-[10px] text-[var(--text-muted)] font-mono">{dayNum}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Hover Stack Tooltip */}
        {hoveredStack && (
          <div
            className="absolute z-50 glass rounded-xl p-3 shadow-xl border border-[var(--border-color)] text-xs pointer-events-none transition-all duration-100 flex flex-col gap-1 select-none transform -translate-x-1/2 -translate-y-full"
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
          </div>
        )}
      </div>

      {/* Focus Heatmap (Days x Hours) */}
      <div className="glass rounded-3xl p-6 border border-[var(--border-color)] bg-[var(--card-bg)] text-left relative">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold tracking-wider text-[var(--text-muted)] uppercase">Peak Focus Heatmap</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Identifies daily peak focus hours throughout the week (00:00 - 23:00).
            </p>
          </div>
        </div>

        {/* Heatmap Grid Wrapper */}
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[700px] flex flex-col gap-1.5 select-none py-2 px-1">
            {/* Hours Header */}
            <div className="flex items-center mb-1">
              <div className="w-12 shrink-0" />
              <div className="flex-1 flex justify-between text-[10px] text-[var(--text-muted)] font-semibold font-mono px-1">
                <span>00</span>
                <span>03</span>
                <span>06</span>
                <span>09</span>
                <span>12</span>
                <span>15</span>
                <span>18</span>
                <span>21</span>
                <span>23</span>
              </div>
            </div>

            {/* Days Rows */}
            {dayNamesShort.map((dayName, dayIdx) => (
              <div key={dayName} className="flex items-center h-6">
                {/* Day label */}
                <span className="w-12 text-xs font-bold text-[var(--text-muted)] shrink-0 text-left">
                  {dayName}
                </span>

                {/* Hour block cells */}
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
                          const parentRect = e.currentTarget.parentElement?.parentElement?.parentElement?.getBoundingClientRect();
                          setHoveredHeatCell({
                            dayName: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayIdx],
                            hour,
                            duration,
                            x: rect.left - (parentRect?.left || 0) + rect.width / 2,
                            y: rect.top - (parentRect?.top || 0) - 10,
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

        {/* Heatmap Tooltip */}
        {hoveredHeatCell && (
          <div
            className="absolute z-50 glass rounded-xl p-3 shadow-xl border border-[var(--border-color)] text-xs pointer-events-none transition-all duration-100 flex flex-col gap-0.5 select-none transform -translate-x-1/2 -translate-y-full"
            style={{ left: hoveredHeatCell.x, top: hoveredHeatCell.y }}
          >
            <div className="font-bold text-[var(--text-color)]">{hoveredHeatCell.dayName}</div>
            <div className="text-[var(--text-color)] font-medium mt-1 font-mono">
              Hour: {String(hoveredHeatCell.hour).padStart(2, "0")}:00 - {String(hoveredHeatCell.hour).padStart(2, "0")}:59
            </div>
            <div className="text-[var(--text-muted)] font-mono mt-0.5">
              Active Focus: {formatDuration(hoveredHeatCell.duration)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
