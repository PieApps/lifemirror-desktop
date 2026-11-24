import React, { useState, useMemo, useEffect } from "react";
import { X, Copy, Check, BookOpen, Download, CheckCheck } from "lucide-react";
import { MarkdownRenderer } from "../utils/markdownRenderer";
import { sound } from "../utils/sound";
import type { VaultFileItem } from "./WikiVaultView";

interface MemoirModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultFiles: VaultFileItem[];
  onSaveToVault?: (relativePath: string, content: string) => Promise<void>;
}

type TimeHorizon = "30days" | "month" | "quarter" | "all";

export const MemoirModal: React.FC<MemoirModalProps> = ({
  isOpen,
  onClose,
  vaultFiles,
  onSaveToVault,
}) => {
  const [horizon, setHorizon] = useState<TimeHorizon>("month");
  const [viewMode, setViewMode] = useState<"letterpress" | "markdown">("letterpress");
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [customMarkdown, setCustomMarkdown] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      sound.playClick();
      setCustomMarkdown(null);
      setSavedSuccess(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const compiledMarkdown = useMemo(() => {
    if (customMarkdown !== null) return customMarkdown;

    const now = new Date();
    const dateFormatted = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    
    // Filter files based on horizon
    const periodicFiles = vaultFiles.filter((f) => f.category === "periodic");
    const projectFiles = vaultFiles.filter((f) => f.category === "projects");
    const sessionFiles = vaultFiles.filter((f) => f.category === "sessions");
    const topicFiles = vaultFiles.filter((f) => f.category === "topics" || f.category === "root");

    const horizonLabels: Record<TimeHorizon, string> = {
      "30days": "Past 30 Days",
      "month": `${now.toLocaleDateString("en-US", { month: "long" })} ${now.getFullYear()}`,
      "quarter": `Quarter ${Math.floor(now.getMonth() / 3) + 1} · ${now.getFullYear()}`,
      "all": "Entire Living Archive",
    };

    return `# 📖 The Creative Memoir of Focus & Craft

> *"We are here to put a dent in the universe. LifeMirror quietly preserves the footprints of human craft."*
> 
> **Time Horizon**: ${horizonLabels[horizon]}  
> **Anthology Compiled**: ${dateFormatted}  
> **Vault Storage**: 100% On-Device · Encrypted & Offline

---

## 🏛️ Executive Retrospective

- **Archival Chapters**: ${vaultFiles.length} notes and chronicles compiled
- **Periodic Reviews**: ${periodicFiles.length} daily, weekly, and monthly epilogues
- **Dedicated Project Vaults**: ${projectFiles.length} craft workspaces
- **Recorded Flow Sessions**: ${sessionFiles.length} preserved episodes
- **Ideas & Concepts**: ${topicFiles.length} creative topics

---

## Chapter I: The Chronicles of Flow

${periodicFiles.length > 0 ? periodicFiles.slice(0, 10).map((f) => {
  const name = f.name.replace(/\.md$/, "").replace(/_/g, " ");
  return `### 📅 [[${f.name.replace(/\.md$/, "")}|${name}]]
- *Category*: Periodic Chronicle
- *Updated*: ${f.updated_at || "Archived"}
- *File Reference*: \`${f.relative_path}\``;
}).join("\n\n") : "*No periodic chronicles recorded yet. Continue your daily reflections to build your rhythm.*"}

---

## Chapter II: The Project Tapestry

${projectFiles.length > 0 ? projectFiles.map((p) => {
  const title = p.name.replace(/\.md$/, "").replace(/_/g, " ");
  return `### ⚡ [[${p.name.replace(/\.md$/, "")}|${title}]]
- *Craft Workspace*: \`${p.relative_path}\`
- *Archived Scale*: ${(p.size / 1024).toFixed(1)} KB of deep notes`;
}).join("\n\n") : "*Your creative projects and codebases will automatically be woven here as you work.*"}

---

## Chapter III: Reflections & Breakthroughs

${sessionFiles.length > 0 ? sessionFiles.slice(0, 10).map((s) => {
  const title = s.name.replace(/\.md$/, "").replace(/_/g, " ");
  return `- [[${s.name.replace(/\.md$/, "")}|${title}]] · *${(s.size / 1024).toFixed(1)} KB*`;
}).join("\n") : "*Detailed flow sessions and thoughts are captured here.*"}

---

*LifeMirror Desktop · Memory Sealed in Personal Library*
`;
  }, [vaultFiles, horizon, customMarkdown]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(compiledMarkdown);
      sound.playCelebration();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy memoir:", err);
    }
  };

  const handleSaveVault = async () => {
    if (!onSaveToVault) return;
    setIsSaving(true);
    try {
      const timeSlug = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const path = `periodic/memoir_${horizon}_${timeSlug}.md`;
      await onSaveToVault(path, compiledMarkdown);
      sound.playCelebration();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save memoir to vault:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-4xl bg-zinc-950/95 border border-violet-500/30 rounded-3xl shadow-2xl shadow-violet-950/50 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Sheen */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-600 via-amber-500 to-emerald-400" />

        {/* Modal Topbar */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 shadow-md">
              <BookOpen className="w-5 h-5 text-violet-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  The Living Memoir Anthology
                </h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  Letterpress Archive
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Binds your focus rhythm, project notes, and epilogues into an archival memoir.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Horizon Selector */}
            <div className="flex items-center bg-zinc-900 border border-white/10 p-0.5 rounded-xl text-xs">
              {(["30days", "month", "quarter", "all"] as TimeHorizon[]).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setHorizon(h);
                    setCustomMarkdown(null);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer capitalize ${
                    horizon === h
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {h === "30days" ? "30 Days" : h}
                </button>
              ))}
            </div>

            {/* Segmented View Switcher */}
            <div className="flex items-center bg-zinc-900 border border-white/10 p-0.5 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setViewMode("letterpress");
                }}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  viewMode === "letterpress"
                    ? "bg-zinc-800 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Letterpress
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setViewMode("markdown");
                }}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  viewMode === "markdown"
                    ? "bg-zinc-800 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Markdown
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Canvas Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-zinc-950/80">
          {viewMode === "letterpress" ? (
            <div className="max-w-3xl mx-auto bg-zinc-900/50 border border-white/10 rounded-3xl p-6 sm:p-12 shadow-xl backdrop-blur-md">
              <div className="font-serif leading-relaxed text-zinc-200">
                <MarkdownRenderer content={compiledMarkdown} />
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              <textarea
                value={compiledMarkdown}
                onChange={(e) => setCustomMarkdown(e.target.value)}
                className="w-full h-[55vh] font-mono text-xs sm:text-sm p-5 rounded-2xl bg-zinc-900/90 border border-white/10 text-zinc-200 focus:outline-none focus:border-violet-500/50 resize-none shadow-inner leading-relaxed"
                placeholder="Memoir Markdown Source..."
              />
            </div>
          )}
        </div>

        {/* Sticky Action Footer */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-zinc-900/60 flex items-center justify-between gap-3">
          <div className="text-xs text-zinc-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Ready to preserve or publish to your archive.</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied Memoir!" : "Copy Memoir"}</span>
            </button>

            {onSaveToVault && (
              <button
                type="button"
                onClick={handleSaveVault}
                disabled={isSaving}
                className="px-5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-violet-950/40 transform active:scale-95 disabled:opacity-50"
              >
                {savedSuccess ? (
                  <CheckCheck className="w-4 h-4 text-emerald-300" />
                ) : (
                  <Download className="w-4 h-4 text-violet-200" />
                )}
                <span>{savedSuccess ? "Saved to Vault!" : "Save Memoir to Vault"}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
