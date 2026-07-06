import React from "react";
import { formatDuration, type ProductivityMetrics } from "../services/analytics";
import { Zap, Code, MessageCircle, AlertTriangle, Layers, TrendingUp } from "lucide-react";

interface ProductivityDashboardProps {
  metrics: ProductivityMetrics;
}

export const ProductivityDashboard: React.FC<ProductivityDashboardProps> = ({ metrics }) => {
  if (metrics.totalActiveTime === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-[var(--text-muted)] text-sm">
        <TrendingUp className="w-8 h-8 opacity-20 mb-2" />
        <p>No activity recorded for this period.</p>
      </div>
    );
  }

  // Score color logic
  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-500";
    if (score >= 75) return "text-blue-500";
    if (score >= 60) return "text-amber-500";
    return "text-rose-500";
  };

  const scoreColor = getScoreColor(metrics.score);

  return (
    <div className="flex flex-col gap-4 mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Top Header: Score */}
      <div className="flex items-center justify-between p-4 rounded-2xl glass border border-[var(--border-color)] shadow-sm">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
            Productivity Score
          </span>
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-black tracking-tight ${scoreColor}`}>
              {metrics.score}
            </span>
            <span className="text-sm font-semibold text-[var(--text-muted)]">
              / 100
            </span>
          </div>
          <span className="text-xs font-medium text-[var(--text-color)] mt-1">
            {metrics.scoreLabel}
          </span>
        </div>
        
        {/* Visual Score Ring */}
        <div className="relative w-16 h-16 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
            {/* Background ring */}
            <path
              className="text-zinc-500/20"
              strokeWidth="4"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            {/* Foreground ring */}
            <path
              className={`${scoreColor} transition-all duration-1000 ease-out`}
              strokeDasharray={`${metrics.score}, 100`}
              strokeWidth="4"
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <Zap className={`absolute w-5 h-5 ${scoreColor}`} />
        </div>
      </div>

      {/* Grid of Metrics */}
      <div className="grid grid-cols-2 gap-3">
        {/* Deep Work */}
        <div className="flex flex-col p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
          <div className="flex items-center gap-1.5 mb-1 text-violet-500">
            <Code className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Deep Work</span>
          </div>
          <span className="text-lg font-bold text-[var(--text-color)]">
            {formatDuration(metrics.deepWorkTime)}
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">
            {metrics.focusSessions} focused blocks
          </span>
        </div>

        {/* Meetings & Comms */}
        <div className="flex flex-col p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-center gap-1.5 mb-1 text-blue-500">
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Communication</span>
          </div>
          <span className="text-lg font-bold text-[var(--text-color)]">
            {formatDuration(metrics.communicationTime)}
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">
            Teams, Slack, Mail
          </span>
        </div>

        {/* Distractions */}
        <div className="flex flex-col p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
          <div className="flex items-center gap-1.5 mb-1 text-rose-500">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Distractions</span>
          </div>
          <span className="text-lg font-bold text-[var(--text-color)]">
            {formatDuration(metrics.distractionTime)}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] truncate" title={metrics.biggestDistraction}>
            {metrics.biggestDistraction ? `Mostly ${metrics.biggestDistraction}` : "Clean focus"}
          </span>
        </div>

        {/* Context Switches */}
        <div className="flex flex-col p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-1.5 mb-1 text-amber-500">
            <Layers className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Switches</span>
          </div>
          <span className="text-lg font-bold text-[var(--text-color)]">
            {metrics.contextSwitches}
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">
            App transitions
          </span>
        </div>
      </div>
    </div>
  );
};
