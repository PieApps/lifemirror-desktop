import React from "react";
import { Search, ExternalLink, Calendar, Loader2, Brain } from "lucide-react";
import type { ActivityNode, MemoryNode } from "../types";

interface SearchResultsOverlayProps {
  searchQuery: string;
  searchResults: ActivityNode[];
  memoryResults: MemoryNode[];
  isSearching: boolean;
  onResultClick: (activity: ActivityNode | MemoryNode) => void;
  onClose: () => void;
}

export const SearchResultsOverlay: React.FC<SearchResultsOverlayProps> = ({
  searchQuery,
  searchResults,
  memoryResults,
  isSearching,
  onResultClick,
  onClose,
}) => {
  if (searchQuery.trim().length < 2) return null;

  return (
    <div className="absolute top-full right-0 mt-4 w-[500px] max-h-[600px] flex flex-col bg-white/85 dark:bg-[#0d0d11]/85 backdrop-blur-2xl border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
      
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-color)] bg-zinc-100/50 dark:bg-zinc-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isSearching ? (
            <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-[var(--text-muted)]" />
          )}
          <span className="text-sm font-semibold text-[var(--text-color)]">
            {searchResults.length + memoryResults.length} results for "{searchQuery}"
          </span>
        </div>
        <button 
          onClick={onClose}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-color)] font-medium transition-colors cursor-pointer"
        >
          Clear
        </button>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {searchResults.length === 0 && memoryResults.length === 0 && !isSearching ? (
          <div className="p-8 text-center text-[var(--text-muted)] text-sm">
            No matches found in your historical timeline.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {/* Semantic Memory Results Section */}
            {memoryResults.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-bold text-violet-500 uppercase tracking-wider mb-2 px-2 flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5" />
                  Semantic Memories
                </div>
                {memoryResults.map((mem, index) => {
                  const d = new Date(mem.timestamp);
                  const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                  return (
                    <button
                      key={`mem-${mem.id || index}-${mem.timestamp}`}
                      onClick={() => onResultClick(mem)}
                      className="flex flex-col text-left p-3 rounded-xl bg-violet-500/5 hover:bg-violet-500/15 transition-colors border border-violet-500/20 hover:border-violet-500/40 group cursor-pointer w-full mb-1"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Brain className="w-4 h-4 text-violet-400" />
                          <span className="text-sm font-bold text-[var(--text-color)] truncate max-w-[200px]">
                            {mem.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-mono text-[var(--text-muted)] group-hover:text-violet-400 transition-colors">
                          <Calendar className="w-3 h-3" />
                          {dateStr}
                        </div>
                      </div>
                      
                      {mem.summary && (
                        <span className="text-xs text-[var(--text-muted)] line-clamp-2 mb-1.5 leading-relaxed">
                          {mem.summary}
                        </span>
                      )}

                      <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ExternalLink className="w-4 h-4 text-violet-400" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Raw Activity Results Section */}
            {searchResults.length > 0 && (
              <div>
                <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 mt-4 px-2">
                  Raw Activities
                </div>
            {searchResults.map((act, index) => {
              const d = new Date(act.start_time);
              const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
              const hasNotes = act.notes && act.notes.trim().length > 0;

              return (
                <button
                  key={`${act.id || index}-${act.start_time}`}
                  onClick={() => onResultClick(act)}
                  className="flex flex-col text-left p-3 rounded-xl hover:bg-zinc-500/10 transition-colors border border-transparent hover:border-[var(--border-color)] group cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <img 
                        src={act.icon_url || `https://www.google.com/s2/favicons?domain=${act.domain_tag || 'google.com'}&sz=32`} 
                        alt="icon" 
                        className="w-4 h-4 rounded-sm"
                        onError={(e) => {
                          e.currentTarget.src = `https://www.google.com/s2/favicons?domain=google.com&sz=32`;
                        }}
                      />
                      <span className="text-sm font-bold text-[var(--text-color)] truncate max-w-[200px]">
                        {act.app_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-mono text-[var(--text-muted)] group-hover:text-violet-400 transition-colors">
                      <Calendar className="w-3 h-3" />
                      {dateStr}
                    </div>
                  </div>
                  
                  <span className="text-xs text-[var(--text-muted)] truncate mb-1.5">
                    {act.window_title}
                  </span>

                  {hasNotes && (
                    <div className="text-[11px] bg-[var(--bg-color)]/60 border border-[var(--border-color)] px-2.5 py-1.5 rounded-lg text-[var(--text-muted)] italic truncate">
                      <span className="font-semibold text-amber-500 not-italic mr-1">Note:</span>
                      {act.notes}
                    </div>
                  )}

                  <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink className="w-4 h-4 text-[var(--text-muted)]" />
                  </div>
                </button>
              );
            })}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
