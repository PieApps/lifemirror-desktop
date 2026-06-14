import React from "react";
import { Monitor, Globe, Clock, Plus } from "lucide-react";

export interface ActivityNode {
  id: number;
  app_name: String;
  window_title: String;
  start_time: string;
  duration: number;
  source: string;
  url?: string;
}

interface SCurveTimelineProps {
  activities: ActivityNode[];
  onAddJournal: (activity: ActivityNode) => void;
}

export const SCurveTimeline: React.FC<SCurveTimelineProps> = ({ activities, onAddJournal }) => {
  const rowHeight = 160;
  const width = 800;

  // Generate continuous cubic Bézier path for the S-Curve
  const generatePath = () => {
    if (activities.length === 0) return `M ${width / 2} 0 L ${width / 2} 400`;
    
    let d = `M ${width / 2} 0`;
    for (let i = 0; i < activities.length; i++) {
      const yStart = i * rowHeight;
      const yEnd = (i + 1) * rowHeight;
      const isEven = i % 2 === 0;
      
      // Calculate control points for the serpentine sweep
      const cpX1 = isEven ? width - 50 : 50;
      const cpX2 = isEven ? width - 50 : 50;
      
      d += ` C ${cpX1} ${yStart + rowHeight / 4}, ${cpX2} ${yEnd - rowHeight / 4}, ${width / 2} ${yEnd}`;
    }
    return d;
  };

  const getFormatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const getFormatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return "00:00";
    }
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto py-10 px-4 select-none">
      {activities.length === 0 ? (
        <div className="text-center py-20 glass-card rounded-2xl p-8 max-w-md mx-auto">
          <Clock className="w-12 h-12 text-violet-400 mx-auto mb-4 animate-pulse" />
          <h3 className="text-xl font-semibold text-gray-200">No activity recorded yet</h3>
          <p className="text-sm text-gray-400 mt-2">
            Make sure window focus tracking is active or browse tabs in Chrome with the companion extension enabled.
          </p>
        </div>
      ) : (
        <div className="relative" style={{ height: `${activities.length * rowHeight + 100}px` }}>
          {/* Timeline SVG */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${width} ${activities.length * rowHeight + 100}`}
            fill="none"
          >
            {/* Background path line */}
            <path
              d={generatePath()}
              stroke="#27273a"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Glow primary active curve */}
            <path
              d={generatePath()}
              stroke="url(#timeline-grad)"
              strokeWidth="4"
              strokeLinecap="round"
              className="timeline-glow opacity-80"
            />
            
            <defs>
              <linearGradient id="timeline-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="50%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
          </svg>

          {/* Interactive nodes along the curve */}
          {activities.map((node, index) => {
            const isEven = index % 2 === 0;
            // Midpoint calculation for t=0.5 on cubic Bezier
            const nodeY = (index + 0.5) * rowHeight;
            const nodeX = isEven ? width * 0.875 : width * 0.125;

            // Positioning calculations for details card relative to node
            const cardStyle: React.CSSProperties = isEven
              ? { left: `${width * 0.05}px`, top: `${nodeY - 50}px`, width: "320px" }
              : { right: `${width * 0.05}px`, top: `${nodeY - 50}px`, width: "320px" };

            const isBrowser = node.source.toLowerCase() === "browser";

            return (
              <React.Fragment key={node.id || index}>
                {/* Visual anchor point circle */}
                <div
                  className="absolute z-10 w-8 h-8 rounded-full border-4 border-violet-500 bg-zinc-950 flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 cursor-pointer shadow-[0_0_15px_rgba(139,92,246,0.5)] transition-transform duration-300 hover:scale-125"
                  style={{ left: `${(nodeX / width) * 100}%`, top: `${nodeY}px` }}
                  title={`${node.app_name}: ${node.window_title}`}
                >
                  {isBrowser ? (
                    <Globe className="w-3.5 h-3.5 text-blue-400" />
                  ) : (
                    <Monitor className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                </div>

                {/* Glassmorphic Activity Card */}
                <div
                  className="absolute glass-card rounded-xl p-4 shadow-xl text-left"
                  style={{
                    ...cardStyle,
                    left: isEven ? '10%' : 'auto',
                    right: !isEven ? '10%' : 'auto',
                    width: '38%'
                  }}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      isBrowser ? 'bg-blue-950/50 text-blue-300 border border-blue-800/30' : 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/30'
                    }`}>
                      {node.app_name}
                    </span>
                    <div className="flex items-center text-xs text-gray-400 gap-1">
                      <Clock className="w-3 h-3 text-violet-400" />
                      <span>{getFormatDuration(node.duration)}</span>
                    </div>
                  </div>

                  <h4 className="text-sm font-medium text-gray-200 line-clamp-1 mb-1" title={String(node.window_title)}>
                    {node.window_title}
                  </h4>

                  {node.url && (
                    <p className="text-xs text-blue-400 line-clamp-1 mb-2 select-all hover:underline cursor-pointer">
                      {node.url}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-zinc-800/50">
                    <span className="text-[10px] text-gray-500 font-mono">
                      {getFormatTime(node.start_time)}
                    </span>
                    <button
                      onClick={() => onAddJournal(node)}
                      className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors font-medium cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Reflect</span>
                    </button>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};
