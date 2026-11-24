import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  ShieldCheck, 
  Cpu, 
  Cloud, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Compass, 
  Lock, 
  CheckCircle,
  Loader2
} from "lucide-react";
import { sound } from "../utils/sound";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: (tab: "general" | "focus" | "ai" | "about") => void;
  onSelectAiMode?: (mode: "local" | "cloud" | "off") => Promise<void>;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
  onSelectAiMode,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedMode, setSelectedMode] = useState<"local" | "cloud" | "off">("local");
  const [isDetectingOllama, setIsDetectingOllama] = useState(false);
  const [ollamaDetected, setOllamaDetected] = useState<boolean | null>(null);

  useEffect(() => {
    if (isOpen) {
      sound.playFocusIgnite();
      setStep(1);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleFinish();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNext = () => {
    sound.playClick();
    if (step < 3) {
      setStep((step + 1) as 2 | 3);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    sound.playClick();
    if (step > 1) {
      setStep((step - 1) as 1 | 2);
    }
  };

  const handleFinish = async () => {
    sound.playCelebration();
    localStorage.setItem("lifemirror_onboarding_completed", "true");
    if (onSelectAiMode) {
      await onSelectAiMode(selectedMode);
    }
    onClose();
  };

  const handleDetectOllama = async () => {
    setIsDetectingOllama(true);
    setOllamaDetected(null);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch("http://localhost:11434/api/version", { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        setOllamaDetected(true);
        setSelectedMode("local");
        sound.playFocusIgnite();
      } else {
        setOllamaDetected(false);
      }
    } catch {
      setOllamaDetected(false);
    } finally {
      setIsDetectingOllama(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className="relative w-full max-w-2xl bg-zinc-950/95 border border-violet-500/30 rounded-3xl shadow-2xl shadow-violet-950/40 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Top Aurora Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-violet-600 via-indigo-500 to-emerald-400" />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-48 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Skip action */}
        <button
          type="button"
          onClick={handleFinish}
          className="absolute top-4 right-4 text-xs text-zinc-400 hover:text-zinc-200 font-medium px-3 py-1.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer z-10"
        >
          Skip Tour
        </button>

        <div className="p-6 sm:p-10 space-y-8 relative z-10">
          
          {/* BEAT 1: THE SOUL */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="w-14 h-14 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 shadow-lg shadow-violet-500/10">
                <Compass className="w-7 h-7 text-violet-300" />
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">
                  Chapter I · The Philosophy
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  A bicycle for your creative mind.
                </h2>
                <p className="text-sm text-zinc-300 leading-relaxed pt-1">
                  Most productivity tools treat you like a surveillance subject—logging timesheets, micromanaging tabs, and inducing guilt.
                </p>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  LifeMirror is built on a different premise: <strong className="text-white font-semibold">your day is a river of flow</strong>. It quietly observes the rhythm of your craft, turning raw window focus into chapters of creative progress.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-white/5 space-y-1">
                  <span className="text-base">🌊</span>
                  <p className="text-xs font-bold text-white">The River Timeline</p>
                  <p className="text-[11px] text-zinc-400">Organized into natural episodes of flow.</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-white/5 space-y-1">
                  <span className="text-base">🧠</span>
                  <p className="text-xs font-bold text-white">The Biographer</p>
                  <p className="text-[11px] text-zinc-400">Synthesizes your breakthroughs with literary care.</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-white/5 space-y-1">
                  <span className="text-base">📖</span>
                  <p className="text-xs font-bold text-white">Personal Library</p>
                  <p className="text-[11px] text-zinc-400">Archival Markdown vault stored right on your drive.</p>
                </div>
              </div>
            </div>
          )}

          {/* BEAT 2: THE SACRED SANCTUM */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                <ShieldCheck className="w-7 h-7 text-emerald-300" />
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                  Chapter II · The Sanctum
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Your thoughts never leave this computer.
                </h2>
                <p className="text-sm text-zinc-300 leading-relaxed pt-1">
                  We believe privacy is not an option or a toggle—it is a fundamental human right.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">SQLCipher AES-256 Vault</p>
                    <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">
                      Every window title, browser domain, and personal note is sealed in an encrypted SQLite database on your local drive.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Zero Cloud Telemetry</p>
                    <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">
                      No Google Analytics, no telemetry beacons, no diagnostic pings. LifeMirror functions seamlessly 100% offline.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BEAT 3: AWAKEN YOUR BIOGRAPHER */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="w-14 h-14 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 shadow-lg shadow-violet-500/10">
                <Sparkles className="w-7 h-7 text-violet-300" />
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">
                  Chapter III · The Biographer
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Awaken your private observer.
                </h2>
                <p className="text-sm text-zinc-300 leading-relaxed pt-1">
                  Choose how your day will be synthesized. You can change this anytime in Settings.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {/* Option: Local */}
                <button
                  type="button"
                  onClick={() => setSelectedMode("local")}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                    selectedMode === "local"
                      ? "border-emerald-500/60 bg-emerald-500/10 shadow-lg shadow-emerald-500/10 text-white"
                      : "border-white/10 bg-zinc-900/40 text-zinc-400 hover:border-white/20"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Cpu className="w-4 h-4 text-emerald-400" />
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                        100% Offline
                      </span>
                    </div>
                    <p className="text-xs font-bold text-white">On-Device (Ollama)</p>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Runs locally on your laptop. Free forever, zero prompts leave device.
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                    <Check className={`w-3.5 h-3.5 ${selectedMode === "local" ? "opacity-100" : "opacity-0"}`} />
                    <span>{selectedMode === "local" ? "Selected" : "Choose Local"}</span>
                  </div>
                </button>

                {/* Option: Cloud */}
                <button
                  type="button"
                  onClick={() => setSelectedMode("cloud")}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                    selectedMode === "cloud"
                      ? "border-violet-500/60 bg-violet-500/10 shadow-lg shadow-violet-500/10 text-white"
                      : "border-white/10 bg-zinc-900/40 text-zinc-400 hover:border-white/20"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Cloud className="w-4 h-4 text-violet-400" />
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400">
                        Zero RAM
                      </span>
                    </div>
                    <p className="text-xs font-bold text-white">Online Service</p>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Gemini, Groq, or OpenAI with your private key. Instant, zero download.
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-[11px] text-violet-400 font-semibold">
                    <Check className={`w-3.5 h-3.5 ${selectedMode === "cloud" ? "opacity-100" : "opacity-0"}`} />
                    <span>{selectedMode === "cloud" ? "Selected" : "Choose Online"}</span>
                  </div>
                </button>

                {/* Option: Off */}
                <button
                  type="button"
                  onClick={() => setSelectedMode("off")}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                    selectedMode === "off"
                      ? "border-zinc-400/60 bg-zinc-800/40 text-white"
                      : "border-white/10 bg-zinc-900/40 text-zinc-400 hover:border-white/20"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Compass className="w-4 h-4 text-zinc-400" />
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300">
                        Passive
                      </span>
                    </div>
                    <p className="text-xs font-bold text-white">Pure Tracking</p>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      No AI processing. Track app time and focus without summaries.
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-[11px] text-zinc-300 font-semibold">
                    <Check className={`w-3.5 h-3.5 ${selectedMode === "off" ? "opacity-100" : "opacity-0"}`} />
                    <span>{selectedMode === "off" ? "Selected" : "Choose Passive"}</span>
                  </div>
                </button>
              </div>

              {/* 1-Click Ollama Auto-Detect Button */}
              {selectedMode === "local" && (
                <div className="pt-1 flex items-center justify-between bg-zinc-900/80 p-3 rounded-2xl border border-white/5">
                  <div className="text-xs text-zinc-300">
                    {ollamaDetected === true && (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        ✓ Ollama is running and ready.
                      </span>
                    )}
                    {ollamaDetected === false && (
                      <span className="text-amber-400 font-medium">
                        Ollama not detected on localhost:11434.{" "}
                        {onOpenSettings && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenSettings("ai");
                            }}
                            className="underline text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                          >
                            Open AI Settings
                          </button>
                        )}
                      </span>
                    )}
                    {ollamaDetected === null && (
                      <span className="text-zinc-400">Checks for a running Ollama server on your machine.</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleDetectOllama}
                    disabled={isDetectingOllama}
                    className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {isDetectingOllama ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>{isDetectingOllama ? "Checking..." : "Auto-Detect Ollama"}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Navigation Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            {/* Step Indicators */}
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setStep(s as 1 | 2 | 3);
                  }}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    step === s ? "w-7 bg-violet-400" : "w-2 bg-zinc-700 hover:bg-zinc-600"
                  }`}
                  aria-label={`Go to step ${s}`}
                />
              ))}
            </div>

            {/* Next / Back Actions */}
            <div className="flex items-center gap-2.5">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-1 font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-violet-950/40 hover:shadow-violet-500/25 transition-all flex items-center gap-2 cursor-pointer transform active:scale-95"
              >
                <span>{step === 3 ? "Enter the Sanctuary" : "Continue"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
