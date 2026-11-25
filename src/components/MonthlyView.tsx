import React, { useState, useMemo } from "react";
import { Clock, TrendingUp, Calendar, Sparkles, Crown, ChevronRight, Award } from "lucide-react";
import { DailySummary } from "../types";
import { mapAppToCategory, CATEGORIES, ActivityCategory } from "../utils/categoryMapper";
import { formatDuration } from "../utils/formatDuration";

interface MonthlyViewProps {
  yearMonth: string; // YYYY-MM
  summaryData: DailySummary[];
  onSelectDate?: (dateStr: string) => void;
}

export const MonthlyView: React.FC<MonthlyViewProps> = ({
  yearMonth,
  summaryData,
  onSelectDate,
}) => {
  const [hoveredRing, setHoveredRing] = useState<ActivityCategory | null>(null);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const [yearStr, monthStr] = yearMonth.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  // Calculate days in the selected month & starting day of week
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayIndex = new Date(year, month - 1, 1).getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

  const categoryDurations = useMemo(() => {
    return summaryData.reduce((acc, s) => {
      const cat = mapAppToCategory(s.app_name, "", s.source === "Browser" ? "Browser" : "");
      acc[cat] = (acc[cat] || 0) + s.total_duration;
      return acc;
    }, {} as Record<ActivityCategory, number>);
  }, [summaryData]);

  const totalMonthlySecs = useMemo(() => {
    return Object.values(categoryDurations).reduce((sum, d) => sum + d, 0);
  }, [categoryDurations]);

  // Group summary data by day of the month
  const dailyDurations = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, index) => {
      const dayNum = index + 1;
      const dateStr = `${yearMonth}-${String(dayNum).padStart(2, "0")}`;
      const daySummaries = summaryData.filter((s) => s.date === dateStr);
      const total = daySummaries.reduce((sum, s) => sum + s.total_duration, 0);
      const dateObj = new Date(year, month - 1, dayNum);
      const dayName = dateObj.toLocaleDateString([], { weekday: "short" });
      return { dayNum, dateStr, duration: total, dayName };
    });
  }, [daysInMonth, yearMonth, summaryData, year, month]);

  const maxDailyDuration = useMemo(() => {
    return Math.max(
      ...dailyDurations.map((d) => d.duration),
      3600 // minimum 1 hr scale to keep visual balance
    );
  }, [dailyDurations]);

  const activeDaysCount = useMemo(() => {
    return dailyDurations.filter((d) => d.duration > 0).length;
  }, [dailyDurations]);

  const peakDay = useMemo(() => {
    return dailyDurations.reduce(
      (best, curr) => (curr.duration > best.duration ? curr : best),
      dailyDurations[0] || { dayNum: 1, dateStr: "", duration: 0, dayName: "" }
    );
  }, [dailyDurations]);

  // Donut Ring Dimensions
  const donutRadius = 70;
  const strokeWidth = 14;
  const circ = 2 * Math.PI * donutRadius;
  const center = 90;

  // Compute donut segments
  const donutSegments = useMemo(() => {
    let accumulatedAngle = 0;
    return Object.entries(CATEGORIES).map(([key, info]) => {
      const duration = categoryDurations[key as ActivityCategory] || 0;
      const percentage = totalMonthlySecs > 0 ? duration / totalMonthlySecs : 0;
      const strokeDasharray = `${percentage * circ} ${circ}`;
      const strokeDashoffset = -accumulatedAngle;
      accumulatedAngle += percentage * circ;

      return {
        category: key as ActivityCategory,
        percentage,
        duration,
        info,
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [categoryDurations, totalMonthlySecs, circ]);

  const getMonthName = (m: number) => {
    return new Date(year, m - 1, 1).toLocaleString([], { month: "long" });
  };

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* The Biographer's Monthly Milestone Header */}
      <div className="glass rounded-3xl p-6 border border-violet-500/20 bg-gradient-to-r from-violet-950/20 via-[var(--card-bg)] to-purple-950/10 text-left relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-32 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30">
                <Calendar className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                {year} Chapter
              </span>
              <span className="text-xs text-[var(--text-muted)] font-medium">· Tapestry of Time</span>
            </div>
            <h2 className="text-xl md:text-2xl font-serif font-bold text-[var(--text-color)] tracking-tight">
              {getMonthName(month)} {year}
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xl">
              Every day is a thread in the tapestry of your life. Review your monthly flow, identify your master sessions, and drill into any day with a single click.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Total Focused */}
            <div className="bg-[var(--bg-color)]/60 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-[var(--border-color)] flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <div className="text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">Total Focused</div>
                <div className="text-sm font-bold font-mono text-[var(--text-color)]">{formatDuration(totalMonthlySecs)}</div>
              </div>
            </div>

            {/* Active Rhythm */}
            <div className="bg-[var(--bg-color)]/60 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-[var(--border-color)] flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">Active Rhythm</div>
                <div className="text-sm font-bold font-mono text-emerald-400">
                  {activeDaysCount} <span className="text-xs text-[var(--text-muted)] font-normal">/ {daysInMonth} days</span>
                </div>
              </div>
            </div>

            {/* Peak Day Badge */}
            {peakDay && peakDay.duration > 0 && (
              <div className="bg-[var(--bg-color)]/60 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-amber-500/30 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                  <Crown className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <div className="text-[10px] font-semibold tracking-wider text-amber-400/90 uppercase">Peak Flow Day</div>
                  <div className="text-sm font-bold font-mono text-[var(--text-color)]">
                    {getMonthName(month).slice(0, 3)} {peakDay.dayNum} <span className="text-xs text-amber-400/80 font-normal">({formatDuration(peakDay.duration)})</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* The Monthly Constellation: Calendar Jewel Tapestry */}
      <div className="glass rounded-3xl p-6 border border-[var(--border-color)] bg-[var(--card-bg)] text-left relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <h3 className="text-sm font-bold tracking-wider text-[var(--text-color)] uppercase">
                The Monthly Constellation
              </h3>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Luminous jewel tiles glow with the depth of your devotion. Click any day to walk through its river timeline.
            </p>
          </div>
          
          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-md bg-zinc-700/40 border border-white/5" /> Rest
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-md bg-violet-600/40 border border-violet-500/40" /> Light
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-md bg-violet-500 border border-violet-400 shadow-[0_0_8px_rgba(168,85,247,0.4)]" /> Deep Flow
            </span>
            <span className="flex items-center gap-1.5">
              <Crown className="w-3 h-3 text-amber-400" /> Masterpiece
            </span>
          </div>
        </div>

        {/* 7-Day Column Headers */}
        <div className="grid grid-cols-7 gap-2.5 mb-2 text-center select-none">
          {weekdays.map((day) => (
            <div key={day} className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Jewel Grid */}
        <div className="grid grid-cols-7 gap-2.5">
          {/* Leading empty days */}
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="min-h-[84px] rounded-2xl bg-zinc-900/10 border border-dashed border-[var(--border-color)]/30 opacity-30"
            />
          ))}

          {/* Month Days */}
          {dailyDurations.map((d) => {
            const hasFocus = d.duration > 0;
            const isPeak = peakDay && peakDay.duration > 0 && d.dayNum === peakDay.dayNum;
            const intensity = hasFocus ? Math.min(1, d.duration / maxDailyDuration) : 0;
            const isHovered = hoveredDay === d.dayNum;

            // Compute violet jewel glow styling
            const jewelBg = hasFocus
              ? `rgba(139, 92, 246, ${Math.min(0.85, 0.12 + intensity * 0.73)})`
              : "rgba(39, 39, 42, 0.25)";

            const borderStyle = isPeak
              ? "border-amber-400/70 shadow-[0_0_16px_rgba(251,191,36,0.25)]"
              : hasFocus
              ? `border-violet-500/${Math.round(25 + intensity * 60)}`
              : "border-[var(--border-color)]/60";

            return (
              <button
                key={d.dayNum}
                onClick={() => onSelectDate?.(d.dateStr)}
                onMouseEnter={() => setHoveredDay(d.dayNum)}
                onMouseLeave={() => setHoveredDay(null)}
                className={`relative min-h-[84px] p-2.5 rounded-2xl border transition-all duration-200 text-left flex flex-col justify-between group overflow-hidden ${borderStyle} ${
                  isHovered ? "scale-[1.04] -translate-y-0.5 z-20 shadow-xl border-violet-400" : "z-10"
                }`}
                style={{
                  backgroundColor: jewelBg,
                }}
              >
                {/* Subtle sheen highlight on high intensity */}
                {intensity > 0.5 && (
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 pointer-events-none" />
                )}

                {/* Day Header */}
                <div className="flex items-center justify-between w-full relative z-10">
                  <span
                    className={`text-xs font-mono font-bold ${
                      hasFocus ? "text-white" : "text-[var(--text-muted)]"
                    }`}
                  >
                    {d.dayNum}
                  </span>

                  {isPeak && (
                    <span className="flex items-center text-[10px] text-amber-300 font-bold bg-amber-500/20 px-1.5 py-0.5 rounded-md border border-amber-400/40">
                      <Crown className="w-2.5 h-2.5 mr-0.5 text-amber-300 inline" />
                      Peak
                    </span>
                  )}
                </div>

                {/* Duration & Status */}
                <div className="mt-2 relative z-10">
                  {hasFocus ? (
                    <div>
                      <div className="text-[11px] font-mono font-bold text-white drop-shadow-sm">
                        {formatDuration(d.duration)}
                      </div>
                      <div className="text-[9px] text-violet-200/80 font-medium flex items-center gap-0.5 mt-0.5 group-hover:text-white transition-colors">
                        <span>Timeline</span>
                        <ChevronRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-[var(--text-muted)]/50 font-mono italic">
                      —
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Macro Craft Pillars Breakdown Card */}
      <div className="glass rounded-3xl p-6 border border-[var(--border-color)] bg-[var(--card-bg)] text-left relative flex flex-col md:flex-row gap-8 items-center justify-between">
        <div className="flex-1 space-y-4 w-full">
          <div>
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-violet-400" />
              <h3 className="text-sm font-bold tracking-wider text-[var(--text-color)] uppercase">
                The Month's Craft Pillars
              </h3>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              How your creative energy was distributed across core domains throughout {getMonthName(month)}.
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] bg-[var(--bg-color)]/50 px-2.5 py-1.5 rounded-xl border border-[var(--border-color)] w-fit">
            <Clock className="w-3.5 h-3.5 text-violet-400" />
            <span>Total Focused: {formatDuration(totalMonthlySecs)}</span>
          </div>

          {/* List of categories with progress meters */}
          <div className="space-y-3 mt-4 pr-2">
            {donutSegments.map((seg) => (
              <div
                key={seg.category}
                className={`p-2.5 rounded-2xl border transition-all cursor-pointer ${
                  hoveredRing === seg.category
                    ? "bg-violet-500/10 border-violet-500/30 scale-[1.01]"
                    : "border-[var(--border-color)]/40 hover:bg-zinc-500/5"
                }`}
                onMouseEnter={() => setHoveredRing(seg.category)}
                onMouseLeave={() => setHoveredRing(null)}
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.info.color }} />
                    <span className="text-[var(--text-color)] font-semibold">{seg.info.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-[var(--text-color)] font-bold">{formatDuration(seg.duration)}</span>
                    <span className="text-[var(--text-muted)] text-[11px]">({Math.round(seg.percentage * 100)}%)</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-zinc-800/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.round(seg.percentage * 100)}%`,
                      backgroundColor: seg.info.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SVG Donut Ring */}
        <div className="relative w-48 h-48 shrink-0 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 180 180">
            {/* Background ring */}
            <circle
              cx={center}
              cy={center}
              r={donutRadius}
              fill="transparent"
              stroke="var(--timeline-bg-path)"
              strokeWidth={strokeWidth}
            />
            {/* Colored segments */}
            {donutSegments.map((seg) => (
              <circle
                key={seg.category}
                cx={center}
                cy={center}
                r={donutRadius}
                fill="transparent"
                stroke={seg.info.color}
                strokeWidth={strokeWidth}
                strokeDasharray={seg.strokeDasharray}
                strokeDashoffset={seg.strokeDashoffset}
                strokeLinecap={seg.percentage > 0.02 ? "round" : "butt"}
                className={`transition-all duration-300 origin-center cursor-pointer ${
                  hoveredRing === seg.category ? "stroke-[18px]" : ""
                }`}
                onMouseEnter={() => setHoveredRing(seg.category)}
                onMouseLeave={() => setHoveredRing(null)}
              />
            ))}
          </svg>

          {/* Core label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Total</span>
            <span className="text-base font-extrabold text-[var(--text-color)] font-mono mt-0.5">
              {formatDuration(totalMonthlySecs)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
