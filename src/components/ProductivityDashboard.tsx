import React, { useState } from "react";
import { formatDuration, type ProductivityMetrics } from "../services/analytics";
import { Zap, Code, MessageCircle, AlertTriangle, Layers, TrendingUp, X, Clock } from "lucide-react";

interface ProductivityDashboardProps {
  metrics: ProductivityMetrics;
}

export const ProductivityDashboard: React.FC<ProductivityDashboardProps> = ({ metrics }) => {
  const [activeModal, setActiveModal] = useState<"deepWork" | "communication" | "distractions" | "switches" | null>(null);


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
        <div 
          className="flex flex-col p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform hover:bg-violet-500/20"
          onClick={() => setActiveModal("deepWork")}
        >
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
        <div 
          className="flex flex-col p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform hover:bg-blue-500/20"
          onClick={() => setActiveModal("communication")}
        >
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
        <div 
          className="flex flex-col p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform hover:bg-rose-500/20"
          onClick={() => setActiveModal("distractions")}
        >
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
        <div 
          className="flex flex-col p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform hover:bg-amber-500/20"
          onClick={() => setActiveModal("switches")}
        >
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
      {/* Drill-down Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg max-h-[80vh] flex flex-col glass rounded-2xl shadow-2xl border border-[var(--border-color)] overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] shrink-0 bg-[var(--bg-color)]/80">
              <div className="flex items-center gap-2">
                {activeModal === "deepWork" && <Code className="w-5 h-5 text-violet-500" />}
                {activeModal === "communication" && <MessageCircle className="w-5 h-5 text-blue-500" />}
                {activeModal === "distractions" && <AlertTriangle className="w-5 h-5 text-rose-500" />}
                {activeModal === "switches" && <Layers className="w-5 h-5 text-amber-500" />}
                
                <h3 className="text-lg font-semibold text-[var(--text-color)]">
                  {activeModal === "deepWork" && "Deep Work Sessions"}
                  {activeModal === "communication" && "Communication"}
                  {activeModal === "distractions" && "Distractions"}
                  {activeModal === "switches" && "Context Switches"}
                </h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-zinc-500/10 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {activeModal === "deepWork" && metrics.focusBlocksList.length === 0 && (
                <div className="text-center py-8 text-[var(--text-muted)] text-sm">No deep work sessions recorded yet.</div>
              )}
              {activeModal === "deepWork" && metrics.focusBlocksList.map((block, idx) => (
                <div key={idx} className="flex flex-col p-3 rounded-xl bg-violet-500/5 border border-violet-500/10">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-[var(--text-color)] text-sm">{block.appName}</span>
                    <span className="font-mono text-xs text-violet-500 bg-violet-500/10 px-2 py-0.5 rounded">{formatDuration(block.duration)}</span>
                  </div>
                  {block.windowTitle && (
                    <span className="text-xs text-[var(--text-muted)] truncate" title={block.windowTitle}>{block.windowTitle}</span>
                  )}
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-[var(--text-muted)] opacity-70">
                    <Clock className="w-3 h-3" />
                    {new Date(block.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}

              {activeModal === "communication" && metrics.communicationBlocksList.length === 0 && (
                <div className="text-center py-8 text-[var(--text-muted)] text-sm">No communication sessions recorded yet.</div>
              )}
              {activeModal === "communication" && metrics.communicationBlocksList.map((block, idx) => (
                <div key={idx} className="flex flex-col p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-[var(--text-color)] text-sm">{block.appName}</span>
                    <span className="font-mono text-xs text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded">{formatDuration(block.duration)}</span>
                  </div>
                  {block.windowTitle && (
                    <span className="text-xs text-[var(--text-muted)] truncate" title={block.windowTitle}>{block.windowTitle}</span>
                  )}
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-[var(--text-muted)] opacity-70">
                    <Clock className="w-3 h-3" />
                    {new Date(block.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}

              {activeModal === "distractions" && metrics.distractionEventsList.length === 0 && (
                <div className="text-center py-8 text-[var(--text-muted)] text-sm">No distractions recorded. Great focus!</div>
              )}
              {activeModal === "distractions" && metrics.distractionEventsList.map((block, idx) => (
                <div key={idx} className="flex flex-col p-3 rounded-xl bg-rose-500/5 border border-rose-500/10">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-[var(--text-color)] text-sm">{block.appName}</span>
                    <span className="font-mono text-xs text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded">{formatDuration(block.duration)}</span>
                  </div>
                  {block.windowTitle && (
                    <span className="text-xs text-[var(--text-muted)] truncate" title={block.windowTitle}>{block.windowTitle}</span>
                  )}
                  {block.reason && (
                    <span className="text-xs text-rose-400/80 italic mt-1 bg-rose-500/10 px-2 py-1 rounded inline-block w-fit">"{block.reason}"</span>
                  )}
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-[var(--text-muted)] opacity-70">
                    <Clock className="w-3 h-3" />
                    {new Date(block.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}

              {activeModal === "switches" && metrics.switchEventsList.length === 0 && (
                <div className="text-center py-8 text-[var(--text-muted)] text-sm">No app switches recorded yet.</div>
              )}
              {activeModal === "switches" && metrics.switchEventsList.map((block, idx) => (
                <div key={idx} className="flex flex-col p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                  <div className="flex items-center gap-3 text-sm text-[var(--text-color)]">
                    <span className="font-semibold flex-1 truncate text-right text-[var(--text-muted)]">{block.fromApp}</span>
                    <span className="text-amber-500 shrink-0">→</span>
                    <span className="font-semibold flex-1 truncate">{block.toApp}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1 mt-2 text-[10px] text-[var(--text-muted)] opacity-70">
                    <Clock className="w-3 h-3" />
                    {new Date(block.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
