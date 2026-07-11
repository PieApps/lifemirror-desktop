import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { Settings, Shield, Sliders, Power, AlertCircle, X, Plus, Target, ShieldAlert, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface SettingsPanelProps {
  isIncognito: boolean;
  onToggleIncognito: () => void;
  aiUrl: string;
  setAiUrl: (url: string) => void;
  aiModel: string;
  setAiModel: (model: string) => void;
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
  aiUrl,
  setAiUrl,
  aiModel,
  setAiModel,
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
  const [customImage, setCustomImage] = React.useState<string | null>(null);
  const [customQuote, setCustomQuote] = React.useState<string>("");
  const [connectionStatus, setConnectionStatus] = React.useState<'idle' | 'testing' | 'connected' | 'disconnected'>('idle');
  const [connectionMessage, setConnectionMessage] = React.useState<string>("");

  const loadSettings = async () => {
    try {
      const img = await invoke<string>("get_db_setting", { key: "toast_custom_image" });
      if (img && img.length > 0 && img !== "false") {
        setCustomImage(img);
      }
      const quote = await invoke<string>("get_db_setting", { key: "toast_custom_quote" });
      if (quote && quote !== "false") {
        setCustomQuote(quote);
      }
    } catch (e) {
      console.error("Failed to load toast custom image", e);
    }
  };

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
    loadSettings();
    getVersion().then(setAppVersion).catch(console.error);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        
        const resizedBase64 = canvas.toDataURL("image/jpeg", 0.8);
        try {
          await invoke("set_db_setting", { key: "toast_custom_image", value: resizedBase64 });
          setCustomImage(resizedBase64);
        } catch (err) {
          console.error("Failed to save custom image", err);
        }
      };
      img.src = base64String;
    };
    reader.readAsDataURL(file);
  };

  const clearCustomImage = async () => {
    try {
      await invoke("set_db_setting", { key: "toast_custom_image", value: "" });
      setCustomImage(null);
    } catch (err) {
      console.error("Failed to clear custom image", err);
    }
  };

  const handleCustomQuoteBlur = async () => {
    try {
      await invoke("set_db_setting", { key: "toast_custom_quote", value: customQuote.trim() });
    } catch (err) {
      console.error("Failed to save custom quote", err);
    }
  };

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

  const handleTestConnection = async (isManualClick: boolean = false) => {
    let urlToTest = aiUrl;
    
    if (!aiUrl || aiUrl === "false") {
      if (isManualClick) {
        urlToTest = "http://localhost:11434";
        setAiUrl(urlToTest);
        if (!aiModel || aiModel === "false") {
          setAiModel("llama3.2");
        }
      } else {
        setConnectionStatus('disconnected');
        setConnectionMessage('Local AI is not configured.');
        return;
      }
    }

    setConnectionStatus('testing');
    setConnectionMessage('');
    try {
      const res = await fetch(`${urlToTest.replace(/\/$/, '')}/api/version`);
      if (res.ok) {
        setConnectionStatus('connected');
        setConnectionMessage('Successfully connected to local AI.');
      } else {
        setConnectionStatus('disconnected');
        setConnectionMessage(`Connection failed (Status: ${res.status}).`);
      }
    } catch (err: any) {
      setConnectionStatus('disconnected');
      setConnectionMessage('Failed to connect. Make sure it is running.');
    }
  };

  // Auto-test connection when settings panel is opened
  React.useEffect(() => {
    handleTestConnection(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          When you open these specific sites or applications, a full-screen reminder will appear to help you stay focused and avoid distractions.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={newRuleValue}
            onChange={(e) => setNewRuleValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddRule() }}
            placeholder="Block site or app (e.g., youtube.com, Discord)"
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

        <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
          <label className="block text-xs font-medium text-[var(--text-color)] mb-2">Custom Motivational Quote</label>
          <input
            type="text"
            value={customQuote}
            onChange={(e) => setCustomQuote(e.target.value)}
            onBlur={handleCustomQuoteBlur}
            placeholder="e.g., Don't give up what you want most..."
            className="w-full bg-[var(--bg-color)]/50 border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-color)] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
          />
          <p className="text-[10px] text-[var(--text-muted)] mt-1">This message will replace the default 'Back to work' text.</p>
        </div>

        <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
          <label className="block text-xs font-medium text-[var(--text-color)] mb-2">Custom Distraction Image</label>
          <div className="flex items-center gap-4">
            {customImage ? (
              <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-[var(--border-color)]">
                <img src={customImage} alt="Custom Toast" className="w-full h-full object-cover" />
                <button 
                  onClick={clearCustomImage}
                  className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <div className="w-12 h-12 rounded-lg border-2 border-dashed border-[var(--border-color)] flex items-center justify-center bg-[var(--bg-color)]/30">
                <ShieldAlert className="w-5 h-5 text-[var(--text-muted)] opacity-50" />
              </div>
            )}
            <div className="flex-1">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload}
                className="block w-full text-xs text-[var(--text-muted)]
                  file:mr-3 file:py-1.5 file:px-3
                  file:rounded-lg file:border-0
                  file:text-xs file:font-medium
                  file:bg-violet-600 file:text-white
                  hover:file:bg-violet-700
                  file:cursor-pointer cursor-pointer transition-colors"
              />
              <p className="text-[10px] text-[var(--text-muted)] mt-1">Upload a custom image (e.g., family photo) to display on the distraction toast. Max 2MB.</p>
            </div>
          </div>
        </div>
      </div>


      {/* AI reflection details */}
      {!isIncognito && trackingActive && (
        <div className="bg-[var(--surface-color)] p-4 rounded-xl shadow-sm border border-[var(--border-color)] space-y-4">
          <div className="flex items-center space-x-2 text-[var(--accent-color)] font-semibold mb-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            <h3>Mindfulness AI Features</h3>
          </div>
          
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">Local AI Endpoint</label>
            <input 
              type="text" 
              value={aiUrl === "false" ? "" : aiUrl}
              onChange={(e) => {
                setAiUrl(e.target.value);
                setConnectionStatus('idle');
                setConnectionMessage('');
              }}
              placeholder="http://localhost:11434"
              className="w-full bg-[var(--bg-color)]/50 border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-color)] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
            />
            {connectionStatus !== 'idle' && (
              <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${
                connectionStatus === 'connected' ? 'text-green-500' : 'text-red-500'
              }`}>
                {connectionStatus === 'connected' ? (
                  <CheckCircle className="w-3.5 h-3.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                <span>{connectionMessage}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">Text Generation Model</label>
            <input 
              type="text" 
              value={aiModel === "false" ? "" : aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              placeholder="e.g. llama3.2" 
              className="w-full px-3 py-2 text-sm bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg text-[var(--text-color)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent transition-all"
            />
            <p className="mt-1.5 text-[10px] text-[var(--text-muted)] leading-relaxed">
              Ensure you run <code className="bg-[var(--bg-color)]/80 px-1 py-0.5 rounded text-violet-600 dark:text-violet-300 font-mono">ollama run {aiModel === "false" || !aiModel ? 'llama3.2' : aiModel}</code> in your terminal.
            </p>
          </div>

          <div className="pt-2 border-t border-[var(--border-color)] flex justify-end">
            <button 
              onClick={() => {
                if (!aiUrl || aiUrl === "false") setAiUrl("http://localhost:11434");
                if (!aiModel || aiModel === "false") setAiModel("llama3.2");
                handleTestConnection(true);
              }}
              disabled={connectionStatus === 'testing'}
              className="group bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-xs font-medium transition-all duration-300 flex items-center gap-2 cursor-pointer shadow-md shadow-violet-900/20 hover:shadow-lg hover:shadow-violet-600/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
            >
              {connectionStatus === 'testing' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5 transition-transform duration-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {connectionStatus === 'testing' ? 'Saving & Testing...' : 'Save & Test Configuration'}
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 pt-4 border-t border-[var(--border-color)] text-center">
        <p className="text-xs text-[var(--text-muted)] font-mono">v{appVersion}</p>
      </div>
    </div>
  );
};
