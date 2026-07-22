import React from 'react';
import { Compass, Bot, Shield, BarChart3, Sliders, Download } from 'lucide-react';

interface FeatureCategory {
  title: string;
  badge: string;
  icon: React.ElementType;
  color: string;
  items: string[];
}

export const FeatureGrid: React.FC = () => {
  const categories: FeatureCategory[] = [
    {
      title: 'Track',
      badge: 'Continuous Focus',
      icon: Compass,
      color: 'text-violet-400 border-violet-500/30 bg-violet-500/10',
      items: [
        'Serpentine SVG S-Curve Timeline visualizer',
        'Continuous OS-level active window focus polling loop',
        'Chrome Native Messaging Bridge (stdio pipe, zero open ports)',
        'Micro-task diversion folding & focus transition logic',
      ],
    },
    {
      title: 'Reflect',
      badge: 'Offline Intelligence',
      icon: Bot,
      color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
      items: [
        'Pluggable Ollama local AI integration (localhost:11434)',
        '2-sentence daily mindfulness reflection cards',
        'Interactive character-by-character streaming AI chat',
        'Encrypted local reflection journal editor',
      ],
    },
    {
      title: 'Protect',
      badge: 'Active Interdiction',
      icon: Shield,
      color: 'text-red-400 border-red-500/30 bg-red-500/10',
      items: [
        'Phase 1: Hyper-fast Regex Evaluation Engine for blacklists',
        'Phase 2: Asynchronous Local AI Intention Lock evaluator',
        'Fullscreen glassmorphic overlay shield on distraction',
        'Instant 1-click Incognito memory wipe & blur lockout',
      ],
    },
    {
      title: 'Understand',
      badge: 'Deep Analytics',
      icon: BarChart3,
      color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
      items: [
        'Shield deflection analytics & repelled distraction counter',
        'Aggregated daily metrics & session duration rollups',
        'Browser tab session grouping & accordion expansion',
        'Real-time active focus ticker (second-by-second client tick)',
      ],
    },
    {
      title: 'Customize',
      badge: 'Tailored Control',
      icon: Sliders,
      color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
      items: [
        'Dynamic log duration threshold slider (60s to 300s filter)',
        'Dynamic brand-colored vector icons (VS Code, Spotify, Slack)',
        'System status tray integration & close-to-tray execution',
        'Light & Dark frosted glass theme persistence',
      ],
    },
    {
      title: 'Install',
      badge: 'Cross-Platform',
      icon: Download,
      color: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10',
      items: [
        'Native installers for Windows (.exe/.msi), macOS (.dmg), Linux (.deb)',
        'Automated native host registration script (`npm run install-host`)',
        'Native one-click model downloader inside app',
        'Embedded interactive documentation & setup guides',
      ],
    },
  ];

  return (
    <section id="features" className="py-24 px-6 max-w-7xl mx-auto border-t border-white/5 text-center">
      <div className="mb-16">
        <span className="text-xs font-mono uppercase tracking-widest text-violet-400 font-semibold">
          Categorized Capability Directory
        </span>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-white mt-3 mb-4">
          Everything You Need. 100% Local.
        </h2>
        <p className="text-gray-400 max-w-2xl mx-auto text-sm sm:text-base">
          Explore the 6 core pillars of LifeMirror Desktop. Built with Tauri 2.0, Rust, and SQLCipher.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-left">
        {categories.map((cat, idx) => {
          const Icon = cat.icon;
          return (
            <div key={idx} className="glass-card p-6 border border-white/10 hover:border-violet-500/40 relative group">
              <div className="flex items-center justify-between mb-6">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${cat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full border ${cat.color}`}>
                  {cat.badge}
                </span>
              </div>

              <h3 className="text-xl font-bold text-white mb-4">{cat.title}</h3>

              <ul className="space-y-2.5 text-xs text-gray-300 font-mono">
                {cat.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="flex items-start gap-2">
                    <span className="text-violet-400 font-bold">•</span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
};
