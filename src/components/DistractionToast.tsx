import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Clock, ShieldAlert, X } from "lucide-react";

export function DistractionToast() {
  const [distractingTitle, setDistractingTitle] = useState("");
  const [durationSecs, setDurationSecs] = useState(0);

  useEffect(() => {
    // Listen for the distraction event from Rust
    const unlisten = listen<{ title: string; duration: number }>("distraction-tick", (event) => {
      setDistractingTitle(event.payload.title);
      setDurationSecs(event.payload.duration);
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  const handleDismiss = async () => {
    try {
      await invoke("hide_toast");
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdjustRules = async () => {
    try {
      await invoke("hide_toast");
      await invoke("show_main");
    } catch (e) {
      console.error(e);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-transparent overflow-hidden font-sans">
      <div 
        data-tauri-drag-region 
        className="relative flex flex-col w-[340px] p-4 bg-gray-900/80 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl text-white"
      >
        <button 
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors duration-200 z-10"
          aria-label="Hide reminder"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3 pointer-events-none">
          <div className="mt-1 bg-red-500/20 p-2 rounded-full flex-shrink-0">
            <ShieldAlert className="w-5 h-5 text-red-400" />
          </div>
          
          <div className="flex flex-col flex-1 min-w-0 pr-6">
            <h2 className="text-sm font-bold tracking-wide">Focus Interrupted</h2>
            <p className="text-xs text-gray-300 mt-0.5 truncate">
              {distractingTitle || "Distracting App"}
            </p>
            <div className="flex items-center gap-1.5 mt-2 text-indigo-300 font-mono text-xs">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTime(durationSecs)} wasted</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-3 z-10">
          <button 
            onClick={handleDismiss}
            className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold transition-colors duration-200 shadow-sm"
          >
            Hide
          </button>
          <button 
            onClick={handleAdjustRules}
            className="flex-1 py-1.5 px-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 rounded-lg text-xs text-gray-300 font-medium transition-colors duration-200"
          >
            Adjust Rules
          </button>
        </div>
      </div>
    </div>
  );
}
