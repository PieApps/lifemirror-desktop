import React from 'react';
import { Download, Monitor, Apple, Terminal, CheckCircle, Cpu, HardDrive } from 'lucide-react';

export const DownloadSection: React.FC = () => {
  return (
    <section id="downloads" className="py-24 px-6 max-w-7xl mx-auto text-center border-t border-white/5">
      <div className="mb-16">
        <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-semibold">
          Desktop Distributions
        </span>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-white mt-3 mb-4">
          Download LifeMirror Desktop
        </h2>
        <p className="text-gray-400 max-w-2xl mx-auto text-sm sm:text-base">
          Native binaries built with Tauri 2.0. Fast, lightweight, zero telemetry, and SQLCipher page-level encrypted.
        </p>
      </div>

      {/* Platform Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16 text-left">
        {/* Windows Card */}
        <div className="glass-card p-8 border border-white/10 hover:border-violet-500/40 relative group">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6 text-blue-400">
            <Monitor className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-white mb-1">Windows</h3>
          <p className="text-xs text-gray-400 font-mono mb-6">Windows 10 / 11 (64-bit)</p>

          <div className="space-y-3 mb-8">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs flex items-center justify-between transition-all"
            >
              <span>NSIS Setup (.exe)</span>
              <Download className="w-4 h-4" />
            </a>

            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-medium text-xs flex items-center justify-between transition-all"
            >
              <span>MSI Package (.msi)</span>
              <Download className="w-4 h-4 text-gray-400" />
            </a>
          </div>

          <div className="text-[11px] text-gray-500 font-mono">
            * WebView2 Runtime pre-installed on Win11.
          </div>
        </div>

        {/* macOS Card */}
        <div className="glass-card p-8 border border-white/10 hover:border-violet-500/40 relative group">
          <div className="w-12 h-12 rounded-2xl bg-gray-500/10 border border-gray-500/20 flex items-center justify-center mb-6 text-white">
            <Apple className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-white mb-1">macOS</h3>
          <p className="text-xs text-gray-400 font-mono mb-6">macOS 11.0+ (Universal Binary)</p>

          <div className="space-y-3 mb-8">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs flex items-center justify-between transition-all"
            >
              <span>Apple Disk Image (.dmg)</span>
              <Download className="w-4 h-4" />
            </a>

            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-medium text-xs flex items-center justify-between transition-all"
            >
              <span>Standalone App (.app)</span>
              <Download className="w-4 h-4 text-gray-400" />
            </a>
          </div>

          <div className="text-[11px] text-gray-500 font-mono">
            * Universal binary for Intel & Apple Silicon (M1/M2/M3).
          </div>
        </div>

        {/* Linux Card */}
        <div className="glass-card p-8 border border-white/10 hover:border-violet-500/40 relative group">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6 text-emerald-400">
            <Terminal className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-white mb-1">Linux</h3>
          <p className="text-xs text-gray-400 font-mono mb-6">Ubuntu / Debian / Arch / Fedora</p>

          <div className="space-y-3 mb-8">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs flex items-center justify-between transition-all"
            >
              <span>Debian Package (.deb)</span>
              <Download className="w-4 h-4" />
            </a>

            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-medium text-xs flex items-center justify-between transition-all"
            >
              <span>Standalone AppImage</span>
              <Download className="w-4 h-4 text-gray-400" />
            </a>
          </div>

          <div className="text-[11px] text-gray-500 font-mono">
            * Supports X11 & Wayland compositors (Hyprland, Sway).
          </div>
        </div>
      </div>

      {/* 4-Step Quickstart Box */}
      <div className="max-w-4xl mx-auto glass-card p-8 text-left border border-white/10">
        <h4 className="text-lg font-bold text-white mb-4">Quick Setup Guide</h4>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 font-mono text-xs text-gray-300">
          <div className="p-4 rounded-xl bg-black/40 border border-white/5">
            <div className="text-violet-400 font-bold mb-1">1. Install Binary</div>
            <div className="text-gray-400 text-[11px]">Download and launch the desktop installer for your OS.</div>
          </div>

          <div className="p-4 rounded-xl bg-black/40 border border-white/5">
            <div className="text-violet-400 font-bold mb-1">2. Chrome Extension</div>
            <div className="text-gray-400 text-[11px]">Load unpacked extension in `chrome://extensions`.</div>
          </div>

          <div className="p-4 rounded-xl bg-black/40 border border-white/5">
            <div className="text-violet-400 font-bold mb-1">3. Native Host</div>
            <div className="text-gray-400 text-[11px]">Run `npm run install-host` to register stdio pipe.</div>
          </div>

          <div className="p-4 rounded-xl bg-black/40 border border-white/5">
            <div className="text-violet-400 font-bold mb-1">4. Optional Local AI</div>
            <div className="text-gray-400 text-[11px]">Install Ollama anytime to unlock automated AI reflections.</div>
          </div>
        </div>
      </div>
    </section>
  );
};
