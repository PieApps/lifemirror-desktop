import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Shield, Eye, Lock, ExternalLink, AlertTriangle, X, Check, ArrowRight, Loader2 } from "lucide-react";

interface CloudPrivacyDisclosureModalProps {
  isOpen: boolean;
  provider: "groq" | "openai" | "openrouter" | "custom";
  model: string;
  onConfirm: () => void;
  onCancel: () => void;
}

interface PreviewSession {
  app: string;
  window: string;
  duration: string;
}

export const CloudPrivacyDisclosureModal: React.FC<CloudPrivacyDisclosureModalProps> = ({
  isOpen,
  provider,
  model,
  onConfirm,
  onCancel,
}) => {
  const [agreed, setAgreed] = useState(false);
  const [showPayload, setShowPayload] = useState(true);
  const [previewSessions, setPreviewSessions] = useState<PreviewSession[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setAgreed(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    const fetchPayload = async () => {
      setLoadingPreview(true);
      try {
        const data = await invoke<{ sessions: PreviewSession[] }>("get_recent_preview_payload");
        if (data && data.sessions) {
          setPreviewSessions(data.sessions);
        }
      } catch (err) {
        console.error("Failed to load real payload preview:", err);
      } finally {
        setLoadingPreview(false);
      }
    };

    fetchPayload();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const providerNames: Record<string, string> = {
    groq: "Groq Cloud",
    openai: "OpenAI",
    openrouter: "OpenRouter",
    custom: "Custom Endpoint",
  };

  const providerPolicies: Record<string, { url: string; label: string; costNotice: string }> = {
    groq: {
      url: "https://groq.com/privacy-policy/",
      label: "Groq Privacy Policy",
      costNotice: "Groq currently offers high-speed free tier access subject to API rate limits.",
    },
    openai: {
      url: "https://openai.com/policies/privacy-policy/",
      label: "OpenAI Privacy Policy",
      costNotice: "OpenAI charges pay-as-you-go per token (~$0.01 for ~50 reflections with gpt-4o-mini).",
    },
    openrouter: {
      url: "https://openrouter.ai/privacy",
      label: "OpenRouter Privacy Policy",
      costNotice: "OpenRouter routes to various model hosts. Free tier models are available, subject to provider policies.",
    },
    custom: {
      url: "#",
      label: "Self-Hosted / Custom Server",
      costNotice: "Ensure you trust the destination server. Data is transmitted to the custom URL provided.",
    },
  };

  const currentPolicy = providerPolicies[provider] || providerPolicies.custom;
  const currentProviderName = providerNames[provider] || "Cloud AI";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="cloud-privacy-title"
        className="relative w-full max-w-xl bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-left max-h-[90vh]"
      >
        {/* Accent Strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-rose-500 to-violet-600" />

        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-zinc-500/10 rounded-xl transition-colors cursor-pointer z-10"
          title="Go back"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Data Sharing Review
              </span>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">Target: {currentProviderName}</span>
            </div>
            <h3 id="cloud-privacy-title" className="text-lg sm:text-xl font-bold text-[var(--text-color)] leading-snug">
              Review What Leaves Your Device
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
              LifeMirror is private by default and local-first. Because you are opting into an online service, activity data will be transmitted over HTTPS to generate insights.
            </p>
          </div>

          {/* Side-by-side What Leaves vs What NEVER Leaves */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2">
              <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5" />
                What is sent to {currentProviderName}
              </span>
              <ul className="space-y-1.5 text-[11px] text-[var(--text-muted)] list-disc list-inside">
                <li>Names of open applications (e.g. Chrome, VS Code)</li>
                <li>Session & window titles (e.g. active tab title, file name)</li>
                <li>Time spent on sessions and timestamps</li>
                <li>Your journal notes (only when generating reflections)</li>
              </ul>
            </div>

            <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                What is NEVER sent
              </span>
              <ul className="space-y-1.5 text-[11px] text-[var(--text-muted)] list-disc list-inside">
                <li>Incognito sessions (strictly excluded)</li>
                <li>Sites on your Excluded Domains list</li>
                <li>Keystrokes, passwords, or clipboard</li>
                <li>Full screen recordings or screenshots</li>
                <li>Your encrypted SQLite database</li>
              </ul>
            </div>
          </div>

          {/* Third-Party Policy & Cost Notice */}
          <div className="p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/50 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--text-color)] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-violet-400" />
                Third-Party Retention & Costs
              </span>
              {provider !== "custom" && (
                <a 
                  href={currentPolicy.url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-[10px] text-violet-400 hover:text-violet-300 flex items-center gap-1 underline font-medium"
                >
                  {currentPolicy.label} <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Once sent, your data is processed according to {currentProviderName}'s privacy policy, not LifeMirror's.
            </p>
            <p className="text-[11px] text-amber-500/90 font-medium">
              💡 {currentPolicy.costNotice}
            </p>
          </div>

          {/* Live Payload Preview */}
          <div className="border border-[var(--border-color)] rounded-xl overflow-hidden bg-[var(--bg-color)]/70">
            <button
              type="button"
              onClick={() => setShowPayload(!showPayload)}
              className="w-full px-3.5 py-2.5 bg-[var(--surface-color)]/60 text-xs font-semibold text-[var(--text-color)] flex items-center justify-between border-b border-[var(--border-color)] cursor-pointer hover:bg-[var(--surface-color)] transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-sky-400" />
                Live Payload Preview (Your actual recent data)
              </span>
              <span className="text-[10px] font-mono text-sky-400 underline">
                {showPayload ? "Hide" : "Show"}
              </span>
            </button>

            {showPayload && (
              <div className="p-3 text-[11px] font-mono text-[var(--text-muted)] overflow-x-auto max-h-40">
                {loadingPreview ? (
                  <div className="flex items-center gap-2 text-xs py-3 justify-center">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading actual local sessions...
                  </div>
                ) : (
                  <pre className="text-[10.5px] leading-relaxed text-zinc-300">
{JSON.stringify({
  target_model: model || "default",
  prompt_context: {
    instruction: "Analyze recent desktop activities for productivity reflection.",
    actual_logged_sessions: previewSessions.slice(0, 3)
  }
}, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>

          {/* Consent Checkbox */}
          <div className="pt-2 border-t border-[var(--border-color)]">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 rounded border-[var(--border-color)] text-violet-600 focus:ring-violet-500/40 w-4 h-4 cursor-pointer"
              />
              <span className="text-xs text-[var(--text-color)] leading-snug font-medium">
                I understand and agree to send my recent app and window titles to {currentProviderName} to generate reflections.
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-zinc-500/10 transition-colors cursor-pointer"
            >
              Go Back
            </button>
            <button
              type="button"
              disabled={!agreed}
              onClick={onConfirm}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-md shadow-violet-900/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Accept & Enable Cloud AI</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
