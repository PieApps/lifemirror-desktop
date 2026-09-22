import React, { useState } from "react";
import { Clock, TrendingUp } from "lucide-react";
import { DailySummary } from "../types";
import { mapAppToCategory, CATEGORIES, ActivityCategory } from "../utils/categoryMapper";
import { formatDuration } from "../utils/formatDuration";

interface MonthlyViewProps {
  yearMonth: string; // YYYY-MM
  summaryData: DailySummary[];
}

export const MonthlyView: React.FC<MonthlyViewProps> = ({ yearMonth, summaryData }) => {
  const [hoveredRing, setHoveredRing] = useState<ActivityCategory | null>(null);
  const [hoveredTrendPoint, setHoveredTrendPoint] = useState<{
    dayNum: number;
    duration: number;
    x: number;
    y: number;
  } | null>(null);

  const [yearStr, monthStr] = yearMonth.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  // Calculate days in the selected month
  const daysInMonth = new Date(year, month, 0).getDate();


  const categoryDurations = summaryData.reduce((acc, s) => {
    const cat = mapAppToCategory(s.app_name, "", s.source === "Browser" ? "Browser" : "");
    acc[cat] = (acc[cat] || 0) + s.total_duration;
    return acc;
  }, {} as Record<ActivityCategory, number>);

  const totalMonthlySecs = Object.values(categoryDurations).reduce((sum, d) => sum + d, 0);

  // Group summary data by day of the month
  const dailyDurations = Array.from({ length: daysInMonth }, (_, index) => {
    const dayNum = index + 1;
    const dateStr = `${yearMonth}-${String(dayNum).padStart(2, "0")}`;
    const daySummaries = summaryData.filter((s) => s.date === dateStr);
    const total = daySummaries.reduce((sum, s) => sum + s.total_duration, 0);
    return { dayNum, duration: total };
  });

  const maxDailyDuration = Math.max(
    ...dailyDurations.map((d) => d.duration),
    3600 // minimum 1 hr scale to keep visual balance
  );

  // Donut Ring Dimensions
  const donutRadius = 70;
  const strokeWidth = 14;
  const circ = 2 * Math.PI * donutRadius;
  const center = 90;

  // Compute donut segments
  let accumulatedAngle = 0;
  const donutSegments = Object.entries(CATEGORIES).map(([key, info]) => {
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

  // Trend Chart Dimensions
  const svgWidth = 650;
  const svgHeight = 150;
  const paddingX = 20;
  const paddingY = 15;

  const chartWidth = svgWidth - 2 * paddingX;
  const chartHeight = svgHeight - 2 * paddingY;
  const stepX = chartWidth / (daysInMonth - 1);

  // Map daily points to SVG coordinates
  const trendPoints = dailyDurations.map((d) => {
    const x = paddingX + (d.dayNum - 1) * stepX;
    const pct = d.duration / maxDailyDuration;
    // Invert Y axis for SVG rendering
    const y = paddingY + chartHeight - pct * chartHeight;
    return { ...d, x, y };
  });

  // Generate SVG path for line
  const generateLinePath = () => {
    if (trendPoints.length === 0) return "";
    let d = `M ${trendPoints[0].x} ${trendPoints[0].y}`;
    for (let i = 1; i < trendPoints.length; i++) {
      const p = trendPoints[i];
      const prev = trendPoints[i - 1];
      // Use smooth cubic bezier curve calculation
      const cpX1 = prev.x + stepX / 2;
      const cpY1 = prev.y;
      const cpX2 = p.x - stepX / 2;
      const cpY2 = p.y;
      d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p.x} ${p.y}`;
    }
    return d;
  };

  // Generate SVG path for area fill
  const generateAreaPath = () => {
    const linePath = generateLinePath();
    if (!linePath) return "";
    return `${linePath} L ${trendPoints[trendPoints.length - 1].x} ${paddingY + chartHeight} L ${trendPoints[0].x} ${paddingY + chartHeight} Z`;
  };

  const getMonthName = (m: number) => {
    // Use the actual `year` from the parsed yearMonth prop — not a hardcoded constant.
    return new Date(year, m - 1, 1).toLocaleString([], { month: "long" });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Macro Category Rings Card */}
      <div className="glass rounded-3xl p-6 border border-[var(--border-color)] bg-[var(--card-bg)] text-left relative flex flex-col md:flex-row gap-8 items-center justify-between">
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-sm font-bold tracking-wider text-[var(--text-muted)] uppercase">Monthly Categorical Mirror</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Summarizes total time spent in each category for {getMonthName(month)} {year}.
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] bg-[var(--bg-color)]/50 px-2.5 py-1.5 rounded-xl border border-[var(--border-color)] w-fit">
            <Clock className="w-3.5 h-3.5 text-violet-400" />
            <span>Total Focused: {formatDuration(totalMonthlySecs)}</span>
          </div>

          {/* List of categories with summaries */}
          <div className="space-y-3 mt-4 pr-4">
            {donutSegments.map((seg) => (
              <div
                key={seg.category}
                className={`flex items-center justify-between text-xs p-2 rounded-xl border transition-all cursor-pointer ${
                  hoveredRing === seg.category
                    ? "bg-violet-500/10 border-violet-500/30 scale-[1.02]"
                    : "border-transparent hover:bg-zinc-500/5"
                }`}
                onMouseEnter={() => setHoveredRing(seg.category)}
                onMouseLeave={() => setHoveredRing(null)}
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: seg.info.color }} />
                  <span className="text-[var(--text-color)] font-semibold">{seg.info.name}</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-[var(--text-color)] font-bold">{formatDuration(seg.duration)}</span>
                  <span className="text-[var(--text-muted)]">({Math.round(seg.percentage * 100)}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SVG Donut Ring */}
        <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
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

      {/* Monthly Trend Curve Card */}
      <div className="glass rounded-3xl p-6 border border-[var(--border-color)] bg-[var(--card-bg)] text-left relative">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-bold tracking-wider text-[var(--text-muted)] uppercase">Productivity Trend Line</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Tracks day-over-day focus time variation across the calendar month.
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-500 font-semibold bg-emerald-500/10 px-2 py-1 rounded-lg">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Active Days: {dailyDurations.filter((d) => d.duration > 0).length}</span>
          </div>
        </div>

        {/* Dynamic SVG Trend Line */}
        <div className="relative w-full overflow-x-auto select-none pb-2">
          <svg className="w-full min-w-[650px] overflow-visible" height={svgHeight}>
            <defs>
              {/* Line gradient */}
              <linearGradient id="trend-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid baseline */}
            <line
              x1={paddingX}
              y1={paddingY + chartHeight}
              x2={paddingX + chartWidth}
              y2={paddingY + chartHeight}
              stroke="var(--border-color)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />

            {/* Midline */}
            <line
              x1={paddingX}
              y1={paddingY + chartHeight / 2}
              x2={paddingX + chartWidth}
              y2={paddingY + chartHeight / 2}
              stroke="var(--border-color)"
              strokeWidth="0.5"
              strokeDasharray="4 4"
              className="opacity-50"
            />

            {/* Shaded Area path */}
            {trendPoints.length > 0 && (
              <path
                d={generateAreaPath()}
                fill="url(#trend-grad)"
              />
            )}

            {/* Core Line path */}
            {trendPoints.length > 0 && (
              <path
                d={generateLinePath()}
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="3"
                strokeLinecap="round"
                className="timeline-glow"
              />
            )}

            {/* Interactive Data points circles */}
            {trendPoints.map((p) => {
              if (p.duration === 0) return null;
              const isHovered = hoveredTrendPoint?.dayNum === p.dayNum;
              return (
                <circle
                  key={p.dayNum}
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 6 : 4}
                  fill={isHovered ? "#ffffff" : "#8b5cf6"}
                  stroke="#8b5cf6"
                  strokeWidth={isHovered ? 3 : 1.5}
                  className="cursor-pointer transition-all duration-150"
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const parentRect = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
                    setHoveredTrendPoint({
                      dayNum: p.dayNum,
                      duration: p.duration,
                      x: rect.left - (parentRect?.left || 0) + rect.width / 2,
                      y: rect.top - (parentRect?.top || 0) - 8,
                    });
                  }}
                  onMouseLeave={() => setHoveredTrendPoint(null)}
                />
              );
            })}
          </svg>
        </div>

        {/* X Axis ticks */}
        <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono font-semibold mt-2 px-4 select-none">
          <span>1</span>
          <span>{Math.floor(daysInMonth / 4)}</span>
          <span>{Math.floor(daysInMonth / 2)}</span>
          <span>{Math.floor((daysInMonth * 3) / 4)}</span>
          <span>{daysInMonth}</span>
        </div>

        {/* Trend Tooltip */}
        {hoveredTrendPoint && (
          <div
            className="absolute z-50 glass rounded-xl p-3 shadow-xl border border-[var(--border-color)] text-xs pointer-events-none transition-all duration-100 flex flex-col gap-0.5 select-none transform -translate-x-1/2 -translate-y-full"
            style={{ left: hoveredTrendPoint.x, top: hoveredTrendPoint.y }}
          >
            <div className="font-bold text-[var(--text-color)]">
              {getMonthName(month)} {hoveredTrendPoint.dayNum}, {year}
            </div>
            <div className="text-[var(--text-muted)] font-mono mt-0.5">
              Focus Duration: {formatDuration(hoveredTrendPoint.duration)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
