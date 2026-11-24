import React from "react";
import {
  Sunrise,
  Sunset,
  Shield,
  Settings,
  Calendar,
  Music,
  Maximize2,
  Volume2,
  VolumeX
} from "lucide-react";

export interface QuickCommand {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  category: "flow" | "navigation" | "system";
  shortcut?: string;
  action: () => void | Promise<void>;
}

export function buildQuickCommands(handlers: {
  onOpenEpilogue: () => void;
  onOpenPrelude: () => void;
  onToggleZen: () => void;
  onToggleIncognito: () => void;
  onOpenSettings: (tab?: string) => void;
  onJumpToday: () => void;
  onOpenSoundtrack: () => void;
  onToggleSound?: () => void;
  isZenMode?: boolean;
  isIncognito?: boolean;
  isSoundEnabled?: boolean;
}): QuickCommand[] {
  return [
    {
      id: "epilogue",
      title: "Evening Epilogue & Daily Reel",
      subtitle: "Review, play the Solfeggio reel, and seal today's chapter",
      icon: React.createElement(Sunset, { className: "w-4 h-4 text-amber-400" }),
      category: "flow",
      action: handlers.onOpenEpilogue,
    },
    {
      id: "prelude",
      title: "Morning Prelude & Set Intention",
      subtitle: "Anchor your day's singular focus and craft intention",
      icon: React.createElement(Sunrise, { className: "w-4 h-4 text-rose-400" }),
      category: "flow",
      action: handlers.onOpenPrelude,
    },
    {
      id: "toggle_sound",
      title: handlers.isSoundEnabled ? "Mute Acoustic Effects" : "Enable Acoustic Sound Effects",
      subtitle: handlers.isSoundEnabled ? "Silence all UI sound ticks and Solfeggio bells" : "Enable tactile sound ticks and Solfeggio bells",
      icon: React.createElement(handlers.isSoundEnabled ? VolumeX : Volume2, { className: "w-4 h-4 text-violet-400" }),
      category: "system",
      shortcut: "⌘M",
      action: handlers.onToggleSound || (() => {}),
    },
    {
      id: "toggle_zen",
      title: handlers.isZenMode ? "Exit Zen Sanctum" : "Enter Zen Sanctum",
      subtitle: "Immerse in full-screen distraction-free S-Curve river",
      icon: React.createElement(Maximize2, { className: "w-4 h-4 text-violet-400" }),
      category: "system",
      shortcut: "⌘D",
      action: handlers.onToggleZen,
    },
    {
      id: "toggle_incognito",
      title: handlers.isIncognito ? "Disable Incognito Isolation" : "Enable Incognito Isolation",
      subtitle: handlers.isIncognito ? "Resume passive recording" : "Pause all recording and telemetry temporarily",
      icon: React.createElement(Shield, { className: "w-4 h-4 text-amber-400" }),
      category: "system",
      action: handlers.onToggleIncognito,
    },
    {
      id: "soundtrack",
      title: "Soundtrack Companion",
      subtitle: "Launch deep focus ambient radio & Lo-Fi generators",
      icon: React.createElement(Music, { className: "w-4 h-4 text-cyan-400" }),
      category: "flow",
      action: handlers.onOpenSoundtrack,
    },
    {
      id: "jump_today",
      title: "Jump to Today's River",
      subtitle: "Navigate immediately to current date and live pulse",
      icon: React.createElement(Calendar, { className: "w-4 h-4 text-emerald-400" }),
      category: "navigation",
      action: handlers.onJumpToday,
    },
    {
      id: "settings",
      title: "Settings & Engine",
      subtitle: "Manage local Ollama, encrypted vault, and privacy rules",
      icon: React.createElement(Settings, { className: "w-4 h-4 text-zinc-400" }),
      category: "system",
      action: () => handlers.onOpenSettings(),
    },
  ];
}
