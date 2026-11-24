import { useState, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Sparkles, Clock, Compass, Settings } from "lucide-react";
import { sound } from "../utils/sound";

export function DistractionToast() {
  const [distractingTitle, setDistractingTitle] = useState("");
  const [durationSecs, setDurationSecs] = useState(0);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [customQuote, setCustomQuote] = useState<string | null>(null);
  const chimePlayedRef = useRef(false);

  useEffect(() => {
    // Listen for the distraction event from Rust
    const unlisten = listen<{ title: string; duration: number; custom_image?: string; custom_quote?: string }>("distraction-tick", (event) => {
      setDistractingTitle(event.payload.title);
      setDurationSecs(event.payload.duration);
      if (event.payload.custom_image && event.payload.custom_image.length > 0) {
        setCustomImage(event.payload.custom_image);
      } else {
        setCustomImage(null);
      }
      if (event.payload.custom_quote && event.payload.custom_quote.length > 0) {
        setCustomQuote(event.payload.custom_quote);
      } else {
        setCustomQuote(null);
      }

      // Play soft 432 Hz Zen awakening chime on arrival
      if (!chimePlayedRef.current) {
        sound.playAwakeningBell();
        chimePlayedRef.current = true;
      }
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  const handleReturnToFlow = async () => {
    try {
      sound.playFocusIgnite();
      chimePlayedRef.current = false;
      await invoke("hide_toast");
    } catch (e) {
      console.error(e);
    }
  };

  const handleMindfulRespite = async () => {
    try {
      sound.playClick();
      chimePlayedRef.current = false;
      await invoke("hide_toast");
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdjustRules = async () => {
    try {
      chimePlayedRef.current = false;
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
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-transparent overflow-hidden font-sans select-none">
      <div 
        data-tauri-drag-region 
        className="relative flex flex-col w-[360px] p-4 bg-zinc-950/92 rounded-2xl border border-violet-500/30 shadow-2xl shadow-violet-950/50 backdrop-blur-2xl text-white overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300"
      >
        {customImage && (
          <div 
            className="absolute inset-0 z-0 opacity-40" 
            style={{ 
              backgroundImage: `url(${customImage})`, 
              backgroundSize: 'cover', 
              backgroundPosition: 'center',
              filter: 'blur(3px)'
            }} 
          />
        )}
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-violet-950/20 via-zinc-950/80 to-zinc-950/95 pointer-events-none" />

        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />

        <div className="relative z-10 flex items-start gap-3">
          {/* Zen Icon with gentle breathing pulse */}
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/40 flex items-center justify-center shrink-0 mt-0.5 shadow-md shadow-violet-500/20">
            <Compass className="w-5 h-5 text-violet-300 animate-pulse" />
          </div>
          
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-violet-300 tracking-wide uppercase flex items-center gap-1">
                <span>Mindful Pause</span>
              </span>
              <div className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 bg-zinc-900/80 px-2 py-0.5 rounded-full border border-white/5">
                <Clock className="w-3 h-3 text-violet-400" />
                <span>{formatTime(durationSecs)}</span>
              </div>
            </div>

            <p className="text-xs text-zinc-200 mt-1 leading-relaxed">
              {customQuote ? (
                <span className="text-violet-200 font-serif italic text-sm block">
                  "{customQuote}"
                </span>
              ) : (
                <span className="text-zinc-300">
                  You have stepped away from deep craft to <span className="font-semibold text-white truncate inline-block max-w-[180px] align-bottom">{distractingTitle || "an unshielded window"}</span>.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Action Row */}
        <div className="relative z-10 flex items-center gap-2 mt-3.5 pt-3 border-t border-white/10">
          <button 
            type="button"
            onClick={handleReturnToFlow}
            className="flex-1 py-1.5 px-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-violet-900/30 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-violet-200" />
            <span>Return to Flow</span>
          </button>

          <button 
            type="button"
            onClick={handleMindfulRespite}
            className="py-1.5 px-2.5 bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/10 rounded-xl text-xs font-medium transition-colors cursor-pointer"
            title="Grant yourself 5 minutes of intentional exploration"
          >
            <span>5m Respite</span>
          </button>

          <button 
            type="button"
            onClick={handleAdjustRules}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-xl transition-colors cursor-pointer"
            title="Configure distraction shield rules"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
