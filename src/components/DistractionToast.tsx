import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Clock, ShieldAlert } from "lucide-react";

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

        <style>
          {`
            @keyframes angry-shake {
              0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
              25% { transform: translateY(-4px) rotate(-5deg) scale(1.05); }
              50% { transform: translateY(0px) rotate(5deg) scale(1); }
              75% { transform: translateY(-4px) rotate(-5deg) scale(1.05); }
            }
            .animate-angry-shake {
              animation: angry-shake 0.8s ease-in-out infinite;
            }
          `}
        </style>
        <div className="flex items-start gap-3 pointer-events-none">
          <div className="mt-1 flex-shrink-0 relative">
            <div className="w-12 h-12 animate-angry-shake origin-bottom drop-shadow-xl">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {/* Red blob body */}
                <path d="M50 5 C20 5 5 30 5 60 C5 90 25 95 50 95 C75 95 95 90 95 60 C95 30 80 5 50 5 Z" fill="#ef4444" />
                {/* Angry Eyebrows */}
                <path d="M25 35 Q35 45 45 45" stroke="white" strokeWidth="6" strokeLinecap="round" fill="none"/>
                <path d="M75 35 Q65 45 55 45" stroke="white" strokeWidth="6" strokeLinecap="round" fill="none"/>
                {/* Bug eyes */}
                <circle cx="32" cy="55" r="9" fill="white" />
                <circle cx="68" cy="55" r="9" fill="white" />
                {/* Pupils staring at you */}
                <circle cx="35" cy="55" r="4" fill="#7f1d1d" />
                <circle cx="65" cy="55" r="4" fill="#7f1d1d" />
                {/* Frowning / Yelling mouth */}
                <path d="M40 78 Q50 65 60 78 Q50 85 40 78" fill="#7f1d1d" stroke="white" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          
          <div className="flex flex-col flex-1 min-w-0 pr-6 justify-center pt-1">
            <h2 className="text-sm font-bold tracking-wide">Focus Police!</h2>
            <p className="text-xs text-gray-300 mt-0.5 truncate">
              Back to work! Drop the {distractingTitle || "Distracting App"}
            </p>
            <div className="flex items-center gap-1.5 mt-2 text-indigo-300 font-mono text-xs font-bold bg-indigo-900/40 w-fit px-2 py-1 rounded-md">
              <Clock className="w-3.5 h-3.5 animate-pulse text-indigo-400" />
              <span className="text-indigo-200">{formatTime(durationSecs)} wasted</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4 z-10">
          <button 
            onClick={handleAdjustRules}
            className="flex-1 py-1.5 px-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 rounded-lg text-xs text-gray-300 font-medium transition-colors duration-200 shadow-sm"
          >
            Adjust Rules
          </button>
        </div>
      </div>
    </div>
  );
}
