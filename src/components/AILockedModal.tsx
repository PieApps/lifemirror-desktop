import React, { useEffect } from "react";
import { 
  Lock, 
  Sparkles, 
  Settings as SettingsIcon, 
  X, 
  Terminal, 
  ShieldCheck, 
  ArrowRight,
  Server
} from "lucide-react";

interface AILockedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  featureName?: string;
  ollamaUrl?: string;
  ollamaModel?: string;
}

export const AILockedModal: React.FC<AILockedModalProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
  featureName = "This feature",
  ollamaUrl = "http://localhost:11434",
  ollamaModel = "llama3.2",
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

  const displayModel = ollamaModel && ollamaModel !== "false" && ollamaModel !== "disabled" ? ollamaModel : "llama3.2";
  const displayUrl = ollamaUrl && ollamaUrl !== "false" && ollamaUrl !== "disabled" ? ollamaUrl : "http://localhost:11434";

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
                {featureName} Requires Local AI
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                LifeMirror runs completely offline. To use this feature, your local Ollama AI model must be running on this computer.
              </p>
            </div>
          </div>

          {/* Explanation Card */}
          <div className="p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/40 text-xs text-[var(--text-color)] space-y-2">
            <div className="flex items-center gap-2 font-semibold text-[var(--text-color)]">
              <Server className="w-4 h-4 text-violet-400 shrink-0" />
              <span>Current Status: Unreachable at {displayUrl}</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              We couldn't connect to Ollama. When Ollama is offline or not configured, AI-dependent features (resume context briefings, daily reflections, and productivity chat) are safely locked to prevent unexpected errors.
            </p>
          </div>

          {/* 3-Step Setup Checklist */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold text-[var(--text-color)] flex items-center gap-1.5 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span>How to unlock in 3 quick steps</span>
            </h4>

            <div className="space-y-2 text-xs">
              {/* Step 1 */}
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-color)]">
                <div className="w-5 h-5 rounded-full bg-violet-600/20 text-violet-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  1
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-[var(--text-color)] block">Start the Ollama application</span>
                  <span className="text-[11px] text-[var(--text-muted)] block">
                    Launch the Ollama desktop app or run <code className="font-mono text-violet-400 bg-zinc-800/50 px-1 py-0.5 rounded">ollama serve</code> in your terminal.
                  </span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-color)]">
                <div className="w-5 h-5 rounded-full bg-violet-600/20 text-violet-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  2
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-[var(--text-color)] block">Pull the local model</span>
                  <div className="flex items-center gap-1.5 mt-1 font-mono text-[11px] bg-black/40 text-violet-300 px-2 py-1 rounded-lg border border-violet-500/20 overflow-x-auto">
                    <Terminal className="w-3 h-3 text-violet-400 shrink-0" />
                    <span>ollama pull {displayModel}</span>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-color)]">
                <div className="w-5 h-5 rounded-full bg-violet-600/20 text-violet-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  3
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-[var(--text-color)] block">Verify in Settings</span>
                  <span className="text-[11px] text-[var(--text-muted)] block">
                    Check your Local AI connection in LifeMirror Settings. Once connected, all features unlock instantly.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Privacy Reassurance Banner */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-[11px]">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>100% Private: All inference happens locally. Your activity logs never leave your device.</span>
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
                onOpenSettings();
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-all flex items-center gap-1.5 shadow-md shadow-violet-600/20 cursor-pointer"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
              <span>Configure in Settings</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
