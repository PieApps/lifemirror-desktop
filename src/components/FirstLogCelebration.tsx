import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

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
      const t = setTimeout(() => setVisible(false), 7000);
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
      <div className="flex items-center gap-3.5 px-5 py-3.5 rounded-2xl bg-zinc-950/90 text-white shadow-2xl shadow-violet-500/25 border border-violet-500/30 backdrop-blur-xl">
        <div className="p-2 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 shrink-0">
          <Sparkles className="w-5 h-5 text-violet-300 animate-pulse" />
        </div>
        <div>
          <p className="text-sm font-bold text-white tracking-tight">The mirror is clear.</p>
          <p className="text-xs text-zinc-300 mt-0.5">Your creative journey is now being quietly remembered.</p>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="ml-3 p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
