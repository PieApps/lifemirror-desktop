import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, Sparkles, Copy, CheckCheck, BookOpen, Moon, Compass, Award, Check } from 'lucide-react';
import { formatDuration } from '../utils/formatDuration';
import { sound } from '../utils/sound';

interface EveningEpilogueModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  activitiesCount: number;
  episodesCount: number;
  totalFocusSeconds: number;
  synthesisMarkdown?: string;
  episodes?: Array<{
    window_title: string;
    app_name: string;
    duration: number;
    isShield?: boolean;
    tools?: string[];
    toolsCount?: number;
  }>;
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
  const [isSealing, setIsSealing] = useState(false);
  const [isSealed, setIsSealed] = useState(false);

  useEffect(() => {
    if (isOpen) {
      sound.playEveningEpilogue();
    }
  }, [isOpen]);

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

  // Extract up to 4 distinct highlights from chapters/episodes
  const highlights = episodes
    .filter(ep => !ep.isShield && ep.window_title && ep.window_title !== 'Creative Flow')
    .slice(0, 4)
    .map(ep => ({
      title: ep.window_title,
      app: ep.app_name,
      duration: ep.duration,
      toolsCount: ep.toolsCount || (ep.tools ? ep.tools.length : 1),
    }));

  const handleSealCeremony = async () => {
    if (isSealing || isSealed) return;
    setIsSealing(true);
    try {
      await invoke('compile_period_note', {
        periodType: 'day',
        dateKey: dateStr,
      });
      sound.playIgniteFocus();
      setIsSealed(true);
    } catch (err) {
      console.error('Failed to seal chapter in vault:', err);
    } finally {
      setIsSealing(false);
    }
  };

  const handleCopy = async () => {
    const textToCopy = `🌅 Evening Epilogue — ${dateStr}\n` +
      `⏱️ Total Flow: ${formatDuration(totalFocusSeconds)} across ${episodesCount} Chapters\n\n` +
      (cleanReflection ? `"${cleanReflection}"\n\n` : '') +
      `Chapters Sculpted:\n` +
      highlights.map((h, i) => `#${i + 1} ${h.title} (${h.app} · ${formatDuration(h.duration)})`).join('\n') +
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
      <div className="relative w-full max-w-xl glass rounded-3xl shadow-2xl border border-amber-500/25 overflow-hidden bg-gradient-to-b from-[var(--card-bg)] via-[var(--bg-color)] to-[var(--bg-color)] animate-in zoom-in-95 duration-300">
        
        {/* Golden Hour Ambient Specular Glow */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-[var(--border-color)]/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-xs">
              <Moon className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-amber-500 dark:text-amber-400 uppercase tracking-widest block">
                Golden Hour Closure
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
        <div className="p-7 space-y-5">
          
          {/* Hero River Miniature Visualization */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-violet-500/5 to-transparent border border-amber-500/20 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5" />
                <span>Cadence of Your Day</span>
              </span>
              <span className="text-xs font-mono text-[var(--text-muted)] font-semibold">
                {dateStr}
              </span>
            </div>

            {/* Abstract Serpentine River Line with Warm Sunset Lighting */}
            <div className="h-12 w-full relative flex items-center justify-center">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 400 45">
                <defs>
                  <linearGradient id="epilogueRiverGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                    <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#ec4899" stopOpacity="0.8" />
                  </linearGradient>
                </defs>
                <path
                  d="M 10 22 C 90 4, 120 40, 200 22 C 280 4, 310 40, 390 22"
                  fill="none"
                  stroke="url(#epilogueRiverGradient)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <circle cx="60" cy="16" r="4.5" className="fill-amber-400 animate-pulse" />
                <circle cx="200" cy="22" r="4.5" className="fill-violet-400" />
                <circle cx="340" cy="28" r="5" className="fill-pink-400 shadow-md" />
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
            <span className="text-[10px] font-bold text-amber-500 dark:text-amber-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Biographer's Inscription</span>
            </span>
            <p className="text-xs sm:text-sm text-[var(--text-color)] leading-relaxed italic font-serif">
              "{cleanReflection || 'A dedicated day of craftsmanship and quiet persistence. Your digital mind moved through chapters of focus, leaving meaningful artifacts along the river of time.'}"
            </p>
          </div>

          {/* Key Flow Highlights */}
          {highlights.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                Chapters Sculpted Today
              </span>
              <div className="space-y-1.5">
                {highlights.map((h, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border-color)]/50 text-xs">
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded-md shrink-0">
                        #{i + 1}
                      </span>
                      <span className="font-semibold text-[var(--text-color)] truncate">
                        {h.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-[var(--text-muted)] hidden sm:inline">
                        {h.app}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-[var(--text-color)] bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-md">
                        {formatDuration(h.duration)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ceremony Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[var(--border-color)]">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Seal & Inscribe Chapter Button */}
              <button
                onClick={handleSealCeremony}
                disabled={isSealing}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md ${
                  isSealed
                    ? "bg-emerald-600 text-white shadow-emerald-500/20"
                    : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold shadow-amber-500/20"
                }`}
                title="Seal Today's Chapter and inscribe permanently to Obsidian Vault"
              >
                {isSealing ? (
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : isSealed ? (
                  <Check className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Award className="w-3.5 h-3.5 text-black" />
                )}
                <span>{isSealing ? "Inscribing..." : isSealed ? "✓ Sealed to Vault" : "Seal & Inscribe Chapter"}</span>
              </button>

              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] hover:bg-[var(--border-color)] text-xs font-semibold text-[var(--text-color)] transition-all cursor-pointer"
                title="Copy Reflection Postcard to Clipboard"
              >
                {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-violet-400" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              {onOpenVaultFile && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenVaultFile();
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] hover:bg-[var(--border-color)] text-xs font-semibold text-[var(--text-color)] transition-all cursor-pointer"
                  title="Open Markdown in Obsidian Vault"
                >
                  <BookOpen className="w-3.5 h-3.5 text-violet-400" />
                  <span className="hidden sm:inline">Vault</span>
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600 text-violet-200 hover:text-white text-xs font-semibold border border-violet-500/30 transition-all cursor-pointer"
            >
              Close & Rest
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
