import React from "react";
import {
  ShieldAlert, Settings as SettingsIcon, Sun, Moon, Search, Volume2, VolumeX
} from "lucide-react";
import { useSoundState } from "../utils/sound";

interface HeaderProps {
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;
  isIncognito: boolean;
  trackingActive: boolean;
  activeAppName?: string;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  onOpenSpotlight: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  setTheme,
  isIncognito,
  trackingActive,
  activeAppName,
  showSettings,
  setShowSettings,
  onOpenSpotlight,
}) => {
  const [isSoundEnabled, toggleSound] = useSoundState();
  return (
    <header className="sticky top-0 z-40 glass border-b border-[var(--border-color)] px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4">
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <img 
          src="/icon.png" 
          className="w-8 h-8 sm:w-9 sm:h-9 object-contain rounded-xl shadow-lg shadow-violet-500/10" 
          alt="LifeMirror Desktop Logo" 
        />
        <div className="hidden min-[480px]:block">
          <div className="flex items-center gap-1.5">
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-[var(--text-color)] leading-none">LifeMirror Desktop</h1>
            {import.meta.env.DEV && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                DEV
              </span>
            )}
          </div>
          <span className="text-[9px] sm:text-[10px] text-[var(--text-muted)] font-medium tracking-wide">Your Mind's River</span>
        </div>
      </div>
      
      {/* Omniscient Spotlight Search Bar Trigger */}
      <div className="flex-1 max-w-md mx-2 sm:mx-8 relative">
        <button
          onClick={onOpenSpotlight}
          className="flex items-center justify-between w-full bg-[var(--bg-color)]/60 hover:bg-[var(--bg-color)] border border-[var(--border-color)] hover:border-violet-500/40 rounded-xl py-1.5 sm:py-2 pl-3.5 pr-2.5 text-xs sm:text-sm text-[var(--text-muted)] hover:text-[var(--text-color)] transition-all cursor-pointer group shadow-inner"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-violet-400 group-hover:scale-110 transition-transform" />
            <span className="truncate">Search memories, run commands...</span>
          </div>
          <kbd className="hidden min-[480px]:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono font-bold text-[var(--text-muted)] bg-zinc-800/60 rounded-md border border-white/5">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Unified tracking status pill */}
        {isIncognito ? (
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-amber-950/40 border border-amber-800/40 text-amber-400 text-[10px] sm:text-xs font-semibold">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">INCOGNITO</span>
          </div>
        ) : trackingActive ? (
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-700/40 text-emerald-400 text-[10px] sm:text-xs font-semibold" title="LifeMirror is recording your activity">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
            <span className="hidden sm:inline truncate max-w-[120px]">{activeAppName ? activeAppName : "Recording"}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-zinc-800/40 border border-zinc-700/40 text-zinc-500 text-[10px] sm:text-xs font-semibold" title="Tracking is paused">
            <span className="w-2 h-2 rounded-full bg-zinc-500 shrink-0" />
            <span className="hidden sm:inline">Paused</span>
          </div>
        )}

        <button
          onClick={toggleSound}
          className="p-2 sm:p-2.5 rounded-xl transition-all border border-[var(--border-color)] hover:bg-zinc-500/10 text-[var(--text-muted)] hover:text-[var(--text-color)] cursor-pointer"
          title={isSoundEnabled ? "Acoustic Effects: On (Click to Mute)" : "Acoustic Effects: Muted (Click to Enable)"}
        >
          {isSoundEnabled ? (
            <Volume2 className="w-4 h-4 text-violet-400" />
          ) : (
            <VolumeX className="w-4 h-4 text-zinc-500" />
          )}
        </button>

        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-2 sm:p-2.5 rounded-xl transition-all border border-[var(--border-color)] hover:bg-zinc-500/10 text-[var(--text-muted)] hover:text-[var(--text-color)] cursor-pointer"
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-violet-600" />}
        </button>

        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 sm:p-2.5 rounded-xl transition-all border cursor-pointer ${
            showSettings 
              ? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-500/20" 
              : "hover:bg-zinc-500/10 border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-color)]"
          }`}
          title="Configuration"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
