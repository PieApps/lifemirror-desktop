import React, { useState } from 'react';
import { MOCK_TIMELINE_DATA, ActivityLogDemo } from '../data/demoData';
import { ChevronDown, ChevronUp, Lock, Sliders, ShieldAlert, Sparkles } from 'lucide-react';

export const SCurveDemo: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLogDemo[]>(MOCK_TIMELINE_DATA);
  const [expandedAccordionId, setExpandedAccordionId] = useState<number | null>(2);
  const [minLogThreshold, setMinLogThreshold] = useState(60);
  const [activeNoteId, setActiveNoteId] = useState<number | null>(1);
  const [editingNoteText, setEditingNoteText] = useState(logs[0].notes || '');

  const rowHeight = 160;
  const svgWidth = 800;
  const totalRows = logs.length;
  const svgHeight = totalRows * rowHeight;

  const handleSaveNote = (id: number) => {
    setLogs((prev) =>
      prev.map((item) => (item.id === id ? { ...item, notes: editingNoteText } : item))
    );
    setActiveNoteId(null);
  };

  const filteredLogs = logs.filter((log) => log.duration === 0 || log.duration >= minLogThreshold);

  return (
    <section id="timeline-demo" className="py-24 px-6 max-w-7xl mx-auto text-center">
      <div className="mb-12">
        <span className="text-xs font-mono uppercase tracking-widest text-violet-400 font-semibold">
          Interactive Product Simulation
        </span>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-white mt-3 mb-4">
          The Serpentine S-Curve Timeline
        </h2>
        <p className="text-gray-400 max-w-2xl mx-auto text-sm sm:text-base">
          Experience how LifeMirror maps computer focus sessions along a smooth winding cubic Bézier curve. Click any node to inspect details or expand grouped tab accordions!
        </p>
      </div>

      {/* Control Bar */}
      <div className="max-w-4xl mx-auto glass-card p-4 mb-10 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-3">
          <Sliders className="w-4 h-4 text-violet-400" />
          <span className="text-gray-300">Min Duration Filter:</span>
          <input
            type="range"
            min="60"
            max="300"
            step="30"
            value={minLogThreshold}
            onChange={(e) => setMinLogThreshold(Number(e.target.value))}
            className="w-32 accent-violet-500 cursor-pointer"
          />
          <span className="text-violet-400 font-bold">{minLogThreshold}s</span>
        </div>

        <div className="flex items-center gap-4 text-gray-400">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Live Active Focus Ticking
          </span>
        </div>
      </div>

      {/* SVG S-Curve Container */}
      <div className="max-w-4xl mx-auto glass-card p-8 relative overflow-hidden">
        <div className="relative w-full overflow-x-auto flex justify-center">
          <div className="relative" style={{ width: `${svgWidth}px`, height: `${svgHeight}px` }}>
            {/* SVG Path Calculation */}
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
              <defs>
                <linearGradient id="curveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="50%" stopColor="#ec4899" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>

              {filteredLogs.map((_, i) => {
                const yStart = i * rowHeight;
                const yEnd = (i + 1) * rowHeight;
                const cpX1 = i % 2 === 0 ? svgWidth - 50 : 50;
                const cpX2 = i % 2 === 0 ? svgWidth - 50 : 50;
                const midX = svgWidth / 2;

                const pathD = `M ${midX} ${yStart} C ${cpX1} ${yStart + rowHeight / 4}, ${cpX2} ${yEnd - rowHeight / 4}, ${midX} ${yEnd}`;

                return (
                  <path
                    key={`path-${i}`}
                    d={pathD}
                    fill="none"
                    stroke="url(#curveGradient)"
                    strokeWidth="4"
                    strokeDasharray="8 6"
                    opacity="0.8"
                  />
                );
              })}
            </svg>

            {/* Interactive Parametric Midpoint Nodes ($t = 0.5$) */}
            {filteredLogs.map((log, i) => {
              const nodeY = (i + 0.5) * rowHeight;
              const isEven = i % 2 === 0;
              const nodeX = isEven ? svgWidth * 0.85 : svgWidth * 0.15;
              const cardX = isEven ? svgWidth * 0.15 : svgWidth * 0.45;

              return (
                <React.Fragment key={log.id}>
                  {/* Parametric Midpoint Node Anchor */}
                  <div
                    className={`absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-2xl flex items-center justify-center cursor-pointer transition-all duration-300 ${
                      log.isDistraction
                        ? 'bg-red-500/20 border-2 border-red-500 text-red-400 shadow-lg shadow-red-500/30'
                        : log.source === 'Browser'
                        ? 'bg-cyan-500/20 border-2 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/30'
                        : 'bg-violet-500/20 border-2 border-violet-400 text-violet-300 shadow-lg shadow-violet-500/30'
                    } hover:scale-125 z-20`}
                    style={{ left: `${nodeX}px`, top: `${nodeY}px` }}
                    onClick={() => {
                      if (log.subSessions) {
                        setExpandedAccordionId(expandedAccordionId === log.id ? null : log.id);
                      }
                    }}
                  >
                    {log.isDistraction ? (
                      <ShieldAlert className="w-6 h-6" />
                    ) : log.source === 'Browser' ? (
                      <span className="text-lg">🌐</span>
                    ) : (
                      <span className="text-lg">💻</span>
                    )}
                  </div>

                  {/* Activity Detail Card */}
                  <div
                    className="absolute -translate-y-1/2 w-80 text-left glass-card p-4 transition-all z-10 hover:border-violet-400/50"
                    style={{ left: `${cardX}px`, top: `${nodeY}px` }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        {log.appName}
                        {log.source === 'Browser' && (
                          <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-mono">
                            Native Bridge
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] font-mono text-gray-400">{log.startTime}</span>
                    </div>

                    <div className="text-xs text-gray-300 font-mono line-clamp-1 mb-2">
                      {log.windowTitle}
                    </div>

                    {/* Accordion Sub-Sessions */}
                    {log.subSessions && (
                      <div className="mt-2 pt-2 border-t border-white/10">
                        <button
                          onClick={() => setExpandedAccordionId(expandedAccordionId === log.id ? null : log.id)}
                          className="flex items-center justify-between w-full text-xs text-cyan-400 hover:text-cyan-300 font-mono"
                        >
                          <span>{log.subSessions.length} Tabs Visited</span>
                          {expandedAccordionId === log.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {expandedAccordionId === log.id && (
                          <div className="mt-2 space-y-1.5">
                            {log.subSessions.map((sub) => (
                              <div key={sub.id} className="p-2 rounded bg-black/40 border border-white/5 text-[11px] font-mono flex items-center justify-between">
                                <span className="text-gray-300 truncate max-w-[180px]">{sub.title}</span>
                                <span className="text-gray-500">{Math.floor(sub.duration / 60)}m</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes Section */}
                    {log.notes && (
                      <div className="mt-2 pt-2 border-t border-white/5 text-[11px] text-gray-400 font-mono italic">
                        "{log.notes}"
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
