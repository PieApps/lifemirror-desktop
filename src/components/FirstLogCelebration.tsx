import { useEffect, useState } from "react";

const STORAGE_KEY = "first_log_celebrated";

interface FirstLogCelebrationProps {
  activityCount: number;
}

export function FirstLogCelebration({ activityCount }: FirstLogCelebrationProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (activityCount >= 1 && !localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, "1");
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 6000);
      return () => clearTimeout(t);
    }
  }, [activityCount]);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-500"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-violet-600 text-white shadow-2xl shadow-violet-500/40 border border-violet-400/30">
        <span className="text-xl">🎉</span>
        <div>
          <p className="text-sm font-bold leading-tight">Your first memory has been captured.</p>
          <p className="text-[11px] text-violet-200 mt-0.5">LifeMirror is now building your life timeline.</p>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="ml-2 text-violet-200 hover:text-white transition-colors text-lg leading-none cursor-pointer"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
