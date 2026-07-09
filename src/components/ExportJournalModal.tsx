import React, { useState, useEffect } from "react";
import { X, Copy, CheckCircle } from "lucide-react";
import type { ActivityNode, DailySummary } from "../types";
import type { ProductivityMetrics } from "../services/analytics";
import { generateMarkdownJournal, generateAggregateJournal } from "../services/reports";

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
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col h-[80vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)] bg-[var(--bg-color)]/50">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-color)]">Export {viewMode === "daily" ? "Daily" : viewMode === "weekly" ? "Weekly" : "Monthly"} Journal</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Your AI-generated markdown work log for {
                viewMode === "daily" 
                  ? new Date(date).toLocaleDateString()
                  : viewMode === "weekly"
                    ? "the week"
                    : "the month"
              }.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-zinc-500/10 text-[var(--text-muted)] hover:text-[var(--text-color)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-hidden flex flex-col bg-[var(--bg-color)]/20">
          <div className="relative flex-1 flex flex-col group border border-[var(--border-color)] rounded-2xl overflow-hidden bg-[var(--bg-color)]/50">
            <textarea
              className="flex-1 w-full p-4 bg-transparent text-sm text-[var(--text-color)] font-mono resize-none focus:outline-none focus:ring-1 focus:ring-violet-500/30 scrollbar-thin"
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              spellCheck={false}
            />
            
            {/* Overlay Copy Button */}
            <button
              onClick={handleCopy}
              className={`absolute top-4 right-4 flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs transition-all cursor-pointer shadow-md backdrop-blur-md border ${
                copied 
                  ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/30" 
                  : "bg-zinc-800/80 text-white hover:bg-zinc-700 border-zinc-600/50 opacity-0 group-hover:opacity-100"
              }`}
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Markdown
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-color)]/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-[var(--bg-color)] border border-[var(--border-color)] hover:bg-zinc-500/10 text-sm font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
