import React, { useState } from 'react';
import { Layout, GitCommit, Bot, ShieldAlert, Sliders } from 'lucide-react';

interface ScreenshotTab {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  renderMockup: () => React.ReactNode;
}

export const ScreenshotGallery: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs: ScreenshotTab[] = [
    {
      id: 'dashboard',
      label: 'Serpentine Dashboard',
      icon: Layout,
      description: 'Scroll through your day represented as a serpentine SVG timeline curve with real-time active task counters.',
      renderMockup: () => (
        <div className="w-full bg-[#0d0d11] p-6 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden font-sans">
          {/* Header Bar */}
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="text-xs font-mono text-gray-400 ml-2">LifeMirror Desktop — Serpentine Dashboard</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Tracking Active</span>
            </div>
          </div>

          {/* SVG S-Curve Simulation Preview */}
          <div className="relative h-64 flex items-center justify-center bg-black/40 rounded-xl border border-white/5 p-4">
            <svg className="w-full h-full" viewBox="0 0 600 200">
              <path
                d="M 50 40 C 200 40, 200 160, 350 160 C 500 160, 500 40, 550 40"
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="4"
                strokeDasharray="6 6"
              />
              <circle cx="200" cy="100" r="16" fill="#0d0d11" stroke="#ec4899" strokeWidth="4" />
              <circle cx="350" cy="160" r="16" fill="#0d0d11" stroke="#06b6d4" strokeWidth="4" />
              <circle cx="500" cy="100" r="16" fill="#0d0d11" stroke="#ef4444" strokeWidth="4" />
            </svg>
            <div className="absolute top-4 left-6 text-left">
              <span className="text-xs text-violet-400 font-mono">09:15 AM — VS Code (1h 30m)</span>
            </div>
            <div className="absolute bottom-4 right-6 text-right">
              <span className="text-xs text-cyan-400 font-mono">10:45 AM — Chrome Accordion (4 tabs)</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'accordion',
      label: 'Tab Accordion',
      icon: GitCommit,
      description: 'Consecutive browser tab switches are grouped cleanly into single expandable accordion cards.',
      renderMockup: () => (
        <div className="w-full bg-[#0d0d11] p-6 rounded-2xl border border-white/10 shadow-2xl relative font-sans">
          <div className="p-4 rounded-xl bg-violet-950/30 border border-violet-500/40">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-300 font-bold">🌐</div>
                <div>
                  <div className="text-sm font-semibold text-white">Google Chrome Session (4 Tabs Visited)</div>
                  <div className="text-xs text-gray-400 font-mono">10:45 AM - 11:30 AM • Total: 45m</div>
                </div>
              </div>
              <span className="text-xs text-violet-400 bg-violet-500/20 px-2.5 py-1 rounded-md">Expanded Accordion</span>
            </div>

            {/* Expanded List */}
            <div className="space-y-2 pl-4 border-l-2 border-violet-500/30">
              <div className="flex items-center justify-between p-2 rounded bg-black/40 text-xs">
                <span className="text-gray-300 font-mono">tauri-apps/tauri — GitHub Repository</span>
                <span className="text-gray-500">20m</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-black/40 text-xs">
                <span className="text-gray-300 font-mono">rusqlite documentation — docs.rs</span>
                <span className="text-gray-500">15m</span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'ai',
      label: 'Local AI Reflections',
      icon: Bot,
      description: 'Ollama local AI generates 2-sentence daily mindfulness reflections and streams answer responses directly offline.',
      renderMockup: () => (
        <div className="w-full bg-[#0d0d11] p-6 rounded-2xl border border-white/10 shadow-2xl relative font-sans text-left">
          <div className="p-5 rounded-xl bg-gradient-to-r from-violet-900/40 to-indigo-900/40 border border-violet-500/30 mb-4">
            <div className="flex items-center gap-2 mb-2 text-violet-300 font-semibold text-sm">
              <Bot className="w-4 h-4 text-violet-400" />
              <span>Offline AI Mindfulness Card (llama3.2)</span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed font-mono">
              "You spent 4.5 hours in deep Rust engineering today. Active Interdiction successfully repelled 1 distraction event during intense focus."
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'interdiction',
      label: 'Active Interdiction',
      icon: ShieldAlert,
      description: 'Real-time focus defense system that detects blacklisted regex rules or AI intention violations and blocks distracting windows.',
      renderMockup: () => (
        <div className="w-full bg-black/90 p-8 rounded-2xl border border-red-500/40 shadow-2xl backdrop-blur-2xl relative text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7 text-red-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Focus Shield Activated</h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto mb-6">
            Access to <span className="text-red-400 font-mono font-semibold">reddit.com</span> was blocked because your active goal is set to <span className="text-emerald-400 font-semibold">"Writing Rust Core"</span>.
          </p>
        </div>
      ),
    },
    {
      id: 'settings',
      label: 'System Tray & Settings',
      icon: Sliders,
      description: 'Control tracking active status, Incognito memory wipe mode, log threshold sliders, and launch on startup.',
      renderMockup: () => (
        <div className="w-full bg-[#0d0d11] p-6 rounded-2xl border border-white/10 shadow-2xl relative font-sans text-left">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="text-xs text-gray-400 mb-1">Minimum Log Duration</div>
              <div className="text-sm font-bold text-white font-mono">120 seconds (2m)</div>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="text-xs text-gray-400 mb-1">Incognito Mode</div>
              <div className="text-sm font-bold text-amber-400 font-mono">Off (Logging Active)</div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const currentTab = tabs.find((t) => t.id === activeTab) || tabs[0];

  return (
    <section className="py-20 px-6 max-w-7xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
          Experience Native Desktop Craftsmanship
        </h2>
        <p className="text-gray-400 max-w-xl mx-auto text-sm sm:text-base">
          Explore the exact visual interface of LifeMirror Desktop. Built with React + Vite + Tauri 2.0.
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs transition-all ${
                isActive
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30 scale-105'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Description */}
      <p className="text-xs sm:text-sm text-gray-400 text-center max-w-lg mx-auto mb-8 font-mono">
        {currentTab.description}
      </p>

      {/* Mockup Frame */}
      <div className="max-w-4xl mx-auto transition-all duration-500">
        {currentTab.renderMockup()}
      </div>
    </section>
  );
};
