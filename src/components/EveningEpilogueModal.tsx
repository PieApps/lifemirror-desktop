import React, { useState } from 'react';
import { X, Sparkles, Copy, CheckCheck, BookOpen, Moon, Compass } from 'lucide-react';
import { formatDuration } from '../utils/formatDuration';

interface EveningEpilogueModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  activitiesCount: number;
  episodesCount: number;
  totalFocusSeconds: number;
  synthesisMarkdown?: string;
  episodes?: Array<{ window_title: string; app_name: string; duration: number; isShield?: boolean }>;
  onOpenVaultFile?: () => void;
}

export const EveningEpilogueModal: React.FC<EveningEpilogueModalProps> = ({
  isOpen,
  onClose,
  dateStr,
  activitiesCount,
  episodesCount,
  totalFocusSeconds,
  synthesisMarkdown,
  episodes = [],
  onOpenVaultFile,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Extract a clean reflection text from synthesis markdown if available
  const cleanReflection = (() => {
    if (!synthesisMarkdown) return null;
    const lines = synthesisMarkdown.split('\n');
    const reflectionIdx = lines.findIndex(l => l.includes('Reflection') || l.includes('Synthesis'));
    if (reflectionIdx !== -1) {
      const extracted = lines.slice(reflectionIdx + 1, reflectionIdx + 6)
        .filter(l => !l.startsWith('#') && !l.startsWith('---') && l.trim().length > 0)
        .join(' ');
      if (extracted.trim()) return extracted.trim();
    }
    return null;
  })();

  // Extract up to 3 distinct highlights from episodes
  const highlights = episodes
    .filter(ep => !ep.isShield && ep.window_title && ep.window_title !== 'Creative Flow')
    .slice(0, 3)
    .map(ep => ({
      title: ep.window_title,
      app: ep.app_name,
      duration: ep.duration,
    }));

  const handleCopy = async () => {
    const textToCopy = `🌅 Evening Epilogue — ${dateStr}\n` +
      `⏱️ Total Flow: ${formatDuration(totalFocusSeconds)} across ${episodesCount} Chapters\n\n` +
      (cleanReflection ? `"${cleanReflection}"\n\n` : '') +
      `Highlights:\n` +
      highlights.map(h => `- ${h.title} (${h.app} · ${formatDuration(h.duration)})`).join('\n') +
      `\n\nPreserved privately with LifeMirror Desktop.`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy epilogue:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-xl glass rounded-3xl shadow-2xl border border-violet-500/20 overflow-hidden bg-gradient-to-b from-[var(--card-bg)] via-[var(--bg-color)] to-[var(--bg-color)] animate-in zoom-in-95 duration-300">
        
        {/* Subtle Specular Ambient Header Glow */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-[var(--border-color)]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-600/15 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <Moon className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-violet-500 dark:text-violet-400 uppercase tracking-widest block">
                Daily Closure
              </span>
              <h3 className="text-base font-semibold text-[var(--text-color)]">
                The Evening Epilogue
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-zinc-500/10 p-2 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Card Content */}
        <div className="p-7 space-y-6">
          
          {/* Hero River Miniature Visualization */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent border border-violet-500/20 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-violet-400 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5" />
                <span>Rhythm of Your Day</span>
              </span>
              <span className="text-xs font-mono text-[var(--text-muted)]">
                {dateStr}
              </span>
            </div>

            {/* Abstract Serpentine River Line */}
            <div className="h-14 w-full relative flex items-center justify-center">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 400 50">
                <defs>
                  <linearGradient id="riverGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
                    <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="1" />
                  </linearGradient>
                </defs>
                <path
                  d="M 10 25 C 90 5, 120 45, 200 25 C 280 5, 310 45, 390 25"
                  fill="none"
                  stroke="url(#riverGradient)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                {/* Luminous waypoint pearls along the river */}
                <circle cx="60" cy="18" r="4.5" className="fill-violet-400 animate-pulse" />
                <circle cx="200" cy="25" r="4.5" className="fill-purple-400" />
                <circle cx="340" cy="32" r="5" className="fill-violet-300 shadow-md" />
              </svg>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-2 pt-3 border-t border-[var(--border-color)]/40 text-center">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] block">Focused Flow</span>
                <span className="text-sm font-bold text-[var(--text-color)] font-mono">{formatDuration(totalFocusSeconds)}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] block">Chapters</span>
                <span className="text-sm font-bold text-[var(--text-color)] font-mono">{episodesCount}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] block">Activities</span>
                <span className="text-sm font-bold text-[var(--text-color)] font-mono">{activitiesCount}</span>
              </div>
            </div>
          </div>

          {/* Biographer's Literary Reflection */}
          <div className="p-4 rounded-2xl bg-[var(--bg-color)]/60 border border-[var(--border-color)]">
            <span className="text-[10px] font-bold text-violet-500 uppercase tracking-widest flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Biographer's Reflection</span>
            </span>
            <p className="text-sm text-[var(--text-color)] leading-relaxed italic font-serif">
              "{cleanReflection || 'A dedicated day of craftsmanship and quiet persistence. Your digital mind moved through chapters of focus, leaving meaningful artifacts along the river of time.'}"
            </p>
          </div>

          {/* Key Flow Highlights */}
          {highlights.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                Core Chapters Sculpted
              </span>
              <div className="space-y-1.5">
                {highlights.map((h, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border-color)]/50 text-xs">
                    <span className="font-medium text-[var(--text-color)] truncate max-w-[320px]">
                      {h.title}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)] bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-md shrink-0">
                      {formatDuration(h.duration)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[var(--border-color)]">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleCopy}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] hover:bg-[var(--border-color)] text-xs font-semibold text-[var(--text-color)] transition-all cursor-pointer"
                title="Copy Reflection Postcard to Clipboard"
              >
                {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-violet-400" />}
                <span>{copied ? 'Copied' : 'Copy Postcard'}</span>
              </button>

              {onOpenVaultFile && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenVaultFile();
                  }}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] hover:bg-[var(--border-color)] text-xs font-semibold text-[var(--text-color)] transition-all cursor-pointer"
                  title="Open Full Markdown in Personal Library"
                >
                  <BookOpen className="w-3.5 h-3.5 text-violet-400" />
                  <span>Library Note</span>
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-md shadow-violet-500/25 transition-all cursor-pointer"
            >
              Close & Rest
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
