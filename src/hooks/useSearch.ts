import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ActivityNode } from "../types";

export function useSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ActivityNode[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    // If the query is too short, clear results immediately
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    
    // Debounce the search invocation by 300ms
    const timer = setTimeout(async () => {
      try {
        const results = await invoke<ActivityNode[]>("search_activities", {
          query: searchQuery.trim(),
          limit: 50, // Hard limit of 50 results to prevent overwhelming the UI
        });
        setSearchResults(results);
      } catch (err) {
        console.error("Search failed:", err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
  };
}
