import React, { useState, useEffect, useRef } from "react";
import { Sunrise, Sparkles, X, ArrowRight, Clock, Compass } from "lucide-react";
import { sound } from "../utils/sound";
import { formatDuration } from "../utils/formatDuration";

interface MorningPreludeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartFocus: (intention: string) => Promise<void>;
  yesterdayStats?: {
    totalDuration: number;
    dominantApp?: string;
    episodeCount?: number;
  };
  initialIntention?: string;
}

export const MorningPreludeModal: React.FC<MorningPreludeModalProps> = ({
  isOpen,
  onClose,
  onStartFocus,
  yesterdayStats,
  initialIntention = "",
}) => {
  const [intention, setIntention] = useState(initialIntention);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialIntention) {
        setIntention(initialIntention);
      }
      setTimeout(() => inputRef.current?.focus(), 80);
      sound.playAwakeningBell();
    }
  }, [isOpen, initialIntention]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intention.trim()) {
      onClose();
      return;
    }
    await onStartFocus(intention.trim());
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-xl bg-gradient-to-b from-zinc-950/95 to-zinc-900/95 border border-amber-500/30 rounded-3xl shadow-2xl shadow-amber-950/30 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Dawn Amber Aurora Sheen */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-rose-500 to-violet-500" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer z-10"
          title="Begin silently"
        >
          <X className="w-4 h-4" />
        </button>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6 relative z-10">
          {/* Dawn Masthead */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center gap-1.5 shadow-sm">
                <Sunrise className="w-3.5 h-3.5 text-amber-400" />
                <span>The Morning Prelude · Dawn Awakening</span>
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
              Good morning. The studio is quiet.
            </h2>

            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              Every day begins as an unwritten canvas. LifeMirror is ready to preserve the rhythm of your craft.
            </p>
          </div>

          {/* Yesterday's Echo Card */}
          {yesterdayStats && yesterdayStats.totalDuration > 0 ? (
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 backdrop-blur-md flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5 text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 mb-0.5">
                  <span>Yesterday’s Milestone</span>
                  <span className="text-amber-400 font-mono font-bold">
                    {formatDuration(yesterdayStats.totalDuration)}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  You devoted dedicated focus to <span className="text-white font-medium">{yesterdayStats.dominantApp || "your projects"}</span>. That chapter is immortalized in your vault.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-zinc-900/40 border border-white/5 flex items-center gap-3 text-xs text-zinc-400">
              <Compass className="w-4 h-4 text-violet-400 shrink-0" />
              <span>A fresh river awaits. Set your intention below to begin your flow.</span>
            </div>
          )}

          {/* Intention Input */}
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-bold text-amber-200/90 tracking-wide">
              What is the singular masterpiece you will build today?
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={intention}
                onChange={(e) => setIntention(e.target.value)}
                placeholder="e.g. Design user authorization flow & refactor API..."
                className="w-full px-4 py-3 bg-zinc-900/90 border border-amber-500/30 focus:border-amber-400 rounded-2xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all font-medium pr-10 shadow-inner"
              />
              <Sparkles className="w-4 h-4 text-amber-400/60 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Quick Intention Presets */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                "⚡ Deep Architecture Refactor",
                "🎨 Design & Polish UI",
                "🐛 Bug Triage & Hardening",
                "📝 Writing & Strategy",
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setIntention(preset);
                    inputRef.current?.focus();
                  }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-zinc-900/60 hover:bg-amber-500/15 border border-white/5 hover:border-amber-500/30 text-zinc-400 hover:text-amber-200 transition-all cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-zinc-400 hover:text-zinc-200 font-medium px-3 py-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
            >
              Begin Silently
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-950/40 hover:shadow-amber-500/20 transition-all flex items-center gap-2 cursor-pointer transform active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              <span>Ignite Dawn Flow</span>
              <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
