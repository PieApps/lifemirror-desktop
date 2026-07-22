import React from 'react';
import { Shield, Github, Lock, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="py-16 px-6 max-w-7xl mx-auto border-t border-white/10 text-gray-400 font-sans text-xs">
      <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12">
        {/* Brand */}
        <div className="flex flex-col items-center md:items-start gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center text-white">
              <Shield className="w-4 h-4" />
            </div>
            <span className="font-display font-bold text-base text-white">LifeMirror Desktop</span>
          </div>
          <p className="text-gray-500 max-w-sm text-center md:text-left text-[11px] font-mono">
            Privacy-first local AI productivity & focus reflection utility. 100% offline. Zero telemetry.
          </p>
        </div>

        {/* Links */}
        <div className="flex flex-wrap items-center justify-center gap-6 font-mono text-gray-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#timeline-demo" className="hover:text-white transition-colors">Timeline</a>
          <a href="#ai-experience" className="hover:text-white transition-colors">Local AI</a>
          <a href="#privacy" className="hover:text-white transition-colors">Privacy</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          <a href="#downloads" className="hover:text-white transition-colors">Downloads</a>
          <a href="#docs" className="hover:text-white transition-colors">Docs</a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1">
            <Github className="w-3.5 h-3.5" />
            <span>GitHub</span>
          </a>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-white/5 font-mono text-[11px] text-gray-500">
        <div className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span>SQLCipher Encrypted Local Storage • Zero Remote Cloud Calls</span>
        </div>

        <div>
          MIT License • Built with Rust, Tauri 2.0 & React.
        </div>
      </div>
    </footer>
  );
};
