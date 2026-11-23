import React, { useState, useEffect } from "react";
import { X, Copy, Check, FileText, BookOpen, Sparkles } from "lucide-react";
import type { ActivityNode, DailySummary } from "../types";
import type { ProductivityMetrics } from "../services/analytics";
import { generateMarkdownJournal, generateAggregateJournal } from "../services/reports";
import { MarkdownRenderer } from "../utils/markdownRenderer";
import { sound } from "../utils/sound";

interface ExportJournalModalProps {
  date: string;
  activities?: ActivityNode[];
  metrics?: ProductivityMetrics;
  weeklySummaries?: DailySummary[];
  monthlySummaries?: DailySummary[];
  viewMode: "daily" | "weekly" | "monthly";
  onClose: () => void;
}

export const ExportJournalModal: React.FC<ExportJournalModalProps> = ({
  date,
  activities,
  metrics,
  weeklySummaries,
  monthlySummaries,
  viewMode,
  onClose,
}) => {
  const [markdown, setMarkdown] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"letterpress" | "source">("letterpress");

  useEffect(() => {
    let md = "";
    if (viewMode === "daily" && activities && metrics) {
      md = generateMarkdownJournal(date, activities, metrics);
    } else if (viewMode === "weekly" && weeklySummaries) {
      md = generateAggregateJournal(date, weeklySummaries, "Weekly");
    } else if (viewMode === "monthly" && monthlySummaries) {
      md = generateAggregateJournal(date, monthlySummaries, "Monthly");
    }
    setMarkdown(md);
  }, [date, activities, metrics, weeklySummaries, monthlySummaries, viewMode]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      sound.playCelebration();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard", err);
    }
  };

  const periodLabel = viewMode === "daily" 
    ? new Date(date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : viewMode === "weekly"
      ? `Week of ${new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
      : `${new Date(date).toLocaleDateString(undefined, { month: "long", year: "numeric" })}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col h-[85vh] animate-in zoom-in-95 duration-200">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border-b border-[var(--border-color)] bg-[var(--bg-color)]/50 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20">
                {viewMode.toUpperCase()} EDITION
              </span>
              <span className="text-xs text-[var(--text-muted)] font-mono">· {periodLabel}</span>
            </div>
            <h2 className="text-lg font-serif font-bold text-[var(--text-color)]">The Letterpress Executive Journal</h2>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Segmented View Mode Toggle */}
            <div className="flex p-1 rounded-xl bg-[var(--bg-color)]/80 border border-[var(--border-color)] text-xs">
              <button
                onClick={() => {
                  setActiveTab("letterpress");
                  sound.playClick();
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  activeTab === "letterpress"
                    ? "bg-violet-600 text-white shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-color)]"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Letterpress</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab("source");
                  sound.playClick();
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  activeTab === "source"
                    ? "bg-violet-600 text-white shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-color)]"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Markdown Source</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-zinc-500/10 text-[var(--text-muted)] hover:text-[var(--text-color)] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content View */}
        <div className="flex-1 p-6 overflow-y-auto bg-[var(--bg-color)]/30 custom-scrollbar">
          {activeTab === "letterpress" ? (
            /* The Letterpress Rendered Document */
            <div className="max-w-2xl mx-auto p-8 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)]/80 shadow-xl space-y-6">
              {/* Document Masthead */}
              <div className="text-center pb-6 border-b border-[var(--border-color)]/60 space-y-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-violet-400 font-mono">
                  LIFEMIRROR CHRONICLES
                </span>
                <h1 className="text-2xl font-serif font-bold text-[var(--text-color)] tracking-tight">
                  {viewMode === "daily" ? "Daily Devotion & Focus Record" : `${viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} Summary Chronicle`}
                </h1>
                <p className="text-xs text-[var(--text-muted)] font-mono">
                  Compiled on {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · {periodLabel}
                </p>
              </div>

              {/* Rendered Markdown Body */}
              <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed font-serif">
                <MarkdownRenderer content={markdown} />
              </div>
            </div>
          ) : (
            /* Monospace Source Textarea */
            <div className="h-full flex flex-col border border-[var(--border-color)] rounded-2xl overflow-hidden bg-[var(--card-bg)]">
              <textarea
                className="flex-1 w-full p-4 bg-transparent text-xs text-[var(--text-color)] font-mono resize-none focus:outline-none focus:ring-1 focus:ring-violet-500/30 custom-scrollbar"
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                spellCheck={false}
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-color)]/60 flex items-center justify-between">
          <div className="text-[11px] text-[var(--text-muted)] font-mono flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span>Ready for Obsidian, Notion, or Substack export</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-zinc-500/10 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              onClick={handleCopy}
              className="px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-600/25 flex items-center gap-2 transition-all cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Journal to Clipboard</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
