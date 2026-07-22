import React from 'react';
import { Shield, Cpu, HardDrive, Terminal, GitBranch } from 'lucide-react';

export const ArchitectureSection: React.FC = () => {
  return (
    <section className="py-24 px-6 max-w-7xl mx-auto text-center border-t border-white/5">
      <div className="mb-12">
        <span className="text-xs font-mono uppercase tracking-widest text-violet-400 font-semibold">
          System Topology
        </span>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-white mt-3 mb-4">
          Zero-Port Native Architecture
        </h2>
        <p className="text-gray-400 max-w-2xl mx-auto text-sm sm:text-base">
          No web sockets. No background listening HTTP ports. Browser tab events are piped securely via Chrome's Native Messaging Stdio API.
        </p>
      </div>

      {/* SVG Topology Diagram */}
      <div className="max-w-4xl mx-auto glass-card p-8 border border-white/10 overflow-x-auto">
        <div className="min-w-[650px] font-mono text-xs">
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-300">
              <div className="font-bold text-sm mb-1">Google Chrome / Firefox</div>
              <div className="text-[11px] text-cyan-400/80">Companion Extension</div>
            </div>

            <div className="p-4 rounded-xl bg-violet-950/40 border border-violet-500/30 text-violet-300">
              <div className="font-bold text-sm mb-1">Native OS Poller</div>
              <div className="text-[11px] text-violet-400/80">Wayland / Win32 / macOS API</div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300">
              <div className="font-bold text-sm mb-1">Ollama Local AI</div>
              <div className="text-[11px] text-emerald-400/80">http://localhost:11434</div>
            </div>
          </div>

          {/* Connectors */}
          <div className="flex items-center justify-around py-4 border-t border-b border-white/10 mb-8 text-gray-400">
            <span className="text-cyan-400 font-semibold">⬇ STDIN Stdio Pipe (4-byte framing)</span>
            <span className="text-violet-400 font-semibold">⬇ 1s Focus Polling Loop</span>
            <span className="text-emerald-400 font-semibold">⬇ Token-Budgeted Prompt</span>
          </div>

          {/* Central DB & GUI */}
          <div className="grid grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-black/80 border border-emerald-500/40 text-emerald-400">
              <div className="font-bold text-base mb-1">SQLCipher Encrypted Database</div>
              <div className="text-xs text-gray-400 font-normal">Page-level SQLite OpenSSL encryption (`rusqlite`)</div>
            </div>

            <div className="p-6 rounded-2xl bg-black/80 border border-violet-500/40 text-violet-400">
              <div className="font-bold text-base mb-1">Main Tauri GUI App</div>
              <div className="text-xs text-gray-400 font-normal">React 18 + Winding SVG S-Curve Visualizer</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
