import React, { useEffect } from "react";
import { 
  Sparkles, 
  X, 
  ArrowRight,
  Cpu,
  Cloud
} from "lucide-react";
import { sound } from "../utils/sound";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-locked-modal-title"
        className="relative w-full max-w-lg bg-[var(--card-bg)] border border-violet-500/30 rounded-3xl shadow-2xl shadow-violet-950/40 overflow-hidden flex flex-col text-left animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-violet-600 via-indigo-500 to-purple-600" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-zinc-500/10 rounded-xl transition-colors cursor-pointer z-10"
          title="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 space-y-5">
          {/* Header Banner */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/20">
              <Sparkles className="w-6 h-6 text-violet-400 animate-pulse" />
            </div>
            <div className="min-w-0 pr-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300">
                  The Private Biographer
                </span>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">100% Private</span>
              </div>
              <h3 id="ai-locked-modal-title" className="text-lg font-serif font-bold text-[var(--text-color)] leading-snug">
                Awaken Your Personal Biographer
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                {featureName} uses LifeMirror’s biographer to synthesize your raw digital workflow into insightful prose, detect your prime focus windows, and chronicle your life's work.
              </p>
            </div>
          </div>

          {/* 2-Option Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-1.5 flex flex-col justify-between">
              <div>
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  Sovereign & Local
                </span>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed mt-1">
                  Runs 100% locally via Ollama on your machine. Zero telemetry, zero network calls.
                </p>
              </div>
              <span className="text-[10px] font-mono text-emerald-400/80 font-semibold block mt-1">
                ● 1-Click Auto-Detect
              </span>
            </div>

            <div className="p-3.5 rounded-2xl border border-violet-500/30 bg-violet-500/5 space-y-1.5 flex flex-col justify-between">
              <div>
                <span className="font-bold text-violet-400 flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5" />
                  Cloud Intelligence
                </span>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed mt-1">
                  Lightning fast with Google Gemini, Groq, or OpenAI using your own private API key.
                </p>
              </div>
              <span className="text-[10px] font-mono text-violet-400/80 font-semibold block mt-1">
                ● High-Speed Synthesis
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-color)]">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-zinc-500/10 transition-colors cursor-pointer"
            >
              Maybe Later
            </button>
            <button
              onClick={() => {
                sound.playFocusIgnite();
                onClose();
                if (onOpenSetupModal) {
                  onOpenSetupModal();
                } else {
                  onOpenSettings();
                }
              }}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 transition-all flex items-center gap-1.5 shadow-lg shadow-violet-600/25 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Awaken Biographer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
