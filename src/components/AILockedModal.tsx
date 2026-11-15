import React, { useEffect } from "react";
import { 
  Lock, 
  Sparkles, 
  X, 
  ShieldCheck, 
  ArrowRight,
  Server
} from "lucide-react";

interface AILockedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenSetupModal?: () => void;
  featureName?: string;
  ollamaUrl?: string;
  ollamaModel?: string;
}

export const AILockedModal: React.FC<AILockedModalProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
  onOpenSetupModal,
  featureName = "This feature",
  ollamaUrl: _ollamaUrl = "http://localhost:11434",
  ollamaModel: _ollamaModel = "llama3.2",
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-locked-modal-title"
        className="relative w-full max-w-lg bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-violet-600 to-indigo-600" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-zinc-500/10 rounded-xl transition-colors cursor-pointer z-10"
          title="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Header Banner */}
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-violet-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/10">
              <Lock className="w-6 h-6 text-amber-500" />
            </div>
            <div className="min-w-0 pr-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500">
                  AI Feature Locked
                </span>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">Offline Engine</span>
              </div>
              <h3 id="ai-locked-modal-title" className="text-base sm:text-lg font-bold text-[var(--text-color)] leading-snug">
                {featureName} Requires an AI Engine
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                LifeMirror is private by default. To use this feature, choose to run AI on your computer (100% offline) or connect a fast online service with your personal API key.
              </p>
            </div>
          </div>

          {/* Explanation Card */}
          <div className="p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/40 text-xs text-[var(--text-color)] space-y-2">
            <div className="flex items-center gap-2 font-semibold text-[var(--text-color)]">
              <Server className="w-4 h-4 text-violet-400 shrink-0" />
              <span>Current AI Engine: Inactive or Unreachable</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              When no AI engine is active, reflection features (resume briefings, daily mindfulness reflections, and focus chat) are safely paused. You can set up AI in under 2 minutes or continue using LifeMirror without AI.
            </p>
          </div>

          {/* 2-Option Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1">
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Option 1: On-Device (Ollama)
              </span>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                Runs 100% locally on your computer with zero internet needed. Free forever.
              </p>
            </div>

            <div className="p-3 rounded-xl border border-violet-500/20 bg-violet-500/5 space-y-1">
              <span className="font-semibold text-violet-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Option 2: Online Service (BYOK)
              </span>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                Zero disk space. Connect Groq (fast free tier) or OpenAI with full consent review.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border-color)]">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-zinc-500/10 border border-transparent transition-colors cursor-pointer"
            >
              Dismiss
            </button>
            <button
              onClick={() => {
                onClose();
                if (onOpenSetupModal) {
                  onOpenSetupModal();
                } else {
                  onOpenSettings();
                }
              }}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-all flex items-center gap-1.5 shadow-md shadow-violet-600/20 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Choose & Configure AI</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
