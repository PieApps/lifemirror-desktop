import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { ShieldAlert, CheckCircle, Settings, X } from "lucide-react";

export function InterdictionOverlay() {
  const [distractingTitle, setDistractingTitle] = useState("");

  useEffect(() => {
    // Listen for the distraction event from Rust
    const unlisten = listen<string>("distraction-detected", (event) => {
      setDistractingTitle(event.payload);
    });

    let lastEsc = 0;
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const now = Date.now();
        if (now - lastEsc < 500) {
          await invoke("hide_overlay");
        }
        lastEsc = now;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    
    return () => {
      unlisten.then(fn => fn());
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleReturnToWork = async () => {
    try {
      await invoke("hide_overlay");
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdjustRules = async () => {
    try {
      // Hide overlay and show main
      await invoke("hide_overlay");
      await invoke("show_main");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 w-screen h-screen flex flex-col items-center justify-center bg-gray-900/40 backdrop-blur-2xl text-white font-sans overflow-hidden z-50">
      <div data-tauri-drag-region className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent" />
      
      <div className="relative flex flex-col items-center text-center max-w-xl p-10 bg-gray-900/60 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-md">
        <button 
          onClick={handleReturnToWork}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors duration-200"
          aria-label="Close overlay"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="mb-6 bg-red-500/20 p-4 rounded-full">
          <ShieldAlert className="w-16 h-16 text-red-400" />
        </div>
        
        <h1 className="text-4xl font-extrabold mb-4 tracking-tight">Focus Interrupted</h1>
        
        <p className="text-lg text-gray-300 mb-8 leading-relaxed">
          It looks like you've drifted to a distracting application or site.
          {distractingTitle && (
            <span className="block mt-4 font-mono text-sm bg-black/30 py-2 px-4 rounded-lg text-red-200 break-all">
              {distractingTitle}
            </span>
          )}
        </p>

        <div className="flex flex-row items-center gap-4 w-full">
          <button 
            onClick={handleReturnToWork}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg shadow-indigo-900/50"
          >
            <CheckCircle className="w-5 h-5" />
            Return to Work
          </button>
          
          <button 
            onClick={handleAdjustRules}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold py-4 px-6 rounded-xl transition-all duration-200 border border-gray-700 hover:border-gray-600"
          >
            <Settings className="w-5 h-5" />
            Adjust Rules
          </button>
        </div>
      </div>
      
      <div className="absolute bottom-8 text-sm text-gray-500 font-medium">
        Press <kbd className="px-2 py-1 bg-gray-800 rounded font-mono text-xs text-gray-400 mx-1 border border-gray-700">Double-Esc</kbd> to emergency dismiss.
      </div>
    </div>
  );
}
