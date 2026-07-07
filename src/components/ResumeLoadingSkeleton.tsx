import { useState, useEffect } from "react";
import { ResumeContextResponse } from "../types/resume";

export const ResumeLoadingSkeleton = () => {
  const [loadingText, setLoadingText] = useState("Analyzing recent sessions...");

  useEffect(() => {
    const texts = [
      "Analyzing recent sessions...",
      "Cross-referencing journal entries...",
      "Scanning modified files...",
      "Formulating next steps...",
      "Generating context brief..."
    ];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % texts.length;
      setLoadingText(texts[i]);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-8 max-w-4xl w-full mx-auto shadow-2xl animate-pulse">
      <div className="flex items-center space-x-4 mb-8">
        <div className="h-12 w-12 bg-indigo-500/20 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-indigo-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <div>
          <div className="h-6 w-48 bg-[var(--border-color)] rounded mb-2"></div>
          <div className="text-sm text-[var(--text-muted)] font-mono">{loadingText}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="h-32 bg-[var(--border-color)] rounded-lg w-full"></div>
          <div className="h-24 bg-[var(--border-color)] rounded-lg w-full"></div>
        </div>
        <div className="space-y-4">
          <div className="h-48 bg-[var(--border-color)] rounded-lg w-full"></div>
          <div className="h-8 bg-[var(--border-color)] rounded-lg w-3/4"></div>
        </div>
      </div>
    </div>
  );
};
