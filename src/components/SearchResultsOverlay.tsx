import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Search, Calendar, Loader2, Brain, Sparkles, Clock, CornerDownLeft, X, Layers } from "lucide-react";
import type { ActivityNode, MemoryNode } from "../types";
import { sound } from "../utils/sound";

interface SearchResultsOverlayProps {
  isOpen: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: ActivityNode[];
  memoryResults: MemoryNode[];
  isSearching: boolean;
  onResultClick: (activity: ActivityNode | MemoryNode) => void;
  onClose: () => void;
}

type SearchItem = 
  | { type: "memory"; item: MemoryNode }
  | { type: "activity"; item: ActivityNode };

export const SearchResultsOverlay: React.FC<SearchResultsOverlayProps> = ({
  isOpen,
  searchQuery,
  setSearchQuery,
  searchResults,
  memoryResults,
  isSearching,
  onResultClick,
  onClose,
}) => {
  const [filter, setFilter] = useState<"all" | "memories" | "activities">("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Combine results into an indexed list
  const combinedItems = useMemo<SearchItem[]>(() => {
    const list: SearchItem[] = [];
    if (filter === "all" || filter === "memories") {
      memoryResults.forEach((m) => list.push({ type: "memory", item: m }));
    }
    if (filter === "all" || filter === "activities") {
      searchResults.forEach((a) => list.push({ type: "activity", item: a }));
    }
    return list;
  }, [filter, memoryResults, searchResults]);

  // Reset selected index if list length changes
  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(0, combinedItems.length - 1)));
  }, [combinedItems.length]);

  // Handle keyboard navigation: ArrowUp, ArrowDown, Enter, Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = prev < combinedItems.length - 1 ? prev + 1 : 0;
          sound.playClick();
          return next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : combinedItems.length - 1;
          sound.playClick();
          return next;
        });
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = combinedItems[selectedIndex];
        if (selected) {
          sound.playFocusIgnite();
          onResultClick(selected.item);
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, combinedItems, selectedIndex, onResultClick, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const el = document.getElementById(`spotlight-item-${selectedIndex}`);
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-16 sm:pt-24 p-4 animate-in fade-in duration-200">
      {/* Cinematic Backdrop Blur */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Floating Spotlight Palette */}
      <div className="relative w-full max-w-2xl bg-[var(--card-bg)]/95 dark:bg-zinc-950/95 backdrop-blur-2xl border border-violet-500/30 rounded-3xl shadow-2xl shadow-violet-950/40 overflow-hidden flex flex-col max-h-[75vh] z-10 animate-in zoom-in-95 duration-200">
        
        {/* Search Header Bar */}
        <div className="p-4 sm:p-5 border-b border-[var(--border-color)] bg-[var(--bg-color)]/40 flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0">
            {isSearching ? (
              <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
            ) : (
              <Search className="w-4 h-4 text-violet-400" />
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search any thought, code, or article you've ever touched..."
            className="flex-1 bg-transparent text-sm sm:text-base font-medium text-[var(--text-color)] placeholder:text-zinc-500 focus:outline-none"
          />

          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="p-1 rounded-lg hover:bg-zinc-500/10 text-[var(--text-muted)] hover:text-[var(--text-color)] transition-colors cursor-pointer text-xs"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <kbd
            onClick={onClose}
            className="px-2 py-1 text-[10px] font-mono font-bold text-[var(--text-muted)] hover:text-[var(--text-color)] bg-zinc-800/60 hover:bg-zinc-800 rounded-lg border border-white/5 cursor-pointer transition-colors"
          >
            ESC
          </kbd>
        </div>

        {/* Filter Pills Bar */}
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-[var(--border-color)]/50 bg-[var(--bg-color)]/20 text-xs">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1 rounded-xl font-semibold transition-all cursor-pointer ${
              filter === "all"
                ? "bg-violet-600 text-white shadow-xs"
                : "text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-zinc-500/10"
            }`}
          >
            All Results ({memoryResults.length + searchResults.length})
          </button>
          <button
            onClick={() => setFilter("memories")}
            className={`px-3 py-1 rounded-xl font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              filter === "memories"
                ? "bg-violet-600 text-white shadow-xs"
                : "text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-zinc-500/10"
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Memories ({memoryResults.length})</span>
          </button>
          <button
            onClick={() => setFilter("activities")}
            className={`px-3 py-1 rounded-xl font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              filter === "activities"
                ? "bg-violet-600 text-white shadow-xs"
                : "text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-zinc-500/10"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Episodes ({searchResults.length})</span>
          </button>
        </div>

        {/* Results List View */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-1">
          {searchQuery.trim().length < 2 ? (
            <div className="py-12 px-6 text-center space-y-2">
              <Sparkles className="w-8 h-8 text-violet-400/40 mx-auto animate-pulse" />
              <p className="text-sm font-semibold text-[var(--text-color)]">
                The Omniscient Memory Spotlight
              </p>
              <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                Type 2 or more characters to recall any moment, application, or chronicled memory from your life.
              </p>
            </div>
          ) : combinedItems.length === 0 && !isSearching ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)]">
              No matching memories or activities found for "{searchQuery}".
            </div>
          ) : (
            combinedItems.map((entry, index) => {
              const isSelected = selectedIndex === index;

              if (entry.type === "memory") {
                const mem = entry.item;
                const d = new Date(mem.timestamp);
                const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

                return (
                  <div
                    key={`mem-${mem.id || index}-${mem.timestamp}`}
                    id={`spotlight-item-${index}`}
                    onClick={() => {
                      sound.playFocusIgnite();
                      onResultClick(mem);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                      isSelected
                        ? "bg-violet-500/15 border-violet-500/50 shadow-md shadow-violet-500/10 scale-[1.01]"
                        : "border-transparent hover:bg-zinc-500/5"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Brain className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 shrink-0">
                            Memory
                          </span>
                          <span className="text-sm font-bold text-[var(--text-color)] truncate">
                            {mem.title}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-[var(--text-muted)] shrink-0 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {dateStr}
                        </span>
                      </div>

                      {mem.summary && (
                        <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                          {mem.summary}
                        </p>
                      )}
                    </div>

                    {isSelected && (
                      <div className="shrink-0 flex items-center gap-1 text-[11px] font-mono text-violet-400 font-semibold self-center">
                        <span>Inspect</span>
                        <CornerDownLeft className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                );
              }

              // Activity / Episode
              const act = entry.item;
              const d = new Date(act.start_time);
              const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
              const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

              return (
                <div
                  key={`act-${act.id || index}-${act.start_time}`}
                  id={`spotlight-item-${index}`}
                  onClick={() => {
                    sound.playFocusIgnite();
                    onResultClick(act);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                    isSelected
                      ? "bg-violet-500/15 border-violet-500/50 shadow-md shadow-violet-500/10 scale-[1.01]"
                      : "border-transparent hover:bg-zinc-500/5"
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] flex items-center justify-center shrink-0 mt-0.5 overflow-hidden">
                    <img
                      src={act.icon_url || `https://www.google.com/s2/favicons?domain=${act.domain_tag || "google.com"}&sz=32`}
                      alt="icon"
                      className="w-5 h-5 rounded"
                      onError={(e) => {
                        e.currentTarget.src = `https://www.google.com/s2/favicons?domain=google.com&sz=32`;
                      }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm font-bold text-[var(--text-color)] truncate">
                        {act.app_name}
                      </span>
                      <span className="text-[11px] font-mono text-[var(--text-muted)] shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {dateStr} · {timeStr}
                      </span>
                    </div>

                    <p className="text-xs text-[var(--text-muted)] truncate">
                      {act.window_title}
                    </p>

                    {act.notes && (
                      <div className="mt-1 text-[11px] bg-[var(--bg-color)]/60 border border-[var(--border-color)] px-2.5 py-1 rounded-lg text-violet-300 italic truncate">
                        "{act.notes}"
                      </div>
                    )}
                  </div>

                  {isSelected && (
                    <div className="shrink-0 flex items-center gap-1 text-[11px] font-mono text-violet-400 font-semibold self-center">
                      <span>Inspect</span>
                      <CornerDownLeft className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Spotlight Footer Keyboard Hints */}
        <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-color)]/60 flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/5">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/5">↓</kbd>
              <span>navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/5">↵</kbd>
              <span>inspect & warp</span>
            </span>
          </div>

          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/5">esc</kbd>
            <span>close</span>
          </span>
        </div>

      </div>
    </div>,
    document.body
  );
};
