import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { Settings, Shield, Cpu, Sliders, Power, AlertCircle, X, Plus, Target } from "lucide-react";

interface SettingsPanelProps {
  isIncognito: boolean;
  onToggleIncognito: () => void;
  ollamaUrl: string;
  setOllamaUrl: (url: string) => void;
  ollamaModel: string;
  setOllamaModel: (model: string) => void;
  trackingActive: boolean;
  setTrackingActive: (active: boolean) => void;
  minLogDuration: number;
  setMinLogDuration: (duration: number) => void;
  minSubSessionDuration: number;
  updateMinSubSessionDuration: (duration: number) => void;
  isAutostartEnabled: boolean;
  toggleAutostart: () => Promise<void>;
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
  minLogDuration,
  setMinLogDuration,
  minSubSessionDuration,
  updateMinSubSessionDuration,
  isAutostartEnabled,
  toggleAutostart,
}) => {
  const [autostartError, setAutostartError] = React.useState<string | null>(null);
  const [inputValue, setInputValue] = React.useState(String(minLogDuration));
  const [subSessionInputValue, setSubSessionInputValue] = React.useState(String(minSubSessionDuration));
  const [distractionRules, setDistractionRules] = React.useState<Array<{id: number, rule_type: string, value: string, is_active: boolean}>>([]);
  const [newRuleValue, setNewRuleValue] = React.useState("");
  const [appVersion, setAppVersion] = React.useState<string>("");

  const loadRules = async () => {
    try {
      const rules = await invoke<Array<{id: number, rule_type: string, value: string, is_active: boolean}>>("get_distraction_rules_list");
      setDistractionRules(rules);
    } catch (err) {
      console.error("Failed to load distraction rules:", err);
    }
  };

  React.useEffect(() => {
    loadRules();
    getVersion().then(setAppVersion).catch(console.error);
  }, []);

  React.useEffect(() => {
    setInputValue(String(minLogDuration));
  }, [minLogDuration]);

  React.useEffect(() => {
    setSubSessionInputValue(String(minSubSessionDuration));
  }, [minSubSessionDuration]);

  const handleAutostartToggle = async () => {
    setAutostartError(null);
    try {
      await toggleAutostart();
    } catch (err) {
      setAutostartError("System permissions blocked the autostart action.");
      setTimeout(() => setAutostartError(null), 5000);
    }
  };

  const handleMinLogDurationBlur = (val: string) => {
    let parsed = parseInt(val, 10);
    if (isNaN(parsed)) parsed = 60;
    const clamped = Math.max(60, Math.min(300, parsed));
    setMinLogDuration(clamped);
    setInputValue(String(clamped));
  };

  const handleMinSubSessionDurationBlur = (val: string) => {
    let parsed = parseInt(val, 10);
    if (isNaN(parsed)) parsed = 60;
    const clamped = Math.max(0, Math.min(300, parsed));
    updateMinSubSessionDuration(clamped);
    setSubSessionInputValue(String(clamped));
  };

  const handleAddRule = async () => {
    if (!newRuleValue.trim()) return;
    try {
      await invoke("add_distraction_rule", { ruleType: "regex", value: newRuleValue.trim() });
      setNewRuleValue("");
      await loadRules();
    } catch (err) {
      console.error("Failed to add rule:", err);
    }
  };

  const handleDeleteRule = async (id: number) => {
    try {
      await invoke("delete_distraction_rule", { id });
      await loadRules();
    } catch (err) {
      console.error("Failed to delete rule:", err);
    }
  };

  return (
    <div className="glass rounded-2xl p-6 border border-[var(--border-color)] max-w-md w-full mx-auto text-left flex flex-col flex-1 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar">
      <div className="flex items-center gap-2 mb-6 pb-2 border-b border-[var(--border-color)]">
        <Settings className="w-5 h-5 text-violet-400" />
        <h3 className="text-lg font-semibold text-[var(--text-color)]">Local-First Config</h3>
      </div>

      {/* Tracking state */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-[var(--text-color)]">Activity Tracking</label>
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
          Automatically detects which applications and websites you are actively using.
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
          Temporarily pauses all tracking and hides your current activity from the dashboard. Your activity will not be saved.
        </p>
      </div>

      {/* Minimum Session to Log */}
      <div className="mb-6 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/20">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="text-sm font-medium text-[var(--text-color)]">Minimum Activity Duration</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={(e) => handleMinLogDurationBlur(e.target.value)}
              className="w-16 bg-[var(--bg-color)]/50 border border-[var(--border-color)] rounded-xl px-2 py-1 text-xs text-[var(--text-color)] text-center focus:outline-none focus:border-violet-500/50"
              min={60}
              max={300}
            />
            <span className="text-xs text-[var(--text-muted)]">sec</span>
          </div>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <input
            type="range"
            min={60}
            max={300}
            value={minLogDuration}
            onChange={(e) => setMinLogDuration(Number(e.target.value))}
            className="flex-1 accent-violet-600 cursor-pointer h-1 rounded-lg appearance-none bg-zinc-200 dark:bg-zinc-700"
          />
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Ignores quick glances or short distractions. Only activities lasting longer than this time will be saved (Minimum: 1 minute).
        </p>
      </div>

      {/* Minimum Tab Session to Log */}
      <div className="mb-6 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/20">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="text-sm font-medium text-[var(--text-color)]">Minimum Detail Duration</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={subSessionInputValue}
              onChange={(e) => setSubSessionInputValue(e.target.value)}
              onBlur={(e) => handleMinSubSessionDurationBlur(e.target.value)}
              className="w-16 bg-[var(--bg-color)]/50 border border-[var(--border-color)] rounded-xl px-2 py-1 text-xs text-[var(--text-color)] text-center focus:outline-none focus:border-violet-500/50"
              min={0}
              max={300}
            />
            <span className="text-xs text-[var(--text-muted)]">sec</span>
          </div>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <input
            type="range"
            min={0}
            max={300}
            value={minSubSessionDuration}
            onChange={(e) => updateMinSubSessionDuration(Number(e.target.value))}
            className="flex-1 accent-violet-600 cursor-pointer h-1 rounded-lg appearance-none bg-zinc-200 dark:bg-zinc-700"
          />
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Ignores quickly switching between browser tabs or files. Only details viewed longer than this time will be saved (Set to 0 to record everything).
        </p>
      </div>

      {/* Launch on Startup */}
      <div className="mb-6 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Power className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="text-sm font-medium text-[var(--text-color)]">Launch on Startup</span>
          </div>
          <button
            onClick={handleAutostartToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
              isAutostartEnabled ? "bg-violet-600" : "bg-zinc-400 dark:bg-zinc-800"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isAutostartEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Opens the application automatically in the background when your computer starts.
        </p>
        {autostartError && (
          <p className="text-[10px] text-red-500 font-medium mt-1.5 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            <span>{autostartError}</span>
          </p>
        )}
      </div>

      {/* Deep Work & Distractions */}
      <div className="mb-8 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          <Target className="w-4 h-4 text-rose-400" />
          <span>Deep Work Enforcement</span>
        </div>
        
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          When you open these applications or websites, a full-screen reminder will appear to help you stay focused and avoid distractions.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={newRuleValue}
            onChange={(e) => setNewRuleValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddRule() }}
            placeholder="Block rule (e.g., (?i).*youtube.*)"
            className="flex-1 bg-[var(--bg-color)]/50 border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-color)] focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/30 font-mono text-xs"
          />
          <button 
            onClick={handleAddRule}
            className="bg-zinc-800 hover:bg-zinc-700 text-white p-2 rounded-xl border border-zinc-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 mt-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
          {distractionRules.map(rule => (
            <div key={rule.id} className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-color)]/30 border border-[var(--border-color)]">
              <span className="font-mono text-xs text-[var(--text-color)] truncate pr-2">{rule.value}</span>
              <button 
                onClick={() => handleDeleteRule(rule.id)}
                className="text-[var(--text-muted)] hover:text-red-400 p-1 rounded-md hover:bg-red-500/10 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {distractionRules.length === 0 && (
            <div className="text-center py-2 text-xs text-[var(--text-muted)] italic">No interdiction rules configured.</div>
          )}
        </div>
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
            Ensure you run <code className="bg-[var(--bg-color)]/80 px-1 py-0.5 rounded text-violet-600 dark:text-violet-300 font-mono">ollama run {ollamaModel === "false" || !ollamaModel ? 'llama3.2' : ollamaModel}</code> in your terminal.
          </p>
        </div>
      </div>

      <div className="mt-8 pt-4 border-t border-[var(--border-color)] text-center">
        <p className="text-xs text-[var(--text-muted)] font-mono">v{appVersion}</p>
      </div>
    </div>
  );
};
