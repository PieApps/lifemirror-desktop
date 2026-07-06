import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ActivityNode, MemoryNode } from "../types";

export function useSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ActivityNode[]>([]);
  const [memoryResults, setMemoryResults] = useState<MemoryNode[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    // If the query is too short, clear results immediately
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setMemoryResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    
    // Debounce the search invocation by 300ms
    const timer = setTimeout(async () => {
      try {
        const query = searchQuery.trim();
        
        const [rawResultsResult, memoryResultsResult] = await Promise.allSettled([
          invoke<ActivityNode[]>("search_activities", { query, limit: 30 }),
          invoke<MemoryNode[]>("search_memory_nodes", { query, limit: 5 })
        ]);

        if (rawResultsResult.status === "fulfilled") {
          setSearchResults(rawResultsResult.value);
        } else {
          console.error("Raw search failed:", rawResultsResult.reason);
          setSearchResults([]);
        }

        if (memoryResultsResult.status === "fulfilled") {
          setMemoryResults(memoryResultsResult.value);
        } else {
          console.error("Memory search failed:", memoryResultsResult.reason);
          setMemoryResults([]);
        }

      } catch (err) {
        console.error("Search failed:", err);
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
    memoryResults,
    isSearching,
  };
}
