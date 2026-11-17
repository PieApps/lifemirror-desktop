import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Shield, Sparkles, Cloud, ArrowRight, Check, X, ExternalLink, Cpu, AlertTriangle, Loader2, Eye, EyeOff } from "lucide-react";
import { CloudPrivacyDisclosureModal } from "./CloudPrivacyDisclosureModal";

interface AISetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocal: (model: string, url: string) => Promise<void>;
  onSelectCloud: (provider: "gemini" | "groq" | "openai" | "openrouter" | "custom", apiKey: string, baseUrl: string, model: string) => Promise<void>;
  onSkip: () => Promise<void>;
  currentOllamaUrl?: string;
  currentOllamaModel?: string;
}

export const AISetupModal: React.FC<AISetupModalProps> = ({
  isOpen,
  onClose,
  onSelectLocal,
  onSelectCloud,
  onSkip,
  currentOllamaUrl = "http://localhost:11434",
  currentOllamaModel = "llama3.2",
}) => {
  const [activeTab, setActiveTab] = useState<"overview" | "local" | "cloud">("overview");

  // Local AI State
  const [isOllamaRunning, setIsOllamaRunning] = useState<boolean | null>(null);
  const [checkingOllama, setCheckingOllama] = useState(false);
  const [localModel, setLocalModel] = useState(currentOllamaModel || "llama3.2");

  // Cloud AI State
  const [provider, setProvider] = useState<"gemini" | "groq" | "openai" | "openrouter" | "custom">("gemini");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [cloudBaseUrl, setCloudBaseUrl] = useState("https://generativelanguage.googleapis.com/v1beta/openai");
  const [cloudModel, setCloudModel] = useState("gemini-2.5-flash");
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showDisclosure, setShowDisclosure] = useState(false);

  // Probe Ollama on open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // If disclosure modal is open, let that handle escape instead
      if (e.key === "Escape" && !showDisclosure) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    const probe = async () => {
      setCheckingOllama(true);
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1200);
        const res = await fetch(`${currentOllamaUrl.replace(/\/$/, "")}/api/version`, { signal: controller.signal });
        clearTimeout(timeout);
        setIsOllamaRunning(res.ok);
      } catch {
        setIsOllamaRunning(false);
      } finally {
        setCheckingOllama(false);
      }
    };
    probe();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, currentOllamaUrl, showDisclosure, onClose]);

  // Update preset defaults when provider changes
  const handleProviderChange = (p: "gemini" | "groq" | "openai" | "openrouter" | "custom") => {
    setProvider(p);
    setConnectionError(null);
    if (p === "gemini") {
      setCloudBaseUrl("https://generativelanguage.googleapis.com/v1beta/openai");
      setCloudModel("gemini-2.5-flash");
    } else if (p === "groq") {
      setCloudBaseUrl("https://api.groq.com/openai/v1");
      setCloudModel("llama-3.3-70b-versatile");
    } else if (p === "openai") {
      setCloudBaseUrl("https://api.openai.com/v1");
      setCloudModel("gpt-4o-mini");
    } else if (p === "openrouter") {
      setCloudBaseUrl("https://openrouter.ai/api/v1");
      setCloudModel("meta-llama/llama-3.3-70b-instruct:free");
    } else {
      setCloudBaseUrl("");
      setCloudModel("");
    }
  };

  const handleTestAndPromptDisclosure = async () => {
    if (!apiKey.trim()) {
      setConnectionError("Please enter your API key.");
      return;
    }
    setTestingConnection(true);
    setConnectionError(null);
    try {
      await invoke("test_cloud_connection", {
        baseUrl: cloudBaseUrl,
        apiKey: apiKey.trim(),
        model: cloudModel,
      });
      // Connection succeeded, now show privacy review before saving
      setShowDisclosure(true);
    } catch (err: any) {
      setConnectionError(err?.toString() || "Connection test failed. Check your API key and base URL.");
    } finally {
      setTestingConnection(false);
    }
  };

  const handleConfirmDisclosure = async () => {
    setShowDisclosure(false);
    await onSelectCloud(provider, apiKey.trim(), cloudBaseUrl, cloudModel);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-setup-modal-title"
          className="relative w-full max-w-xl bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-left max-h-[90vh]"
        >
          {/* Top Banner */}
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-sky-500 to-violet-600" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-zinc-500/10 rounded-xl transition-colors cursor-pointer z-10"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Private by Default
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">You're in control</span>
              </div>
              <h3 id="ai-setup-modal-title" className="text-lg sm:text-xl font-bold text-[var(--text-color)] leading-snug">
                {activeTab === "overview" && "Choose How You Want AI Reflections to Work"}
                {activeTab === "local" && "Set Up On-Device AI"}
                {activeTab === "cloud" && "Set Up Online Service (Your API Key)"}
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                {activeTab === "overview" && "LifeMirror works as a full privacy-first activity tracker on its own. Choose whether you'd like AI reflections locally, online, or not at all."}
                {activeTab === "local" && "All AI runs directly on this machine. No prompts or activity logs ever leave your computer."}
                {activeTab === "cloud" && "Connect a fast online AI service using your personal API key. Fast and lightweight."}
              </p>
            </div>

            {/* TAB 1: OVERVIEW (3 CHOICES) */}
            {activeTab === "overview" && (
              <div className="space-y-3">
                {/* Choice 1: On-Device (Local) */}
                <button
                  type="button"
                  onClick={() => setActiveTab("local")}
                  className="w-full text-left p-4 rounded-xl border border-[var(--border-color)] bg-[var(--surface-color)]/50 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all cursor-pointer group relative"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-bold text-[var(--text-color)]">
                          Private: Runs on your computer
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          100% Offline
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        Zero data ever leaves your device. Works completely offline. Requires ~2GB–4GB download and uses computer memory/battery.
                      </p>
                      <div className="pt-1 flex items-center gap-2 text-[10px] text-emerald-400 font-medium">
                        {checkingOllama ? (
                          <span className="flex items-center gap-1 text-[var(--text-muted)]">
                            <Loader2 className="w-3 h-3 animate-spin" /> Checking local engine...
                          </span>
                        ) : isOllamaRunning ? (
                          <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                            <Check className="w-3 h-3" /> Ollama is running locally
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">
                            Uses Ollama • Click to set up
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-emerald-400 group-hover:translate-x-1 transition-all shrink-0 mt-1" />
                  </div>
                </button>

                {/* Choice 2: Online Service (Cloud) */}
                <button
                  type="button"
                  onClick={() => setActiveTab("cloud")}
                  className="w-full text-left p-4 rounded-xl border border-[var(--border-color)] bg-[var(--surface-color)]/50 hover:border-violet-500/50 hover:bg-violet-500/5 transition-all cursor-pointer group relative"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Cloud className="w-4 h-4 text-violet-400" />
                        <span className="text-sm font-bold text-[var(--text-color)]">
                          Faster: Uses an online service
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30">
                          0 MB Download
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        Instant setup and blazing fast. Uses your own API key (Groq, OpenAI, or OpenRouter). Sends session titles to the provider over HTTPS with full consent.
                      </p>
                      <div className="pt-1 text-[10px] text-violet-400 font-medium">
                        Groq (fast free tier) • OpenAI (gpt-4o-mini) • OpenRouter
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-violet-400 group-hover:translate-x-1 transition-all shrink-0 mt-1" />
                  </div>
                </button>

                {/* Choice 3: Skip / Track without AI */}
                <button
                  type="button"
                  onClick={async () => {
                    await onSkip();
                    onClose();
                  }}
                  className="w-full text-left p-3.5 rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-color)]/30 hover:border-[var(--text-muted)] hover:bg-[var(--surface-color)]/30 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-[var(--text-color)]">
                        Track without AI (Skip for now)
                      </span>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        Keep LifeMirror running as a private desktop timeline. You can enable AI reflections whenever you like.
                      </p>
                    </div>
                    <span className="text-xs text-[var(--text-muted)] group-hover:text-[var(--text-color)] underline font-medium shrink-0">
                      Skip
                    </span>
                  </div>
                </button>
              </div>
            )}

            {/* TAB 2: LOCAL ON-DEVICE SETUP */}
            {activeTab === "local" && (
              <div className="space-y-4 animate-in fade-in duration-150 text-xs">
                {/* Hardware Advisory Card */}
                <div className="p-3.5 rounded-xl border border-sky-500/20 bg-sky-500/5 text-sky-400 space-y-1">
                  <span className="font-semibold flex items-center gap-1.5 text-xs">
                    <Cpu className="w-3.5 h-3.5" /> Hardware Expectation
                  </span>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                    Running models locally requires ~2.0 GB–4.0 GB of storage and works best on modern machines with 16GB+ RAM or Apple Silicon. On 8GB machines, it may use more battery and run slower.
                  </p>
                </div>

                {isOllamaRunning ? (
                  <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                      <Check className="w-4 h-4" />
                      <span>Ollama is ready at {currentOllamaUrl}</span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                        Select Model
                      </label>
                      <input
                        type="text"
                        value={localModel}
                        onChange={(e) => setLocalModel(e.target.value)}
                        placeholder="e.g. llama3.2"
                        className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-color)]"
                      />
                      <span className="text-[10px] text-[var(--text-muted)] mt-1 block">
                        Default: <code className="font-mono text-emerald-400">llama3.2</code> (Fast 3B model)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await onSelectLocal(localModel.trim() || "llama3.2", currentOllamaUrl);
                        onClose();
                      }}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-900/20 cursor-pointer"
                    >
                      Use On-Device AI
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--surface-color)]/60 space-y-3">
                    <span className="font-bold text-[var(--text-color)] block">
                      3 Steps to Run AI Locally:
                    </span>
                    <ol className="space-y-2 text-[11px] text-[var(--text-muted)] list-decimal list-inside leading-relaxed">
                      <li>
                        Download the free <strong className="text-[var(--text-color)]">Ollama</strong> app from{" "}
                        <a 
                          href="https://ollama.com/download" 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-violet-400 underline font-semibold inline-flex items-center gap-0.5"
                        >
                          ollama.com <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </li>
                      <li>Install and launch Ollama on your computer.</li>
                      <li>Click "Check Again" below once launched.</li>
                    </ol>

                    <div className="pt-2 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab("overview")}
                        className="px-3.5 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-color)] cursor-pointer"
                      >
                        Go Back
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setCheckingOllama(true);
                          try {
                            const res = await fetch(`${currentOllamaUrl.replace(/\/$/, "")}/api/version`);
                            setIsOllamaRunning(res.ok);
                          } catch {
                            setIsOllamaRunning(false);
                          } finally {
                            setCheckingOllama(false);
                          }
                        }}
                        disabled={checkingOllama}
                        className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        {checkingOllama && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Check Again</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: ONLINE SERVICE (CLOUD) SETUP */}
            {activeTab === "cloud" && (
              <div className="space-y-4 animate-in fade-in duration-150 text-xs">
                {/* Provider Selector Tabs */}
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1.5">
                    Select Online Provider
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => handleProviderChange("gemini")}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        provider === "gemini"
                          ? "border-violet-500 bg-violet-500/15 text-[var(--text-color)] font-bold"
                          : "border-[var(--border-color)] bg-[var(--surface-color)] text-[var(--text-muted)]"
                      }`}
                    >
                      <span className="block text-xs font-semibold">Gemini</span>
                      <span className="text-[9px] text-emerald-400 font-medium">Free AI Studio</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleProviderChange("groq")}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        provider === "groq"
                          ? "border-violet-500 bg-violet-500/15 text-[var(--text-color)] font-bold"
                          : "border-[var(--border-color)] bg-[var(--surface-color)] text-[var(--text-muted)]"
                      }`}
                    >
                      <span className="block text-xs font-semibold">Groq</span>
                      <span className="text-[9px] text-emerald-400 font-medium">Fast / Free Tier</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleProviderChange("openai")}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        provider === "openai"
                          ? "border-violet-500 bg-violet-500/15 text-[var(--text-color)] font-bold"
                          : "border-[var(--border-color)] bg-[var(--surface-color)] text-[var(--text-muted)]"
                      }`}
                    >
                      <span className="block text-xs font-semibold">OpenAI</span>
                      <span className="text-[9px] text-zinc-400">gpt-4o-mini</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleProviderChange("openrouter")}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        provider === "openrouter"
                          ? "border-violet-500 bg-violet-500/15 text-[var(--text-color)] font-bold"
                          : "border-[var(--border-color)] bg-[var(--surface-color)] text-[var(--text-muted)]"
                      }`}
                    >
                      <span className="block text-xs font-semibold">OpenRouter</span>
                      <span className="text-[9px] text-sky-400">Aggregator</span>
                    </button>
                  </div>
                </div>

                {/* API Key Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-medium text-[var(--text-muted)]">
                      {provider === "gemini" ? "Google Gemini API Key" : provider === "groq" ? "Groq API Key" : provider === "openai" ? "OpenAI API Key" : "API Key"}
                    </label>
                    {provider === "gemini" && (
                      <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-[10px] text-violet-400 hover:text-violet-300 underline font-medium inline-flex items-center gap-0.5"
                      >
                        Get Free Gemini Key <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                    {provider === "groq" && (
                      <a 
                        href="https://console.groq.com/keys" 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-[10px] text-violet-400 hover:text-violet-300 underline font-medium inline-flex items-center gap-0.5"
                      >
                        Get Free Groq Key <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                    {provider === "openai" && (
                      <a 
                        href="https://platform.openai.com/api-keys" 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-[10px] text-violet-400 hover:text-violet-300 underline font-medium inline-flex items-center gap-0.5"
                      >
                        Get OpenAI Key <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={provider === "groq" ? "gsk_..." : provider === "openai" ? "sk-..." : "Paste key here"}
                      className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-3 py-2 pr-10 text-xs text-[var(--text-color)] font-mono focus:outline-none focus:border-violet-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-color)]"
                    >
                      {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Model Configuration */}
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                    Model Identifier
                  </label>
                  <input
                    type="text"
                    value={cloudModel}
                    onChange={(e) => setCloudModel(e.target.value)}
                    placeholder="e.g. llama-3.3-70b-versatile"
                    className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-color)] font-mono"
                  />
                </div>

                {connectionError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{connectionError}</span>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("overview")}
                    className="px-3.5 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-color)] cursor-pointer"
                  >
                    Go Back
                  </button>
                  <button
                    type="button"
                    onClick={handleTestAndPromptDisclosure}
                    disabled={testingConnection || !apiKey.trim()}
                    className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-violet-900/20"
                  >
                    {testingConnection ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>Test & Review Privacy</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Privacy Disclosure Modal */}
      <CloudPrivacyDisclosureModal
        isOpen={showDisclosure}
        provider={provider}
        model={cloudModel}
        onConfirm={handleConfirmDisclosure}
        onCancel={() => setShowDisclosure(false)}
      />
    </>
  );
};

