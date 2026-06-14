import React from "react";
import { Settings, Shield, Cpu } from "lucide-react";

interface SettingsPanelProps {
  isIncognito: boolean;
  onToggleIncognito: () => void;
  ollamaUrl: string;
  setOllamaUrl: (url: string) => void;
  ollamaModel: string;
  setOllamaModel: (model: string) => void;
  trackingActive: boolean;
  setTrackingActive: (active: boolean) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isIncognito,
  onToggleIncognito,
  ollamaUrl,
  setOllamaUrl,
  ollamaModel,
  setOllamaModel,
  trackingActive,
  setTrackingActive,
}) => {
  return (
    <div className="glass rounded-2xl p-6 border border-[var(--border-color)] max-w-md w-full mx-auto text-left">
      <div className="flex items-center gap-2 mb-6 pb-2 border-b border-[var(--border-color)]">
        <Settings className="w-5 h-5 text-violet-400" />
        <h3 className="text-lg font-semibold text-[var(--text-color)]">Local-First Config</h3>
      </div>

      {/* Tracking state */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-[var(--text-color)]">Background OS Tracking</label>
          <button
            onClick={() => setTrackingActive(!trackingActive)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
              trackingActive ? "bg-violet-600" : "bg-zinc-400 dark:bg-zinc-800"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                trackingActive ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Enables native window focus polling every 1 second.
        </p>
      </div>

      {/* Incognito mode */}
      <div className="mb-6 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Shield className={`w-4 h-4 ${isIncognito ? 'text-amber-500 animate-pulse' : 'text-[var(--text-muted)]'}`} />
            <span className="text-sm font-medium text-[var(--text-color)]">Incognito Mode</span>
          </div>
          <button
            onClick={onToggleIncognito}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
              isIncognito ? "bg-amber-500" : "bg-zinc-400 dark:bg-zinc-800"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isIncognito ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Entirely skips writing active focus logs to SQLite and displays a locked visual state across dashboard layouts.
        </p>
      </div>

      {/* Ollama reflection details */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          <Cpu className="w-4 h-4 text-violet-400" />
          <span>Local AI Extension</span>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">Ollama Server Endpoint</label>
          <input
            type="text"
            value={ollamaUrl === "false" ? "" : ollamaUrl}
            onChange={(e) => setOllamaUrl(e.target.value)}
            placeholder="http://localhost:11434"
            className="w-full bg-[var(--bg-color)]/50 border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-color)] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
          />
        </div>

        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">Ollama Model</label>
          <input
            type="text"
            value={ollamaModel === "false" ? "" : ollamaModel}
            onChange={(e) => setOllamaModel(e.target.value)}
            placeholder="llama3.2"
            className="w-full bg-[var(--bg-color)]/50 border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-color)] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
          />
          <p className="text-[10px] text-[var(--text-muted)] mt-1">
            Ensure you run <code className="bg-[var(--bg-color)]/80 px-1 py-0.5 rounded text-violet-600 dark:text-violet-300 font-mono">ollama run {ollamaModel === "false" || !ollamaModel ? 'llama3.2' : ollamaModel}</code> in your shell.
          </p>
        </div>
      </div>
    </div>
  );
};
