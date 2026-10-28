import React, { useState, useEffect } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getVersion } from "@tauri-apps/api/app";
import { 
  Mail, 
  Copy, 
  Check, 
  ExternalLink, 
  LifeBuoy, 
  X, 
  Bug, 
  Lightbulb, 
  MessageSquare,
  Sparkles,
  Globe
} from "lucide-react";

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SupportType = "general" | "bug" | "feature";

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  const [supportType, setSupportType] = useState<SupportType>("general");
  const [userNotes, setUserNotes] = useState("");
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [appVersion, setAppVersion] = useState("1.3.1");
  const [launchStatus, setLaunchStatus] = useState<string | null>(null);

  const SUPPORT_EMAIL = "vrpieapps@gmail.com";

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion("1.3.1"));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getSubject = () => {
    switch (supportType) {
      case "bug":
        return `[LifeMirror Desktop] Bug Report - v${appVersion}`;
      case "feature":
        return `[LifeMirror Desktop] Feature Idea & Suggestion - v${appVersion}`;
      case "general":
      default:
        return `[LifeMirror Desktop] Support Request & Feedback - v${appVersion}`;
    }
  };

  const getBody = () => {
    const userMessage = userNotes.trim() ? userNotes.trim() : "[Please describe your issue, question, or feature idea here]";
    return `Hello LifeMirror Support Team,

${userMessage}

---
System & App Information:
• LifeMirror Desktop Version: v${appVersion}
• Platform: ${navigator.userAgent.includes("Windows") ? "Windows" : navigator.userAgent.includes("Mac") ? "macOS" : "Linux / Desktop"}
• Timestamp: ${new Date().toLocaleString()}
`;
  };

  const handleOpenMailClient = async () => {
    try {
      const subject = encodeURIComponent(getSubject());
      const body = encodeURIComponent(getBody());
      const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
      await openUrl(mailtoUrl);
      setLaunchStatus("Opening your default mail client...");
      setTimeout(() => setLaunchStatus(null), 4000);
    } catch (err) {
      console.error("Failed to open mail client:", err);
      setLaunchStatus("Could not open default mail client. Please use Gmail Web or copy email below.");
    }
  };

  const handleOpenWebGmail = async () => {
    try {
      const subject = encodeURIComponent(getSubject());
      const body = encodeURIComponent(getBody());
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${SUPPORT_EMAIL}&su=${subject}&body=${body}`;
      await openUrl(gmailUrl);
      setLaunchStatus("Opening Gmail in your browser...");
      setTimeout(() => setLaunchStatus(null), 4000);
    } catch (err) {
      console.error("Failed to open Gmail in browser:", err);
      handleCopyEmail();
    }
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    } catch (err) {
      console.error("Failed to copy email:", err);
    }
  };

  const handleCopyTemplate = async () => {
    try {
      const template = `To: ${SUPPORT_EMAIL}
Subject: ${getSubject()}

${getBody()}`;
      await navigator.clipboard.writeText(template);
      setCopiedTemplate(true);
      setTimeout(() => setCopiedTemplate(false), 2500);
    } catch (err) {
      console.error("Failed to copy template:", err);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-xl glass rounded-2xl shadow-2xl border border-[var(--border-color)] overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] bg-[var(--surface-color)]/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h3 id="support-modal-title" className="text-base font-bold text-[var(--text-color)] leading-tight">
                Get Help & Share Feedback
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Direct help from the creator • {SUPPORT_EMAIL}
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

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
          {/* Email Quick-Copy Banner */}
          <div className="p-3.5 rounded-xl border border-sky-500/20 bg-sky-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-sky-400 shrink-0" />
              <div>
                <span className="text-[11px] text-[var(--text-muted)] font-medium block">Official Support Email</span>
                <span className="font-mono text-sm font-semibold text-[var(--text-color)] select-all">{SUPPORT_EMAIL}</span>
              </div>
            </div>
            <button
              onClick={handleCopyEmail}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 transition-colors cursor-pointer shrink-0"
              title="Copy email to clipboard"
            >
              {copiedEmail ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Email</span>
                </>
              )}
            </button>
          </div>

          {/* Browser Companion Extension Banner */}
          <div className="p-3 rounded-xl border border-violet-500/20 bg-violet-500/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400 shrink-0">
                <Globe className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-[var(--text-color)]">Companion Browser Extension</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 font-semibold border border-violet-500/20">Chrome Web Store</span>
                </div>
                <p className="text-[10px] text-[var(--text-muted)] truncate">
                  Supported: Chrome, Brave, Edge, Arc, Opera, Vivaldi & all Chromium browsers
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openUrl("https://chromewebstore.google.com/detail/lifemirror-desktop/pblffjiaheggbamkjaojabdaemkflhmm")}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 text-xs font-medium transition-colors shrink-0 cursor-pointer"
            >
              <span>Store Link</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {/* Topic Selector */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-color)] uppercase tracking-wider mb-2">
              Select What You Need Help With:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSupportType("general")}
                className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  supportType === "general"
                    ? "border-sky-500 bg-sky-500/10 text-sky-400 shadow-sm"
                    : "border-[var(--border-color)] bg-[var(--bg-color)]/40 text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-[var(--bg-color)]/70"
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span className="text-xs font-medium">General Help</span>
              </button>

              <button
                type="button"
                onClick={() => setSupportType("bug")}
                className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  supportType === "bug"
                    ? "border-rose-500 bg-rose-500/10 text-rose-400 shadow-sm"
                    : "border-[var(--border-color)] bg-[var(--bg-color)]/40 text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-[var(--bg-color)]/70"
                }`}
              >
                <Bug className="w-4 h-4" />
                <span className="text-xs font-medium">Report a Bug</span>
              </button>

              <button
                type="button"
                onClick={() => setSupportType("feature")}
                className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  supportType === "feature"
                    ? "border-amber-500 bg-amber-500/10 text-amber-400 shadow-sm"
                    : "border-[var(--border-color)] bg-[var(--bg-color)]/40 text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-[var(--bg-color)]/70"
                }`}
              >
                <Lightbulb className="w-4 h-4" />
                <span className="text-xs font-medium">Feature Idea</span>
              </button>
            </div>
          </div>

          {/* Subject Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Prefilled Subject Line</label>
              <span className="text-[10px] text-zinc-500 font-mono">Auto-generated</span>
            </div>
            <div className="w-full bg-[var(--bg-color)]/60 border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-medium text-[var(--text-color)] font-mono select-all">
              {getSubject()}
            </div>
          </div>

          {/* Optional Message / Notes */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Your Message / Context (Optional)</label>
              <span className="text-[10px] text-zinc-500">Will be included in the email body</span>
            </div>
            <textarea
              rows={3}
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              placeholder="e.g. I noticed the timeline was paused after sleep mode, or here's an idea for a new feature..."
              className="w-full bg-[var(--bg-color)]/60 border border-[var(--border-color)] rounded-xl p-3 text-xs text-[var(--text-color)] focus:outline-none focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/50 placeholder:text-zinc-500/50 resize-none transition-all"
            />
          </div>

          {/* Status feedback */}
          {launchStatus && (
            <p className="text-xs text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded-lg px-3 py-2 animate-in fade-in">
              {launchStatus}
            </p>
          )}

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-1">
            <button
              onClick={handleOpenMailClient}
              className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-sky-600/20 hover:shadow-sky-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Mail className="w-4 h-4" />
              <span>Open in Email App</span>
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={handleOpenWebGmail}
                className="py-2 px-3 rounded-xl text-xs font-medium border border-[var(--border-color)] bg-[var(--bg-color)]/50 hover:bg-zinc-500/10 text-[var(--text-color)] transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                <span>Open Gmail in Browser</span>
              </button>

              <button
                onClick={handleCopyTemplate}
                className="py-2 px-3 rounded-xl text-xs font-medium border border-[var(--border-color)] bg-[var(--bg-color)]/50 hover:bg-zinc-500/10 text-[var(--text-color)] transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {copiedTemplate ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Template Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <span>Copy Email & Message</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Trust reassurance */}
          <div className="pt-2 border-t border-[var(--border-color)]/60 text-center">
            <p className="text-[11px] text-[var(--text-muted)] flex items-center justify-center gap-1.5">
              <Sparkles className="w-3 h-3 text-sky-400 shrink-0" />
              <span>We read every message and respond promptly to all questions and feedback.</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
