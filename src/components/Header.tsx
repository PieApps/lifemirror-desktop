import React, { useRef } from "react";
import {
  ShieldAlert, Settings as SettingsIcon, RefreshCw, Sun, Moon, Search, LifeBuoy, Heart
} from "lucide-react";
import { useSearch } from "../hooks/useSearch";
import { SearchResultsOverlay } from "./SearchResultsOverlay";
import type { ActivityNode, MemoryNode } from "../types";

interface HeaderProps {
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;
  isIncognito: boolean;
  trackingActive: boolean;
  activeAppName?: string;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  onRefresh: () => void;
  onSearchSelect: (activity: ActivityNode | MemoryNode) => void;
  onResumeClick: () => void;
  onSupportClick: () => void;
  onDonateClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  setTheme,
  isIncognito,
  trackingActive,
  activeAppName,
  showSettings,
  setShowSettings,
  onRefresh,
  onSearchSelect,
  onResumeClick,
  onSupportClick,
  onDonateClick,
}) => {
  const search = useSearch();
  const searchContainerRef = useRef<HTMLDivElement>(null);
  return (
    <header className="sticky top-0 z-40 glass border-b border-[var(--border-color)] px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-4">
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <img 
          src="/icon.png" 
          className="w-8 h-8 sm:w-10 sm:h-10 object-contain rounded-xl shadow-lg shadow-violet-500/10" 
          alt="LifeMirror Desktop Logo" 
        />
        <div className="hidden min-[480px]:block">
          <h1 className="text-sm sm:text-base font-bold tracking-tight text-[var(--text-color)] leading-none">LifeMirror Desktop</h1>
          <span className="text-[9px] sm:text-[10px] text-[var(--text-muted)] font-medium tracking-wide">KNOW WHERE YOUR TIME WENT</span>
        </div>
      </div>
      
      {/* Search Bar */}
      <div className="flex-1 max-w-md mx-2 sm:mx-8 relative" ref={searchContainerRef}>
        <div className="relative flex items-center w-full">
          <Search className="absolute left-3 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
          <input
            type="text"
            placeholder="Search timeline..."
            value={search.searchQuery}
            onChange={(e) => search.setSearchQuery(e.target.value)}
            className="w-full bg-[var(--bg-color)]/60 border border-[var(--border-color)] rounded-xl py-1.5 sm:py-2 pl-9 sm:pl-10 pr-3 sm:pr-4 text-xs sm:text-sm text-[var(--text-color)] focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/50 placeholder:text-zinc-500/50 transition-all"
          />
        </div>
        
        {/* Results Overlay */}
        <SearchResultsOverlay
          searchQuery={search.searchQuery}
          searchResults={search.searchResults}
          memoryResults={search.memoryResults}
          isSearching={search.isSearching}
          onResultClick={(act) => {
            search.setSearchQuery("");
            onSearchSelect(act);
          }}
          onClose={() => search.setSearchQuery("")}
        />
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
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
          onClick={onResumeClick}
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-all border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 font-semibold text-xs sm:text-sm cursor-pointer"
          title="Resume your context"
        >
          <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden min-[640px]:inline">Resume Project</span>
        </button>

        {/* Motivate / Support Developer Button */}
        <button
          onClick={onDonateClick}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl transition-all border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold text-xs cursor-pointer group"
          title="Fuel Independent Craft / Motivate Developer"
        >
          <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400 fill-rose-400/20 group-hover:scale-110 transition-transform" />
          <span className="hidden xl:inline">Fuel Craft</span>
        </button>

        {/* Support & Assistance Button */}
        <button
          onClick={onSupportClick}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl transition-all border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 font-semibold text-xs cursor-pointer group"
          title="Support & Feedback (vrpieapps@gmail.com)"
        >
          <LifeBuoy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400 group-hover:rotate-45 transition-transform" />
          <span className="hidden xl:inline">Support</span>
        </button>

        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-2.5 rounded-xl transition-all border border-[var(--border-color)] hover:bg-zinc-500/10 text-[var(--text-muted)] hover:text-[var(--text-color)] cursor-pointer"
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-violet-600" />}
        </button>

        <button
          onClick={onRefresh}
          className="p-2.5 rounded-xl transition-all border border-[var(--border-color)] hover:bg-zinc-500/10 text-[var(--text-muted)] hover:text-[var(--text-color)] cursor-pointer"
          title="Refresh database"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2.5 rounded-xl transition-all border cursor-pointer ${
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
