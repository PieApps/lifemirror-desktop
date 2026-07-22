import React, { useState, useEffect } from 'react';
import { Shield, Github, Sun, Moon, Download, Sparkles } from 'lucide-react';
import logoImg from '../assets/logo.svg';

interface NavbarProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ theme, onToggleTheme }) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'py-3 bg-[#0d0d11]/80 backdrop-blur-xl border-b border-white/10 shadow-2xl'
          : 'py-5 bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Brand Logo */}
        <a href="#" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 via-cyan-400 to-violet-500 p-[2px] shadow-lg shadow-violet-500/20 transition-transform duration-300 group-hover:scale-105 overflow-hidden">
            <img
              src={logoImg}
              alt="LifeMirror Logo"
              className="w-full h-full rounded-full object-cover"
              onError={(e) => { e.currentTarget.src = '/logo.svg'; }}
            />
          </div>
          <div className="flex flex-col">
            <span className="font-display font-bold text-lg text-white tracking-tight flex items-center gap-1.5">
              LifeMirror <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">Desktop</span>
            </span>
            <span className="text-[10px] text-gray-400 -mt-1 tracking-wider uppercase">Local-First AI Reflection</span>
          </div>
        </a>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
          <a href="#features" className="hover:text-violet-400 transition-colors">Features</a>
          <a href="#timeline-demo" className="hover:text-violet-400 transition-colors">Timeline</a>
          <a href="#ai-experience" className="hover:text-violet-400 transition-colors">Local AI</a>
          <a href="#privacy" className="hover:text-violet-400 transition-colors">Privacy</a>
          <a href="#pricing" className="hover:text-violet-400 transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-violet-400 transition-colors">FAQ</a>
          <a href="#downloads" className="hover:text-violet-400 transition-colors">Downloads</a>
          <a href="#docs" className="hover:text-violet-400 transition-colors">Docs</a>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleTheme}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-all"
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>

          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all"
          >
            <Github className="w-4 h-4" />
            <span>GitHub</span>
          </a>

          <a
            href="#downloads"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium text-sm hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/25 transition-all hover:scale-105"
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </a>
        </div>
      </div>
    </nav>
  );
};
