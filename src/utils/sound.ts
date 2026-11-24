import { useState, useEffect, useCallback } from "react";

// Pure WebAudio procedural synthesizer - UI chimes and notifications only
class SoundEngine {
  private ctx: AudioContext | null = null;
  private isEnabled: boolean = true;
  private listeners: Set<(enabled: boolean) => void> = new Set();

  constructor() {
    if (typeof window !== "undefined") {
      this.isEnabled = localStorage.getItem("lifemirror_sound_enabled") !== "false";
      this.setupGlobalUnlockListener();
    }
  }

  /**
   * Proactively unlock the WebAudio AudioContext on the first user interaction
   * to satisfy browser/WebKit autoplay policies.
   */
  private setupGlobalUnlockListener() {
    if (typeof window === "undefined") return;

    const unlock = () => {
      this.ensureRunningContext().catch(() => {});
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("click", unlock);
    };

    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock, { passive: true });
    window.addEventListener("click", unlock, { passive: true });
  }

  public getContext(): AudioContext | null {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    return this.ctx;
  }

  public async ensureRunningContext(): Promise<AudioContext | null> {
    const ctx = this.getContext();
    if (!ctx) return null;

    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {}
    }
    return ctx;
  }

  public subscribe(listener: (enabled: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (typeof window !== "undefined") {
      localStorage.setItem("lifemirror_sound_enabled", enabled ? "true" : "false");
      window.dispatchEvent(new CustomEvent("lifemirror_sound_toggle", { detail: enabled }));
    }
    this.listeners.forEach((fn) => fn(enabled));
  }

  public toggle(): boolean {
    const next = !this.isEnabled;
    this.setEnabled(next);
    if (next) this.playTactileTick();
    return next;
  }

  public getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Resonant warm bronze chime for Igniting Focus
   * Fundamental: 528 Hz (Solfeggio frequency) with 1056 Hz overtone & 264 Hz warm subharmonic
   */
  public async playIgniteFocus() {
    if (!this.isEnabled) return;
    try {
      const ctx = await this.ensureRunningContext();
      if (!ctx) return;
      const now = Math.max(ctx.currentTime, 0.001);

      // 1. Fundamental oscillator (528 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(528, now);
      gain1.gain.setValueAtTime(0.0001, now);
      gain1.gain.linearRampToValueAtTime(0.48, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);

      // 2. Harmonic overtone (1056 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1056, now);
      gain2.gain.setValueAtTime(0.0001, now);
      gain2.gain.linearRampToValueAtTime(0.22, now + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

      // 3. Warm subharmonic (264 Hz)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = "sine";
      osc3.frequency.setValueAtTime(264, now);
      gain3.gain.setValueAtTime(0.0001, now);
      gain3.gain.linearRampToValueAtTime(0.18, now + 0.03);
      gain3.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc3.start(now);
      osc1.stop(now + 1.45);
      osc2.stop(now + 0.95);
      osc3.stop(now + 1.15);
    } catch {}
  }

  /**
   * Gentle descending release tone for Clearing Focus
   */
  public async playClearFocus() {
    if (!this.isEnabled) return;
    try {
      const ctx = await this.ensureRunningContext();
      if (!ctx) return;
      const now = Math.max(ctx.currentTime, 0.001);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.4);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.38, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    } catch {}
  }

  /**
   * Celebratory ascending harmonic arpeggio for Evening Epilogue
   */
  public async playEveningEpilogue() {
    if (!this.isEnabled) return;
    try {
      const ctx = await this.ensureRunningContext();
      if (!ctx) return;
      const now = Math.max(ctx.currentTime, 0.001);
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

      notes.forEach((freq, idx) => {
        const noteTime = now + idx * 0.12;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, noteTime);
        gain.gain.setValueAtTime(0.0001, noteTime);
        gain.gain.linearRampToValueAtTime(0.35, noteTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 1.1);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(noteTime);
        osc.stop(noteTime + 1.15);
      });
    } catch {}
  }

  /**
   * Tactile click for Zen mode & Episodes/Moments toggling
   */
  public async playTactileTick() {
    if (!this.isEnabled) return;
    try {
      const ctx = await this.ensureRunningContext();
      if (!ctx) return;
      const now = Math.max(ctx.currentTime, 0.001);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.30, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.055);
    } catch {}
  }

  /**
   * Resonant 432 Hz Tibetan singing bowl chime for mindful awakening (Zen alert & Dawn prelude)
   */
  public async playAwakeningBell() {
    if (!this.isEnabled) return;
    try {
      const ctx = await this.ensureRunningContext();
      if (!ctx) return;
      const now = Math.max(ctx.currentTime, 0.001);

      // 432 Hz fundamental (natural pitch)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(432, now);
      gain1.gain.setValueAtTime(0.0001, now);
      gain1.gain.linearRampToValueAtTime(0.50, now + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

      // 216 Hz subharmonic foundation (warmth)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(216, now);
      gain2.gain.setValueAtTime(0.0001, now);
      gain2.gain.linearRampToValueAtTime(0.28, now + 0.05);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);

      // 864 Hz crystalline harmonic overtone
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = "sine";
      osc3.frequency.setValueAtTime(864, now);
      gain3.gain.setValueAtTime(0.0001, now);
      gain3.gain.linearRampToValueAtTime(0.20, now + 0.03);
      gain3.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc3.start(now);
      osc1.stop(now + 3.05);
      osc2.stop(now + 2.45);
      osc3.stop(now + 1.85);
    } catch {}
  }

  // Aliases for intuitive semantic calls
  public playClick() {
    this.playTactileTick();
  }

  public playCelebration() {
    this.playEveningEpilogue();
  }

  public playFocusIgnite() {
    this.playIgniteFocus();
  }

  /**
   * Ascending harmonic chime for the 5-second Daily Reel playback.
   * Steps through rising Solfeggio frequencies: 264Hz -> 396Hz -> 528Hz -> 639Hz
   */
  public async playReelSweep(step: number) {
    if (!this.isEnabled) return;
    try {
      const ctx = await this.ensureRunningContext();
      if (!ctx) return;
      const now = Math.max(ctx.currentTime, 0.001);
      const frequencies = [264, 396, 528, 639, 741];
      const freq = frequencies[Math.min(step, frequencies.length - 1)];

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.9);
    } catch {}
  }
}

export const sound = new SoundEngine();

export function useSoundState(): [boolean, () => boolean] {
  const [enabled, setEnabled] = useState(() => sound.getEnabled());

  useEffect(() => {
    return sound.subscribe((val) => setEnabled(val));
  }, []);

  const toggle = useCallback(() => sound.toggle(), []);
  return [enabled, toggle];
}
