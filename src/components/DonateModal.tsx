import React, { useState, useEffect } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { 
  Heart, 
  Coffee, 
  Sparkles, 
  X, 
  ExternalLink, 
  Copy, 
  Check, 
  ShieldCheck, 
  Code2, 
  Send,
  Star
} from "lucide-react";

interface DonateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DonateModal: React.FC<DonateModalProps> = ({ isOpen, onClose }) => {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const DONATION_EMAIL = "vrpieapps@gmail.com";
  const BUY_ME_A_COFFEE_URL = "https://buymeacoffee.com/vrpieapps";
  const GITHUB_SPONSORS_URL = "https://github.com/sponsors/vrpieapps";
  const CHROME_STORE_URL = "https://chromewebstore.google.com/detail/lifemirror-desktop/pblffjiaheggbamkjaojabdaemkflhmm";

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOpenLink = async (url: string, name: string) => {
    try {
      await openUrl(url);
      setStatusMessage(`Opening ${name}...`);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      console.error(`Failed to open ${name}:`, err);
    }
  };

  const handleSendMotivationEmail = async () => {
    try {
      const subject = encodeURIComponent("[LifeMirror Desktop] Words of Encouragement & Appreciation ❤️");
      const body = encodeURIComponent(`Hi Developers of LifeMirror,

I wanted to send a note of appreciation! 

Here is what I love about LifeMirror Desktop and how it has helped me:
[Share your story or kind words here...]

Keep up the fantastic work!
`);
      await openUrl(`mailto:${DONATION_EMAIL}?subject=${subject}&body=${body}`);
      setStatusMessage("Opening email client to send encouragement...");
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      console.error("Failed to open mail client for motivation:", err);
      handleCopyEmail();
    }
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(DONATION_EMAIL);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    } catch (err) {
      console.error("Failed to copy email:", err);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-lg glass rounded-2xl shadow-2xl border border-[var(--border-color)] overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="donate-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Header */}
        <div className="relative overflow-hidden px-6 pt-6 pb-4 border-b border-[var(--border-color)] bg-gradient-to-b from-rose-500/10 via-amber-500/5 to-transparent">
          <div className="flex items-start justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-500 shadow-lg shadow-rose-500/20">
                <Heart className="w-6 h-6 fill-rose-500/30 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 id="donate-modal-title" className="text-base sm:text-lg font-bold text-[var(--text-color)] leading-tight">
                    Fuel Independent Craft
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    100% Indie
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Directly support the ongoing journey of LifeMirror
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-zinc-500/10 transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
          {/* Emotional Manifesto Card */}
          <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--surface-color)]/50 space-y-2.5 text-xs text-[var(--text-color)] leading-relaxed">
            <p>
              <span className="font-semibold text-rose-400">LifeMirror Desktop</span> was built with an uncompromising belief: <span className="underline decoration-rose-500/40 underline-offset-2">your attention and personal activity data belong solely to you</span>.
            </p>
            <p className="text-[var(--text-muted)]">
              There are no venture capital pressures, no telemetry trackers, no selling of your metrics, and no artificial paywalls. Just honest, local-first engineering crafted to bring calm awareness to your everyday digital life.
            </p>
            <p className="text-[var(--text-muted)] font-medium">
              If LifeMirror helps you understand where your hours go, stay focused, or bring peace of mind to your workflow, fueling this project keeps it vibrant, maintained, and completely independent.
            </p>
          </div>

          {/* Pillars of LifeMirror */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/30">
              <ShieldCheck className="w-4 h-4 mx-auto text-emerald-400 mb-1" />
              <span className="block text-[11px] font-semibold text-[var(--text-color)]">100% Private</span>
              <span className="block text-[9px] text-[var(--text-muted)]">Zero cloud tracking</span>
            </div>
            <div className="p-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/30">
              <Code2 className="w-4 h-4 mx-auto text-sky-400 mb-1" />
              <span className="block text-[11px] font-semibold text-[var(--text-color)]">Local-First</span>
              <span className="block text-[9px] text-[var(--text-muted)]">Encrypted SQLite</span>
            </div>
            <div className="p-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/30">
              <Sparkles className="w-4 h-4 mx-auto text-amber-400 mb-1" />
              <span className="block text-[11px] font-semibold text-[var(--text-color)]">No Ad Ware</span>
              <span className="block text-[9px] text-[var(--text-muted)]">Pure utility</span>
            </div>
          </div>

          {/* Support Channels */}
          <div className="space-y-2.5">
            <span className="block text-xs font-semibold text-[var(--text-color)] uppercase tracking-wider">
              Ways to Fuel & Motivate:
            </span>

            {/* Buy Me A Coffee */}
            <button
              onClick={() => handleOpenLink(BUY_ME_A_COFFEE_URL, "Buy Me a Coffee")}
              className="w-full p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-left transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                  <Coffee className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[var(--text-color)] group-hover:text-amber-400 transition-colors block">
                    Buy Us a Coffee
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] block">
                    A quick and joyful way to fuel late-night coding sessions
                  </span>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-amber-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* GitHub Sponsors */}
            <button
              onClick={() => handleOpenLink(GITHUB_SPONSORS_URL, "GitHub Sponsors")}
              className="w-full p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-left transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
                  <Heart className="w-4 h-4 fill-rose-400/20" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[var(--text-color)] group-hover:text-rose-400 transition-colors block">
                    Sponsor on GitHub
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] block">
                    Support open developer craft month-over-month
                  </span>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-rose-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* Send Warm Words / Motivation */}
            <button
              onClick={handleSendMotivationEmail}
              className="w-full p-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-left transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[var(--text-color)] group-hover:text-indigo-400 transition-colors block">
                    Send Words of Motivation
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] block">
                    Warm feedback from users means the world to our hearts
                  </span>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-indigo-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* Rate / Support on Chrome Web Store */}
            <button
              onClick={() => handleOpenLink(CHROME_STORE_URL, "Chrome Web Store")}
              className="w-full p-3 rounded-xl border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-left transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-500/20 text-violet-400">
                  <Star className="w-4 h-4 fill-violet-400/20" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-[var(--text-color)] group-hover:text-violet-400 transition-colors block">
                      Support on Chrome Web Store
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-medium">Chrome, Brave, Edge, Arc</span>
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)] block">
                    Install or leave a 5-star review for the companion extension
                  </span>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-violet-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Status feedback */}
          {statusMessage && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 text-center animate-in fade-in">
              {statusMessage}
            </p>
          )}

          {/* Direct contact & UPI / inquiry footer */}
          <div className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/40 flex items-center justify-between gap-3 text-xs">
            <div className="min-w-0">
              <span className="text-[10px] text-[var(--text-muted)] block">Direct Developer Contact & Inquiries</span>
              <span className="font-mono text-xs text-[var(--text-color)] font-medium truncate block">{DONATION_EMAIL}</span>
            </div>
            <button
              onClick={handleCopyEmail}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-color)] hover:bg-zinc-500/10 text-xs font-medium text-[var(--text-color)] transition-colors cursor-pointer shrink-0"
              title="Copy developer email address"
            >
              {copiedEmail ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
