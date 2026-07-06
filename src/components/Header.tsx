import React, { useRef } from "react";
import {
  ShieldAlert, Settings as SettingsIcon, RefreshCw, Sun, Moon, Search
} from "lucide-react";
import { useSearch } from "../hooks/useSearch";
import { SearchResultsOverlay } from "./SearchResultsOverlay";
import type { ActivityNode } from "../types";

interface HeaderProps {
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;
  isIncognito: boolean;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  onRefresh: () => void;
  onSearchSelect: (activity: ActivityNode) => void;
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  setTheme,
  isIncognito,
  showSettings,
  setShowSettings,
  onRefresh,
  onSearchSelect,
}) => {
  const search = useSearch();
  const searchContainerRef = useRef<HTMLDivElement>(null);
  return (
    <header className="sticky top-0 z-40 glass border-b border-[var(--border-color)] px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img 
          src="/icon.png" 
          className="w-10 h-10 object-contain rounded-xl shadow-lg shadow-violet-500/10" 
          alt="LifeMirror Logo" 
        />
        <div>
          <h1 className="text-base font-bold tracking-tight text-[var(--text-color)] leading-none">LifeMirror</h1>
          <span className="text-[10px] text-[var(--text-muted)] font-medium tracking-wide">KNOW WHERE YOUR TIME WENT</span>
        </div>
      </div>
      
      {/* Search Bar */}
      <div className="flex-1 max-w-md mx-8 relative" ref={searchContainerRef}>
        <div className="relative flex items-center w-full">
          <Search className="absolute left-3 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
          <input
            type="text"
            placeholder="Search timeline & journal notes..."
            value={search.searchQuery}
            onChange={(e) => search.setSearchQuery(e.target.value)}
            className="w-full bg-[var(--bg-color)]/60 border border-[var(--border-color)] rounded-xl py-2 pl-10 pr-4 text-sm text-[var(--text-color)] focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/50 placeholder:text-zinc-500/50 transition-all"
          />
        </div>
        
        {/* Results Overlay */}
        <SearchResultsOverlay
          searchQuery={search.searchQuery}
          searchResults={search.searchResults}
          isSearching={search.isSearching}
          onResultClick={(act) => {
            search.setSearchQuery("");
            onSearchSelect(act);
          }}
          onClose={() => search.setSearchQuery("")}
        />
      </div>

      <div className="flex items-center gap-3">
        {isIncognito && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/40 border border-amber-800/40 text-amber-400 text-xs font-semibold animate-pulse">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>INCOGNITO ACTIVE</span>
          </div>
        )}

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
