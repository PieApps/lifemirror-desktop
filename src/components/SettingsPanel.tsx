import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl, openPath } from "@tauri-apps/plugin-opener";
import { getVersion } from "@tauri-apps/api/app";
import { Settings, Shield, Sliders, Power, AlertCircle, X, Plus, Target, ShieldAlert, CheckCircle, XCircle, Loader2, Tag, Trash2, LifeBuoy, Heart, Globe, ExternalLink, Copy, Check, Sparkles, Smartphone, Ban, FileText, Cpu, Cloud, Eye, EyeOff, BookOpen, FolderOpen, ChevronDown, ChevronUp, RefreshCw, Volume2 } from "lucide-react";
import { sound } from "../utils/sound";
import { CloudPrivacyDisclosureModal } from "./CloudPrivacyDisclosureModal";
import { ConfirmModal } from "./ConfirmModal";
import { CATEGORIES, ActivityCategory, getCategoryOverrides, saveCategoryOverrides, CategoryOverrides } from "../utils/categoryMapper";
import { ExclusionEntry, PurgePreview, PurgeReport, JournalEntry } from "../types";
import { normalizeDomain } from "../utils/domainRules";

type SettingsTab = "general" | "focus" | "ai" | "about";

interface SettingsPanelProps {
  isIncognito: boolean;
  onToggleIncognito: () => void;
  aiUrl: string;
  setAiUrl: (url: string) => void;
  aiModel: string;
  setAiModel: (model: string) => void;
  aiProcessingMode?: "on_demand" | "continuous";
  setAiProcessingMode?: (mode: "on_demand" | "continuous") => void;
  trackingActive: boolean;
  setTrackingActive: (active: boolean) => void;
  minLogDuration: number;
  setMinLogDuration: (duration: number) => void;
  minSubSessionDuration: number;
  updateMinSubSessionDuration: (duration: number) => void;
  isAutostartEnabled: boolean;
  toggleAutostart: () => Promise<void>;
  onSupportClick?: () => void;
  onDonateClick?: () => void;
  initialTab?: SettingsTab;
  onAiConnectionTested?: (connected: boolean) => void;
  excludedDomains?: ExclusionEntry[];
  unattachedNotes?: JournalEntry[];
  onAddExcludedDomain?: (domain: string, includeSubdomains: boolean, purgeHistory: boolean) => Promise<PurgeReport>;
  onRemoveExcludedDomain?: (domain: string) => Promise<void>;
  onPreviewPurge?: (domain: string, includeSubdomains: boolean) => Promise<PurgePreview>;
  onRefreshUnattachedNotes?: () => Promise<void>;
  aiMode?: "local" | "cloud" | "off";
  onUpdateAiMode?: (mode: "local" | "cloud" | "off") => Promise<void>;
  cloudProvider?: "gemini" | "groq" | "openai" | "openrouter" | "custom";
  cloudApiKey?: string;
  cloudBaseUrl?: string;
  cloudModel?: string;
  cloudDisclosureAccepted?: boolean;
  onSaveCloudConfig?: (provider: "gemini" | "groq" | "openai" | "openrouter" | "custom", apiKey: string, baseUrl: string, model: string) => Promise<void>;
  onRevokeCloudAccess?: () => Promise<void>;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isIncognito,
  onToggleIncognito,
  aiUrl,
  setAiUrl,
  aiModel,
  setAiModel,
  aiProcessingMode = "on_demand",
  setAiProcessingMode,
  trackingActive,
  setTrackingActive,
  minLogDuration,
  setMinLogDuration,
  minSubSessionDuration,
  updateMinSubSessionDuration,
  isAutostartEnabled,
  toggleAutostart,
  onSupportClick,
  onDonateClick,
  initialTab = "general",
  onAiConnectionTested,
  excludedDomains,
  unattachedNotes,
  onAddExcludedDomain,
  onRemoveExcludedDomain,
  onPreviewPurge,
  onRefreshUnattachedNotes,
  aiMode = "local",
  onUpdateAiMode,
  cloudProvider = "groq",
  cloudApiKey = "",
  cloudBaseUrl = "https://api.groq.com/openai/v1",
  cloudModel = "llama-3.3-70b-versatile",
  onSaveCloudConfig,
  onRevokeCloudAccess,
}) => {
  const [activeTab, setActiveTab] = React.useState<SettingsTab>(initialTab);
  const [soundEnabled, setSoundEnabled] = React.useState<boolean>(sound.getEnabled());

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [autostartError, setAutostartError] = React.useState<string | null>(null);
  const [inputValue, setInputValue] = React.useState(String(minLogDuration));
  const [subSessionInputValue, setSubSessionInputValue] = React.useState(String(minSubSessionDuration));
  const [distractionRules, setDistractionRules] = React.useState<Array<{id: number, rule_type: string, value: string, is_active: boolean}>>([]);
  const [newRuleValue, setNewRuleValue] = React.useState("");

  // Domain Exclusion states
  const [localExcludedDomains, setLocalExcludedDomains] = React.useState<ExclusionEntry[]>(excludedDomains || []);
  const [localUnattachedNotes, setLocalUnattachedNotes] = React.useState<JournalEntry[]>(unattachedNotes || []);
  const [domainInput, setDomainInput] = React.useState("");
  const [includeSubdomains, setIncludeSubdomains] = React.useState(true);
  const [domainInputError, setDomainInputError] = React.useState<string | null>(null);

  // Modal & purge flow state
  const [purgeModalOpen, setPurgeModalOpen] = React.useState(false);
  const [pendingDomain, setPendingDomain] = React.useState("");
  const [pendingIncludeSubdomains, setPendingIncludeSubdomains] = React.useState(true);
  const [purgePreview, setPurgePreview] = React.useState<PurgePreview | null>(null);
  const [purgeExistingHistory, setPurgeExistingHistory] = React.useState(true);
  const [isPurging, setIsPurging] = React.useState(false);
  const [purgeReportToast, setPurgeReportToast] = React.useState<PurgeReport | null>(null);
  const [notesModalOpen, setNotesModalOpen] = React.useState(false);
  const [copiedNoteId, setCopiedNoteId] = React.useState<number | null>(null);

  // Cloud AI & Mode states
  const [selectedAiMode, setSelectedAiMode] = React.useState<"local" | "cloud" | "off">(aiMode);
  const [localCloudProvider, setLocalCloudProvider] = React.useState<"gemini" | "groq" | "openai" | "openrouter" | "custom">(cloudProvider);

  // Knowledge Vault states
  const [vaultPathInput, setVaultPathInput] = React.useState("");
  const [isSavingVaultPath, setIsSavingVaultPath] = React.useState(false);
  const [vaultSaveMessage, setVaultSaveMessage] = React.useState<string | null>(null);
  const [isClearVaultModalOpen, setIsClearVaultModalOpen] = React.useState(false);
  const [isClearingVault, setIsClearingVault] = React.useState(false);

  const handleClearVault = async () => {
    setIsClearingVault(true);
    try {
      const archiveRel = await invoke<string>("clear_and_archive_vault");
      setVaultSaveMessage(`Vault safely archived to ${archiveRel} and reset.`);
      setTimeout(() => setVaultSaveMessage(null), 5000);
      setIsClearVaultModalOpen(false);
    } catch (err) {
      console.error("Failed to clear vault:", err);
    } finally {
      setIsClearingVault(false);
    }
  };

  React.useEffect(() => {
    invoke<string>("get_vault_directory")
      .then((p) => setVaultPathInput(p))
      .catch((err) => console.error("Failed to get vault dir:", err));
  }, []);

  const handleSaveVaultPath = async () => {
    setIsSavingVaultPath(true);
    setVaultSaveMessage(null);
    try {
      const saved = await invoke<string>("set_vault_directory", { path: vaultPathInput });
      setVaultPathInput(saved);
      setVaultSaveMessage("Vault location updated successfully!");
      setTimeout(() => setVaultSaveMessage(null), 3000);
    } catch (err) {
      console.error("Failed to set vault dir:", err);
      setVaultSaveMessage("Failed to update vault path");
    } finally {
      setIsSavingVaultPath(false);
    }
  };

  const handleOpenVaultFolder = async () => {
    try {
      await openPath(vaultPathInput);
    } catch (err) {
      console.error("Failed to open vault folder:", err);
    }
  };

  const handleResetVaultPath = async () => {
    try {
      const def = await invoke<string>("set_vault_directory", { path: "" });
      setVaultPathInput(def);
      setVaultSaveMessage("Reset to default location.");
      setTimeout(() => setVaultSaveMessage(null), 3000);
    } catch (err) {
      console.error("Failed to reset vault dir:", err);
    }
  };
  const [localCloudKey, setLocalCloudKey] = React.useState(cloudApiKey);
  const [showCloudKey, setShowCloudKey] = React.useState(false);
  const [localCloudUrl, setLocalCloudUrl] = React.useState(cloudBaseUrl);
  const [localCloudModel, setLocalCloudModel] = React.useState(cloudModel);
  const [showDisclosureModal, setShowDisclosureModal] = React.useState(false);
  const [showTradeoffsModal, setShowTradeoffsModal] = React.useState(false);
  const [cloudTestStatus, setCloudTestStatus] = React.useState<"idle" | "success" | "error">("idle");
  const [cloudTestMessage, setCloudTestMessage] = React.useState("");
  const [installedOllamaModels, setInstalledOllamaModels] = React.useState<string[]>([]);
  const [loadingOllamaModels, setLoadingOllamaModels] = React.useState(false);
  const [showAdvancedOllamaUrl, setShowAdvancedOllamaUrl] = React.useState(false);
  const [copiedOllamaCmd, setCopiedOllamaCmd] = React.useState(false);
  const [isSavingCloud, setIsSavingCloud] = React.useState(false);

  React.useEffect(() => {
    setSelectedAiMode(aiMode);
  }, [aiMode]);

  React.useEffect(() => {
    setLocalCloudProvider(cloudProvider);
  }, [cloudProvider]);

  React.useEffect(() => {
    setLocalCloudKey(cloudApiKey);
  }, [cloudApiKey]);

  React.useEffect(() => {
    setLocalCloudUrl(cloudBaseUrl);
  }, [cloudBaseUrl]);

  React.useEffect(() => {
    setLocalCloudModel(cloudModel);
  }, [cloudModel]);

  React.useEffect(() => {
    if (excludedDomains) {
      setLocalExcludedDomains(excludedDomains);
    }
  }, [excludedDomains]);

  React.useEffect(() => {
    if (unattachedNotes) {
      setLocalUnattachedNotes(unattachedNotes);
    }
  }, [unattachedNotes]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (purgeModalOpen && !isPurging) {
          setPurgeModalOpen(false);
        } else if (notesModalOpen) {
          setNotesModalOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [purgeModalOpen, isPurging, notesModalOpen]);

  const handleSelectPreset = (preset: string) => {
    setDomainInput(preset);
    setDomainInputError(null);
  };

  const handleStartExclude = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setDomainInputError(null);
    const norm = normalizeDomain(domainInput);
    if (!norm.valid || !norm.domain) {
      setDomainInputError(norm.error || "Invalid domain format");
      return;
    }

    try {
      const preview = onPreviewPurge
        ? await onPreviewPurge(norm.domain, includeSubdomains)
        : await invoke<PurgePreview>("preview_domain_purge", { domain: norm.domain, includeSubdomains });
      setPendingDomain(norm.domain);
      setPendingIncludeSubdomains(includeSubdomains);
      setPurgePreview(preview);
      setPurgeExistingHistory(true);
      setPurgeModalOpen(true);
    } catch (err: any) {
      console.error("Failed to preview purge:", err);
      setDomainInputError(String(err));
    }
  };

  const handleConfirmExclude = async () => {
    if (!pendingDomain) return;
    setIsPurging(true);
    try {
      const report = onAddExcludedDomain
        ? await onAddExcludedDomain(pendingDomain, pendingIncludeSubdomains, purgeExistingHistory)
        : await invoke<PurgeReport>("add_excluded_domain", {
            domain: pendingDomain,
            includeSubdomains: pendingIncludeSubdomains,
            purgeHistory: purgeExistingHistory,
          });

      setPurgeReportToast(report);
      setTimeout(() => setPurgeReportToast(null), 6000);
      setDomainInput("");
      setPurgeModalOpen(false);

      if (!onAddExcludedDomain) {
        const updated = await invoke<ExclusionEntry[]>("get_excluded_domains");
        setLocalExcludedDomains(updated);
        const updatedNotes = await invoke<JournalEntry[]>("get_unattached_journal_notes");
        setLocalUnattachedNotes(updatedNotes);
      }
    } catch (err: any) {
      console.error("Failed to exclude domain:", err);
      setDomainInputError(String(err));
    } finally {
      setIsPurging(false);
    }
  };

  const handleRemoveExcluded = async (domain: string) => {
    try {
      if (onRemoveExcludedDomain) {
        await onRemoveExcludedDomain(domain);
      } else {
        await invoke("remove_excluded_domain", { domain });
        const updated = await invoke<ExclusionEntry[]>("get_excluded_domains");
        setLocalExcludedDomains(updated);
      }
    } catch (err) {
      console.error("Failed to remove excluded domain:", err);
    }
  };

  const handleCopyNote = async (note: JournalEntry) => {
    try {
      await navigator.clipboard.writeText(note.notes);
      setCopiedNoteId(note.id || -1);
      setTimeout(() => setCopiedNoteId(null), 2000);
    } catch (err) {
      console.error("Failed to copy note:", err);
    }
  };
  const [appVersion, setAppVersion] = React.useState<string>("");
  const [customImage, setCustomImage] = React.useState<string | null>(null);
  const [customQuote, setCustomQuote] = React.useState<string>("");
  const [connectionStatus, setConnectionStatus] = React.useState<'idle' | 'testing' | 'connected' | 'disconnected'>('idle');
  const [connectionMessage, setConnectionMessage] = React.useState<string>("");
  const [categoryOverrides, setCategoryOverrides] = React.useState<CategoryOverrides>(getCategoryOverrides);
  const [newOverrideApp, setNewOverrideApp] = React.useState("");
  const [newOverrideCategory, setNewOverrideCategory] = React.useState<ActivityCategory>("development");
  const [copiedExtLink, setCopiedExtLink] = React.useState(false);
  const CHROME_STORE_URL = "https://chromewebstore.google.com/detail/lifemirror-desktop/pblffjiaheggbamkjaojabdaemkflhmm";
  const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.pieapps.lifemirror";

  const handleCopyExtensionLink = async () => {
    try {
      await navigator.clipboard.writeText(CHROME_STORE_URL);
      setCopiedExtLink(true);
      setTimeout(() => setCopiedExtLink(false), 2500);
    } catch (err) {
      console.error("Failed to copy extension link", err);
    }
  };

  const handleAddOverride = () => {
    if (!newOverrideApp.trim()) return;
    const key = newOverrideApp.trim().toLowerCase();
    const updated = { ...categoryOverrides, [key]: newOverrideCategory };
    setCategoryOverrides(updated);
    saveCategoryOverrides(updated);
    setNewOverrideApp("");
  };

  const handleRemoveOverride = (appKey: string) => {
    const updated = { ...categoryOverrides };
    delete updated[appKey];
    setCategoryOverrides(updated);
    saveCategoryOverrides(updated);
  };

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

  const fetchInstalledOllamaModels = async (baseUrl: string) => {
    setLoadingOllamaModels(true);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`, { signal: controller.signal });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.models)) {
          const names = data.models.map((m: any) => m.name || m.model).filter(Boolean);
          setInstalledOllamaModels(names);
        }
      }
    } catch {
      // Ignore tag fetch errors if offline or aborted
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setLoadingOllamaModels(false);
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
        setConnectionMessage('Ollama endpoint is not configured.');
        return;
      }
    }

    setConnectionStatus('testing');
    setConnectionMessage('');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${urlToTest.replace(/\/$/, '')}/api/version`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        setConnectionStatus('connected');
        setConnectionMessage('Ollama is running and ready.');
        onAiConnectionTested?.(true);
        fetchInstalledOllamaModels(urlToTest);
      } else {
        setConnectionStatus('disconnected');
        setConnectionMessage(`Connection failed (Status: ${res.status}).`);
        onAiConnectionTested?.(false);
      }
    } catch (err: any) {
      setConnectionStatus('disconnected');
      setConnectionMessage('Ollama is offline or unreachable.');
      onAiConnectionTested?.(false);
    }
  };

  // Auto-test local connection only when in local AI mode
  React.useEffect(() => {
    if (aiMode === "local") {
      handleTestConnection(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiMode]);

  return (
    <div className="glass rounded-2xl p-4 sm:p-6 border border-[var(--border-color)] w-full text-left flex flex-col flex-1 h-full min-h-0 overflow-y-auto custom-scrollbar">
      {/* Header with Title and Version */}
      <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-[var(--border-color)] shrink-0">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-violet-400" />
          <h3 className="text-base sm:text-lg font-bold text-[var(--text-color)]">Settings & Preferences</h3>
        </div>
        <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--surface-color)] px-2 py-0.5 rounded-md border border-[var(--border-color)]">
          v{appVersion}
        </span>
      </div>

      {/* Segmented Tab Navigation */}
      <div className="grid grid-cols-4 gap-1 p-1 mb-5 bg-[var(--bg-color)]/60 rounded-xl border border-[var(--border-color)] shrink-0">
        {[
          { id: "general", label: "General", icon: Sliders },
          { id: "focus", label: "Focus & Blocks", icon: Target },
          { id: "ai", label: "AI & Privacy", icon: Sparkles },
          { id: "about", label: "About & Help", icon: Heart },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-1 sm:px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? "bg-violet-600 text-white shadow-sm shadow-violet-600/30"
                  : "text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-zinc-500/10"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden min-[480px]:inline truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: GENERAL & TRACKING */}
      {activeTab === "general" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Tracking state */}
          <div>
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
              Automatically logs apps and browser tabs you actively use.
            </p>
          </div>

          {/* Incognito mode */}
          <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/20">
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
              Pauses tracking immediately. Nothing is recorded or shown on your timeline.
            </p>
          </div>

          {/* Sensorial Sound Chimes */}
          <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-medium text-[var(--text-color)]">Sensorial Sound Chimes</span>
              </div>
              <button
                onClick={() => {
                  const next = !sound.getEnabled();
                  sound.setEnabled(next);
                  setSoundEnabled(next);
                  if (next) sound.playIgniteFocus();
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  soundEnabled ? "bg-violet-600" : "bg-zinc-400 dark:bg-zinc-800"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    soundEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Plays gentle harmonic Solfeggio chimes when igniting focus and celebratory fanfares for the evening epilogue.
            </p>
          </div>

          {/* Minimum Session to Log */}
          <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/20">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="text-sm font-medium text-[var(--text-color)]">Minimum App Activity</span>
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
              Ignore apps used for less than this time (filters out quick glances).
            </p>
          </div>

          {/* Minimum Tab Session to Log */}
          <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/20">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="text-sm font-medium text-[var(--text-color)]">Minimum Tab & File Duration</span>
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
              Ignore browser tabs or files viewed for less than this time (set to 0s to track all tabs).
            </p>
          </div>

          {/* Launch on Startup */}
          <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Power className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="text-sm font-medium text-[var(--text-color)]">Start on Computer Login</span>
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
              Runs quietly in your system tray as soon as you log in.
            </p>
            {autostartError && (
              <p className="text-[10px] text-red-500 font-medium mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span>{autostartError}</span>
              </p>
            )}
          </div>

          {/* Knowledge Vault & LLM Wiki Directory Card */}
          <div className="p-4 rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 via-[var(--bg-color)]/20 to-transparent">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-color)]">Knowledge Vault Directory</h4>
                  <p className="text-[11px] text-[var(--text-muted)]">Obsidian-compatible Markdown second brain</p>
                </div>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                Local Markdown
              </span>
            </div>

            <p className="text-xs text-[var(--text-muted)] mb-3 leading-relaxed">
              LifeMirror compiles your high-dwell activity sessions into an interlinked Markdown wiki. You can target your existing Obsidian vault or keep the default location.
            </p>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={vaultPathInput}
                  onChange={(e) => setVaultPathInput(e.target.value)}
                  placeholder="e.g. /home/user/Documents/LifeMirror Vault"
                  className="flex-1 px-3 py-1.5 text-xs font-mono rounded-xl bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-color)] focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
                <button
                  onClick={handleSaveVaultPath}
                  disabled={isSavingVaultPath}
                  className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
                >
                  Save
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                <button
                  onClick={handleOpenVaultFolder}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Open Folder in File Manager</span>
                </button>

                <button
                  onClick={handleResetVaultPath}
                  className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-color)] transition-colors cursor-pointer"
                >
                  Reset to Default
                </button>
              </div>

              {vaultSaveMessage && (
                <p className="text-[11px] text-emerald-500 font-medium">{vaultSaveMessage}</p>
              )}

              {/* Danger Zone: Reset Vault */}
              <div className="mt-3 pt-3 border-t border-[var(--border-color)] flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-red-500/90">Danger Zone: Reset Vault</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Archives all notes into .trash/ and resets vault index. SQLite history is 100% untouched.</div>
                </div>
                <button
                  onClick={() => setIsClearVaultModalOpen(true)}
                  disabled={isClearingVault}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {isClearingVault ? "Archiving..." : "Clear & Archive"}
                </button>
              </div>
            </div>
          </div>

          {/* Browser Companion Extension Card */}
          <div className="p-4 rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 via-[var(--bg-color)]/20 to-transparent">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 shrink-0">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-color)]">Companion Browser Extension</h4>
                  <p className="text-[11px] text-[var(--text-muted)]">Log website names and browser tab titles</p>
                </div>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 shrink-0">
                Chrome Web Store
              </span>
            </div>

            <p className="text-xs text-[var(--text-muted)] mb-3 leading-relaxed">
              LifeMirror tracks desktop apps out of the box. To also record specific browser tabs and websites (e.g. GitHub, YouTube, Docs), install our companion extension.
            </p>

            {/* Supported Browsers List */}
            <div className="mb-3.5 p-2.5 rounded-xl bg-[var(--bg-color)]/40 border border-[var(--border-color)]">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)] block mb-1.5">
                Supported Browsers (Chromium-Based):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Google Chrome",
                  "Brave",
                  "Microsoft Edge",
                  "Arc",
                  "Opera",
                  "Vivaldi",
                  "+ All Chromium Browsers",
                ].map((browser) => (
                  <span
                    key={browser}
                    className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-[var(--surface-color)] border border-[var(--border-color)] text-[var(--text-color)]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {browser}
                  </span>
                ))}
              </div>
            </div>

            {/* Actions: Direct Store Link & Copy */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-[var(--border-color)]/60">
              <button
                onClick={handleCopyExtensionLink}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-color)] hover:bg-zinc-500/10 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-color)] transition-colors cursor-pointer"
                title="Copy Chrome Web Store link"
              >
                {copiedExtLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Store Link</span>
                  </>
                )}
              </button>

              <button
                onClick={() => openUrl(CHROME_STORE_URL)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-violet-600/20 hover:shadow-violet-600/30 cursor-pointer"
              >
                <span>Install from Chrome Store</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Privacy & Domain Exclusion Card */}
          <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/20 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-color)]">Privacy & Excluded Domains</h4>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Never track banking, healthcare, or private portals
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                Bidirectional Sync
              </span>
            </div>

            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Excluded domains are never recorded, summarized, or sent over native messaging. Subdomains are covered automatically. Exclusions sync seamlessly with the companion browser extension.
            </p>

            {/* Success Report Toast */}
            {purgeReportToast && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-start gap-2 animate-in fade-in">
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Domain Excluded: {purgeReportToast.domain}</span>
                  <p className="text-[11px] text-emerald-300/80 mt-0.5">
                    {purgeReportToast.sub_sessions_purged} browser visit(s) purged, {purgeReportToast.activity_logs_purged} window log(s) purged.
                    {purgeReportToast.attached_notes_detached > 0 && ` ${purgeReportToast.attached_notes_detached} reflection note(s) preserved.`}
                  </p>
                </div>
              </div>
            )}

            {/* Unattached Notes Notification Banner */}
            {localUnattachedNotes.length > 0 && (
              <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-violet-400 shrink-0" />
                  <span className="text-xs text-[var(--text-color)] truncate">
                    {localUnattachedNotes.length} unattached reflection note(s) preserved
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onRefreshUnattachedNotes?.();
                    setNotesModalOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-violet-600/30 hover:bg-violet-600/50 text-violet-300 text-xs font-medium transition-colors shrink-0 cursor-pointer"
                >
                  View Notes
                </button>
              </div>
            )}

            {/* Quick Presets */}
            <div>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)] block mb-1.5">
                Suggested Financial & Sensitive Portals:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "chase.com",
                  "paypal.com",
                  "bankofamerica.com",
                  "wellsfargo.com",
                  "mychart.org",
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-[var(--surface-color)] border border-[var(--border-color)] text-[var(--text-color)] hover:border-violet-500/40 hover:text-violet-400 transition-colors cursor-pointer"
                  >
                    <Plus className="w-2.5 h-2.5 text-zinc-400" />
                    <span>{preset}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={handleStartExclude} className="space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={domainInput}
                    onChange={(e) => {
                      setDomainInput(e.target.value);
                      if (domainInputError) setDomainInputError(null);
                    }}
                    placeholder="e.g. chase.com, paypal.com"
                    className="w-full bg-[var(--bg-color)]/50 border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-color)] placeholder:text-[var(--text-muted)]/50 focus:outline-none focus:border-violet-500/60 font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!domainInput.trim()}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-rose-600/20 cursor-pointer shrink-0"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Exclude Domain</span>
                </button>
              </div>

              {/* Subdomain Scope Toggle */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--text-muted)] select-none">
                  <input
                    type="checkbox"
                    checked={includeSubdomains}
                    onChange={(e) => setIncludeSubdomains(e.target.checked)}
                    className="rounded border-[var(--border-color)] text-violet-600 focus:ring-0 w-3.5 h-3.5 accent-violet-600 cursor-pointer"
                  />
                  <span>Include all subdomains (e.g. *.chase.com)</span>
                </label>
              </div>

              {domainInputError && (
                <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{domainInputError}</span>
                </p>
              )}

              <p className="text-[10px] text-[var(--text-muted)] leading-tight pt-1">
                * Note: Authentication gateways (SSO, identity providers) often redirect through separate domains and must be excluded individually.
              </p>
            </form>

            {/* Excluded Domains Chip List */}
            <div className="pt-2 border-t border-[var(--border-color)]/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">
                  Active Exclusions ({localExcludedDomains.length})
                </span>
              </div>

              {localExcludedDomains.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] italic py-2">
                  No domains excluded yet. Sensitive sites you exclude will appear here.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {localExcludedDomains.map((entry) => (
                    <div
                      key={entry.domain}
                      className="p-2 rounded-lg bg-[var(--surface-color)]/70 border border-[var(--border-color)] flex items-center justify-between gap-2 group hover:border-[var(--border-color)]/80 transition-colors"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-[var(--text-color)] font-mono block truncate">
                          {entry.domain}
                        </span>
                        <span className="text-[9px] text-[var(--text-muted)] block">
                          {entry.include_subdomains ? "*.subdomains covered" : "Exact site only"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveExcluded(entry.domain)}
                        className="text-[var(--text-muted)] hover:text-rose-400 p-1 rounded transition-colors cursor-pointer shrink-0"
                        title={`Remove exclusion for ${entry.domain}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FOCUS & RULES */}
      {activeTab === "focus" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Deep Work & Distractions */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              <Target className="w-4 h-4 text-rose-400" />
              <span>Distraction Blocker</span>
            </div>
            
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              LifeMirror shows a gentle focus reminder when you open these apps or websites:
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
                className="bg-zinc-800 hover:bg-zinc-700 text-white p-2 rounded-xl border border-zinc-700 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 mt-2 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
              {distractionRules.map(rule => (
                <div key={rule.id} className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-color)]/30 border border-[var(--border-color)]">
                  <span className="font-mono text-xs text-[var(--text-color)] truncate pr-2">{rule.value}</span>
                  <button 
                    onClick={() => handleDeleteRule(rule.id)}
                    className="text-[var(--text-muted)] hover:text-red-400 p-1 rounded-md hover:bg-red-500/10 transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {distractionRules.length === 0 && (
                <div className="text-center py-2 text-xs text-[var(--text-muted)] italic">No blocked websites or apps yet.</div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
              <label className="block text-xs font-medium text-[var(--text-color)] mb-2">Reminder Quote</label>
              <input
                type="text"
                value={customQuote}
                onChange={(e) => setCustomQuote(e.target.value)}
                onBlur={handleCustomQuoteBlur}
                placeholder="e.g., Don't give up what you want most..."
                className="w-full bg-[var(--bg-color)]/50 border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-color)] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
              />
              <p className="text-[10px] text-[var(--text-muted)] mt-1">Replaces the default 'Back to work' text on the reminder popup.</p>
            </div>

            <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
              <label className="block text-xs font-medium text-[var(--text-color)] mb-2">Reminder Photo</label>
              <div className="flex items-center gap-4">
                {customImage ? (
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-[var(--border-color)] shrink-0">
                    <img src={customImage} alt="Custom Toast" className="w-full h-full object-cover" />
                    <button 
                      onClick={clearCustomImage}
                      className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-lg border-2 border-dashed border-[var(--border-color)] flex items-center justify-center bg-[var(--bg-color)]/30 shrink-0">
                    <ShieldAlert className="w-5 h-5 text-[var(--text-muted)] opacity-50" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
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
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">Show a personal photo (e.g. family or personal goal) on the reminder popup. Max 2MB.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Custom Category Overrides Card */}
          <div className="bg-[var(--surface-color)] p-4 rounded-xl shadow-sm border border-[var(--border-color)] min-w-0">
            <div className="flex items-center gap-2 font-semibold text-[var(--text-color)] mb-2">
              <Tag className="w-4 h-4 text-violet-400" />
              <h3 className="text-sm font-semibold">App & Website Categories</h3>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              LifeMirror automatically categorizes your time. Reassign any app or website to a different category here.
            </p>

            <div className="space-y-2 mb-3">
              <input
                type="text"
                value={newOverrideApp}
                onChange={(e) => setNewOverrideApp(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddOverride(); }}
                placeholder="App or domain name (e.g. figma.com, slack)..."
                className="w-full bg-[var(--bg-color)]/50 border border-[var(--border-color)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-color)] focus:outline-none focus:border-violet-500/50"
              />
              <div className="flex items-center gap-2">
                <select
                  value={newOverrideCategory}
                  onChange={(e) => setNewOverrideCategory(e.target.value as ActivityCategory)}
                  className="flex-1 bg-[var(--bg-color)]/50 border border-[var(--border-color)] rounded-xl px-2.5 py-1.5 text-xs text-[var(--text-color)] focus:outline-none cursor-pointer min-w-0"
                >
                  {Object.entries(CATEGORIES).map(([key, info]) => (
                    <option key={key} value={key}>
                      {info.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddOverride}
                  disabled={!newOverrideApp.trim()}
                  className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Rule
                </button>
              </div>
            </div>

            {/* Existing Overrides List */}
            <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-0.5">
              {Object.entries(categoryOverrides).map(([appKey, catKey]) => {
                const catInfo = CATEGORIES[catKey];
                return (
                  <div
                    key={appKey}
                    className="flex items-center justify-between bg-[var(--bg-color)]/40 border border-[var(--border-color)]/60 rounded-xl px-3 py-1.5 text-xs min-w-0"
                  >
                    <div className="flex items-center gap-2 min-w-0 truncate pr-2">
                      <span className="font-mono text-[var(--text-color)] font-medium truncate">{appKey}</span>
                      <span className="text-[var(--text-muted)] text-[10px] shrink-0">→</span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0" style={{ backgroundColor: `${catInfo.color}20`, color: catInfo.color }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: catInfo.color }} />
                        {catInfo.name}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveOverride(appKey)}
                      className="text-[var(--text-muted)] hover:text-red-400 p-1 transition-colors cursor-pointer shrink-0"
                      title="Remove Rule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
              {Object.keys(categoryOverrides).length === 0 && (
                <div className="text-center py-2 text-xs text-[var(--text-muted)] italic">
                  No custom category rules yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AI & PRIVACY CONFIGURATION */}
      {activeTab === "ai" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {isIncognito && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs flex items-center gap-2">
              <Shield className="w-4 h-4 shrink-0" />
              <span>Incognito mode is active. AI reflections are paused until tracking resumes.</span>
            </div>
          )}

          {!trackingActive && (
            <div className="p-3 rounded-xl bg-zinc-500/10 border border-zinc-500/20 text-[var(--text-muted)] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Activity tracking is paused. You can still configure and test your AI endpoint below.</span>
            </div>
          )}

          {/* 1. LIVE ENGINE STATUS CARD */}
          <div className="glass p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-color)]/70 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                  selectedAiMode === "off"
                    ? "bg-zinc-500/10 border-zinc-500/20 text-zinc-400"
                    : selectedAiMode === "local"
                    ? connectionStatus === "connected"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    : cloudApiKey
                    ? "bg-violet-500/10 border-violet-500/30 text-violet-400"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                }`}>
                  {selectedAiMode === "off" ? (
                    <Ban className="w-4 h-4" />
                  ) : selectedAiMode === "local" ? (
                    <Cpu className="w-4 h-4" />
                  ) : (
                    <Cloud className="w-4 h-4" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[var(--text-color)]">
                      {selectedAiMode === "off"
                        ? "AI Reflections Disabled"
                        : selectedAiMode === "local"
                        ? "On-Device Engine (Ollama)"
                        : `Online Service (${localCloudProvider === "gemini" ? "Google Gemini" : localCloudProvider === "groq" ? "Groq Cloud" : localCloudProvider === "openai" ? "OpenAI" : "OpenRouter"})`}
                    </span>

                    {/* Live status pill */}
                    {selectedAiMode === "off" ? (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-500/10 border border-zinc-500/20 text-zinc-400">
                        ⚪ Inactive
                      </span>
                    ) : selectedAiMode === "local" ? (
                      connectionStatus === "connected" ? (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Ready & Connected
                        </span>
                      ) : connectionStatus === "testing" ? (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center gap-1">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          Testing...
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center gap-1">
                          <XCircle className="w-2.5 h-2.5" />
                          Offline / Unreachable
                        </span>
                      )
                    ) : cloudApiKey ? (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-400 flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" />
                        Configured
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">
                        Missing API Key
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    {selectedAiMode === "off"
                      ? "LifeMirror functions as a private desktop activity tracker. No AI computation."
                      : selectedAiMode === "local"
                      ? "100% Private Loopback · Zero data ever leaves your computer"
                      : "Direct Encrypted HTTPS · Fast response & zero RAM usage"}
                  </p>
                </div>
              </div>

              {/* Status Action */}
              <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                {selectedAiMode === "local" && (
                  <button
                    type="button"
                    onClick={() => handleTestConnection(true)}
                    disabled={connectionStatus === "testing"}
                    className="px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/60 hover:bg-[var(--surface-color)] text-[11px] font-medium text-[var(--text-color)] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${connectionStatus === "testing" ? "animate-spin" : ""}`} />
                    <span>Check Connection</span>
                  </button>
                )}
                {selectedAiMode === "cloud" && (
                  <button
                    type="button"
                    onClick={() => setShowDisclosureModal(true)}
                    className="px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/60 hover:bg-[var(--surface-color)] text-[11px] font-medium text-sky-400 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Inspect Payload</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Metadata Bar */}
            {selectedAiMode !== "off" && (
              <div className="pt-2 border-t border-[var(--border-color)]/50 flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-muted)]">
                <div className="flex items-center gap-1">
                  <span className="text-[var(--text-muted)]">Model:</span>
                  <span className="font-mono font-semibold text-[var(--text-color)] bg-[var(--bg-color)] px-1.5 py-0.5 rounded border border-[var(--border-color)]">
                    {selectedAiMode === "local" ? (aiModel || "llama3.2") : (localCloudModel || "gemini-2.5-flash")}
                  </span>
                </div>
                {selectedAiMode === "local" && (
                  <div className="flex items-center gap-1">
                    <span className="text-[var(--text-muted)]">Endpoint:</span>
                    <span className="font-mono text-[var(--text-muted)]">
                      {aiUrl || "http://localhost:11434"}
                    </span>
                  </div>
                )}
                {selectedAiMode === "local" && (
                  <div className="flex items-center gap-1 ml-auto">
                    <span className="text-[var(--text-muted)]">Mode:</span>
                    <span className="text-emerald-400 font-medium">
                      {aiProcessingMode === "on_demand" ? "⚡ On-Demand" : "🔄 Continuous"}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. THREE-WAY MODE SELECTOR */}
          <div className="bg-[var(--surface-color)] p-4 rounded-2xl shadow-sm border border-[var(--border-color)] space-y-4">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Choose Intelligence Engine
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Select where reflections and focus insights are processed.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTradeoffsModal(!showTradeoffsModal)}
                  className="text-xs text-violet-400 hover:text-violet-300 font-medium inline-flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                >
                  <span>{showTradeoffsModal ? "Hide Specs Comparison" : "Compare Hardware & Privacy Specs"}</span>
                  {showTradeoffsModal ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* 3 Mode Choice Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Mode: On-Device */}
                <button
                  type="button"
                  onClick={async () => {
                    setSelectedAiMode("local");
                    await onUpdateAiMode?.("local");
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                    selectedAiMode === "local"
                      ? "border-emerald-500/60 bg-emerald-500/10 shadow-sm shadow-emerald-500/10 text-[var(--text-color)]"
                      : "border-[var(--border-color)] bg-[var(--bg-color)]/30 hover:border-[var(--border-color)]/80 text-[var(--text-muted)]"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--text-color)]">
                        <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                        <span>On-Device</span>
                      </div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        100% Private
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                      Runs locally on your computer via Ollama. Free forever, no data sent to cloud.
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                    <Check className={`w-3 h-3 ${selectedAiMode === "local" ? "opacity-100" : "opacity-0"}`} />
                    <span>{selectedAiMode === "local" ? "Active Engine" : "Select On-Device"}</span>
                  </div>
                </button>

                {/* Mode: Online Service */}
                <button
                  type="button"
                  onClick={async () => {
                    setSelectedAiMode("cloud");
                    await onUpdateAiMode?.("cloud");
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                    selectedAiMode === "cloud"
                      ? "border-violet-500/60 bg-violet-500/10 shadow-sm shadow-violet-500/10 text-[var(--text-color)]"
                      : "border-[var(--border-color)] bg-[var(--bg-color)]/30 hover:border-[var(--border-color)]/80 text-[var(--text-muted)]"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--text-color)]">
                        <Cloud className="w-3.5 h-3.5 text-violet-400" />
                        <span>Online Service</span>
                      </div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 border border-violet-500/30">
                        Zero RAM
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                      Connect Gemini, Groq, or OpenAI with your key. Instant setup, zero downloads.
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-violet-400 font-medium">
                    <Check className={`w-3 h-3 ${selectedAiMode === "cloud" ? "opacity-100" : "opacity-0"}`} />
                    <span>{selectedAiMode === "cloud" ? "Active Engine" : "Select Online"}</span>
                  </div>
                </button>

                {/* Mode: Disabled */}
                <button
                  type="button"
                  onClick={async () => {
                    setSelectedAiMode("off");
                    await onUpdateAiMode?.("off");
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                    selectedAiMode === "off"
                      ? "border-zinc-500/60 bg-zinc-500/10 shadow-sm text-[var(--text-color)]"
                      : "border-[var(--border-color)] bg-[var(--bg-color)]/30 hover:border-[var(--border-color)]/80 text-[var(--text-muted)]"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--text-color)]">
                        <Ban className="w-3.5 h-3.5 text-zinc-400" />
                        <span>AI Off</span>
                      </div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-500/20 text-zinc-400 border border-zinc-500/30">
                        Tracking Only
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                      Pause all AI processing. Track app time and focus without summaries or chat.
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-zinc-400 font-medium">
                    <Check className={`w-3 h-3 ${selectedAiMode === "off" ? "opacity-100" : "opacity-0"}`} />
                    <span>{selectedAiMode === "off" ? "Active Engine" : "Turn AI Off"}</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Collapsible Hardware & Privacy Specs Table */}
            {showTradeoffsModal && (
              <div className="p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/60 text-xs space-y-2 animate-in fade-in duration-150">
                <span className="font-bold text-[var(--text-color)] block text-xs">
                  Hardware & Privacy Comparison
                </span>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)]">
                        <th className="py-1.5 pr-2 font-medium">Category</th>
                        <th className="py-1.5 pr-2 font-medium text-emerald-400">💻 On-Device (Ollama)</th>
                        <th className="py-1.5 font-medium text-violet-400">☁️ Online (Gemini / Groq / OpenAI)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)]/40 text-[var(--text-muted)]">
                      <tr>
                        <td className="py-1.5 font-medium text-[var(--text-color)]">Privacy</td>
                        <td className="py-1.5 text-emerald-400 font-medium">100% Offline, Zero data leaves device</td>
                        <td className="py-1.5">Direct HTTPS to provider with private API key</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 font-medium text-[var(--text-color)]">Disk Space</td>
                        <td className="py-1.5">Requires ~2.0 GB - 4.5 GB for model files</td>
                        <td className="py-1.5 text-emerald-400 font-medium">0 MB (Zero local download)</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 font-medium text-[var(--text-color)]">System RAM</td>
                        <td className="py-1.5">8GB - 16GB+ RAM recommended</td>
                        <td className="py-1.5 text-emerald-400 font-medium">Runs fast on any laptop or netbook</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 font-medium text-[var(--text-color)]">Battery & Fans</td>
                        <td className="py-1.5">Uses laptop CPU/GPU resources</td>
                        <td className="py-1.5 text-emerald-400 font-medium">Zero fan noise or laptop battery strain</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 font-medium text-[var(--text-color)]">Cost</td>
                        <td className="py-1.5 text-emerald-400 font-medium">Free forever</td>
                        <td className="py-1.5">Free tiers available (AI Studio / Groq) or fractions of a cent</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VIEW 1: ON-DEVICE AI CONFIG */}
            {selectedAiMode === "local" && (
              <div className="space-y-4 pt-3 border-t border-[var(--border-color)]">
                {/* Offline Troubleshooting Banner */}
                {connectionStatus === "disconnected" && (
                  <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs space-y-2.5">
                    <div className="flex items-start gap-2 text-rose-400 font-semibold">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <span>Ollama is not running on your computer</span>
                        <p className="text-[11px] text-[var(--text-muted)] font-normal mt-0.5 leading-relaxed">
                          To use on-device private AI, start Ollama or download it from <a href="https://ollama.com" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">ollama.com</a>.
                        </p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[var(--bg-color)]/80 border border-[var(--border-color)] flex items-center justify-between gap-2">
                      <div className="font-mono text-emerald-400 text-[11px] truncate select-all">
                        ollama run llama3.2
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText("ollama run llama3.2");
                            setCopiedOllamaCmd(true);
                            setTimeout(() => setCopiedOllamaCmd(false), 2000);
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                        className="px-2 py-1 rounded bg-[var(--surface-color)] hover:bg-zinc-500/20 text-[10px] font-medium text-[var(--text-color)] border border-[var(--border-color)] flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        {copiedOllamaCmd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedOllamaCmd ? "Copied" : "Copy Command"}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await openUrl("https://ollama.com");
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className="text-[11px] text-emerald-400 hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Download Ollama</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                      <span className="text-[var(--text-muted)]">·</span>
                      <button
                        type="button"
                        onClick={() => handleTestConnection(true)}
                        className="text-[11px] text-[var(--text-color)] hover:underline font-medium cursor-pointer"
                      >
                        Retry Connection
                      </button>
                    </div>
                  </div>
                )}

                {/* Model Selector & Suggestions */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[var(--text-color)]">
                      Local Model
                    </label>
                    {loadingOllamaModels && (
                      <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        Detecting installed models...
                      </span>
                    )}
                  </div>

                  {/* Dropdown if models exist */}
                  {installedOllamaModels.length > 0 ? (
                    <div>
                      {(() => {
                        const activeVal = aiModel === "false" ? "" : aiModel;
                        const hasExactMatch = installedOllamaModels.includes(activeVal);
                        const matchedTag = hasExactMatch
                          ? activeVal
                          : installedOllamaModels.find((m) => m === `${activeVal}:latest` || m.replace(/:latest$/, "") === activeVal) || activeVal;
                        return (
                          <select
                            value={matchedTag}
                            onChange={(e) => setAiModel(e.target.value)}
                            className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-color)] focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                          >
                            {installedOllamaModels.map((m) => (
                              <option key={m} value={m}>
                                {m} {m.includes("llama3.2") ? "(Recommended)" : ""}
                              </option>
                            ))}
                            {!installedOllamaModels.includes(matchedTag) && activeVal && (
                              <option value={activeVal}>{activeVal} (Custom / Other)</option>
                            )}
                          </select>
                        );
                      })()}
                      <span className="text-[10px] text-emerald-400 mt-1 block">
                        ✓ Showing models installed in your local Ollama instance
                      </span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={aiModel === "false" ? "" : aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      placeholder="e.g. llama3.2"
                      className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-color)] focus:outline-none focus:border-emerald-500/50"
                    />
                  )}

                  {/* Model Quick Preset Pills */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-[var(--text-muted)]">Quick presets:</span>
                    {[
                      { name: "llama3.2", label: "llama3.2 (3B · Recommended)" },
                      { name: "qwen2.5:3b", label: "qwen2.5:3b (3B · Fast)" },
                      { name: "mistral", label: "mistral (7B)" },
                    ].map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => setAiModel(preset.name)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                          aiModel === preset.name
                            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 font-semibold"
                            : "bg-[var(--bg-color)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-color)]"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Collapsible Advanced Endpoint URL */}
                <div className="pt-2 border-t border-[var(--border-color)]/60">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedOllamaUrl(!showAdvancedOllamaUrl)}
                    className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-color)] font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>{showAdvancedOllamaUrl ? "Hide Endpoint Settings" : "Advanced Endpoint Settings (URL)"}</span>
                    {showAdvancedOllamaUrl ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {showAdvancedOllamaUrl && (
                    <div className="mt-2 p-3 rounded-xl bg-[var(--bg-color)]/50 border border-[var(--border-color)] space-y-2 animate-in fade-in duration-100">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-[var(--text-muted)] font-medium">Ollama Server URL</label>
                        <span className="text-[10px] text-emerald-400 font-medium">Default: http://localhost:11434</span>
                      </div>
                      <input
                        type="text"
                        value={aiUrl === "false" ? "" : aiUrl}
                        onChange={(e) => {
                          setAiUrl(e.target.value);
                          setConnectionStatus('idle');
                          setConnectionMessage('');
                        }}
                        placeholder="http://localhost:11434"
                        className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-color)] font-mono focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                  )}
                </div>

                {/* AI Processing Mode */}
                <div className="pt-2 border-t border-[var(--border-color)]/60 space-y-2">
                  <label className="block text-xs font-semibold text-[var(--text-color)]">
                    Performance & Battery Impact
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Processing Mode">
                    {/* On-Demand */}
                    <button
                      type="button"
                      role="radio"
                      aria-checked={aiProcessingMode === "on_demand"}
                      onClick={() => setAiProcessingMode?.("on_demand")}
                      className={`text-left p-3 rounded-xl border transition-all cursor-pointer relative ${
                        aiProcessingMode === "on_demand"
                          ? "border-emerald-500/60 bg-emerald-500/10 text-[var(--text-color)]"
                          : "border-[var(--border-color)] bg-[var(--bg-color)]/30 text-[var(--text-muted)]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-[var(--text-color)] flex items-center gap-1.5">
                          <span>⚡ On-Demand</span>
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Silent Fans
                        </span>
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                        Processes reflections only when you open them. Zero background CPU or fan noise.
                      </p>
                    </button>

                    {/* Continuous */}
                    <button
                      type="button"
                      role="radio"
                      aria-checked={aiProcessingMode === "continuous"}
                      onClick={() => setAiProcessingMode?.("continuous")}
                      className={`text-left p-3 rounded-xl border transition-all cursor-pointer relative ${
                        aiProcessingMode === "continuous"
                          ? "border-violet-500/60 bg-violet-500/10 text-[var(--text-color)]"
                          : "border-[var(--border-color)] bg-[var(--bg-color)]/30 text-[var(--text-muted)]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-[var(--text-color)] flex items-center gap-1.5">
                          <span>🔄 Continuous</span>
                        </span>
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                        Builds reflections continuously in the background (uses more CPU & battery).
                      </p>
                    </button>
                  </div>
                </div>

                {/* Connection Status & Test button */}
                <div className="pt-2 border-t border-[var(--border-color)] flex items-center justify-between">
                  <div className="text-xs">
                    {connectionStatus !== 'idle' && (
                      <span className={`flex items-center gap-1 text-xs font-medium ${
                        connectionStatus === 'connected' ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {connectionStatus === 'connected' ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        <span>{connectionMessage}</span>
                      </span>
                    )}
                  </div>

                  <button 
                    type="button"
                    onClick={() => {
                      if (!aiUrl || aiUrl === "false") setAiUrl("http://localhost:11434");
                      if (!aiModel || aiModel === "false") setAiModel("llama3.2");
                      handleTestConnection(true);
                    }}
                    disabled={connectionStatus === 'testing'}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-900/20"
                  >
                    {connectionStatus === 'testing' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>{connectionStatus === 'testing' ? 'Testing Ollama...' : 'Test Local Connection'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* VIEW 2: ONLINE SERVICE (CLOUD) CONFIG */}
            {selectedAiMode === "cloud" && (
              <div className="space-y-4 pt-3 border-t border-[var(--border-color)] text-xs">
                {/* Provider Selector Tabs */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-color)] mb-1.5">
                    Select Cloud Provider
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* Google Gemini */}
                    <button
                      type="button"
                      onClick={() => {
                        setLocalCloudProvider("gemini");
                        setLocalCloudUrl("https://generativelanguage.googleapis.com/v1beta/openai");
                        setLocalCloudModel("gemini-2.5-flash");
                        setCloudTestStatus("idle");
                      }}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        localCloudProvider === "gemini"
                          ? "border-violet-500 bg-violet-500/15 text-[var(--text-color)] font-bold shadow-sm"
                          : "border-[var(--border-color)] bg-[var(--bg-color)]/30 text-[var(--text-muted)]"
                      }`}
                    >
                      <span className="block text-xs font-semibold">Gemini</span>
                      <span className="text-[9px] text-emerald-400 font-medium">Free AI Studio</span>
                    </button>

                    {/* Groq */}
                    <button
                      type="button"
                      onClick={() => {
                        setLocalCloudProvider("groq");
                        setLocalCloudUrl("https://api.groq.com/openai/v1");
                        setLocalCloudModel("llama-3.3-70b-versatile");
                        setCloudTestStatus("idle");
                      }}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        localCloudProvider === "groq"
                          ? "border-violet-500 bg-violet-500/15 text-[var(--text-color)] font-bold shadow-sm"
                          : "border-[var(--border-color)] bg-[var(--bg-color)]/30 text-[var(--text-muted)]"
                      }`}
                    >
                      <span className="block text-xs font-semibold">Groq</span>
                      <span className="text-[9px] text-emerald-400 font-medium">Fast / Free Tier</span>
                    </button>

                    {/* OpenAI */}
                    <button
                      type="button"
                      onClick={() => {
                        setLocalCloudProvider("openai");
                        setLocalCloudUrl("https://api.openai.com/v1");
                        setLocalCloudModel("gpt-4o-mini");
                        setCloudTestStatus("idle");
                      }}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        localCloudProvider === "openai"
                          ? "border-violet-500 bg-violet-500/15 text-[var(--text-color)] font-bold shadow-sm"
                          : "border-[var(--border-color)] bg-[var(--bg-color)]/30 text-[var(--text-muted)]"
                      }`}
                    >
                      <span className="block text-xs font-semibold">OpenAI</span>
                      <span className="text-[9px] text-zinc-400">gpt-4o-mini</span>
                    </button>

                    {/* OpenRouter */}
                    <button
                      type="button"
                      onClick={() => {
                        setLocalCloudProvider("openrouter");
                        setLocalCloudUrl("https://openrouter.ai/api/v1");
                        setLocalCloudModel("meta-llama/llama-3.3-70b-instruct:free");
                        setCloudTestStatus("idle");
                      }}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        localCloudProvider === "openrouter"
                          ? "border-violet-500 bg-violet-500/15 text-[var(--text-color)] font-bold shadow-sm"
                          : "border-[var(--border-color)] bg-[var(--bg-color)]/30 text-[var(--text-muted)]"
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
                    <label className="text-xs font-medium text-[var(--text-muted)]">
                      {localCloudProvider === "gemini"
                        ? "Google Gemini API Key"
                        : localCloudProvider === "groq"
                        ? "Groq API Key"
                        : localCloudProvider === "openai"
                        ? "OpenAI API Key"
                        : "API Key"}
                    </label>

                    {localCloudProvider === "gemini" && (
                      <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-[10px] text-violet-400 hover:text-violet-300 underline font-medium inline-flex items-center gap-0.5"
                      >
                        Get Free Gemini Key (AI Studio) <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                    {localCloudProvider === "groq" && (
                      <a 
                        href="https://console.groq.com/keys" 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-[10px] text-violet-400 hover:text-violet-300 underline font-medium inline-flex items-center gap-0.5"
                      >
                        Get Free Groq Key <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                    {localCloudProvider === "openai" && (
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
                      type={showCloudKey ? "text" : "password"}
                      value={localCloudKey}
                      onChange={(e) => {
                        setLocalCloudKey(e.target.value);
                        setCloudTestStatus("idle");
                      }}
                      placeholder="Paste your API key here"
                      className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-3 py-2 pr-10 text-xs text-[var(--text-color)] font-mono focus:outline-none focus:border-violet-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCloudKey(!showCloudKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-color)] cursor-pointer"
                    >
                      {showCloudKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Model Identifier & Presets */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[var(--text-muted)]">
                    Model Identifier
                  </label>
                  <input
                    type="text"
                    value={localCloudModel}
                    onChange={(e) => setLocalCloudModel(e.target.value)}
                    placeholder="e.g. gemini-2.5-flash or llama-3.3-70b-versatile"
                    className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-color)] font-mono"
                  />

                  {/* Preset Pills for current provider */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-[var(--text-muted)]">Suggestions:</span>
                    {localCloudProvider === "gemini" && [
                      "gemini-2.5-flash",
                      "gemini-1.5-flash",
                      "gemini-2.0-flash",
                    ].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setLocalCloudModel(m)}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-all cursor-pointer ${
                          localCloudModel === m
                            ? "bg-violet-500/20 border-violet-500/40 text-violet-300 font-semibold"
                            : "bg-[var(--bg-color)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-color)]"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                    {localCloudProvider === "groq" && [
                      "llama-3.3-70b-versatile",
                      "llama-3.1-8b-instant",
                      "mixtral-8x7b-32768",
                    ].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setLocalCloudModel(m)}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-all cursor-pointer ${
                          localCloudModel === m
                            ? "bg-violet-500/20 border-violet-500/40 text-violet-300 font-semibold"
                            : "bg-[var(--bg-color)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-color)]"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                    {localCloudProvider === "openai" && [
                      "gpt-4o-mini",
                      "gpt-4o",
                    ].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setLocalCloudModel(m)}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-all cursor-pointer ${
                          localCloudModel === m
                            ? "bg-violet-500/20 border-violet-500/40 text-violet-300 font-semibold"
                            : "bg-[var(--bg-color)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-color)]"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Inline Privacy Assurance */}
                <div className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/50 text-[11px] text-[var(--text-muted)] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[var(--text-color)] flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-violet-400" />
                      Direct Encrypted Communication
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowDisclosureModal(true)}
                      className="text-[10px] text-sky-400 hover:underline font-medium cursor-pointer"
                    >
                      Inspect Live Data Payload
                    </button>
                  </div>
                  <p className="leading-relaxed">
                    LifeMirror communicates directly with {localCloudProvider === "gemini" ? "Google" : localCloudProvider === "groq" ? "Groq" : "OpenAI"} over HTTPS using your personal API key. Your logs never pass through or get saved on LifeMirror servers.
                  </p>
                </div>

                {/* Test status banner */}
                {cloudTestStatus !== "idle" && (
                  <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    cloudTestStatus === "success" 
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                  }`}>
                    {cloudTestStatus === "success" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>{cloudTestMessage}</span>
                  </div>
                )}

                {/* Action Row: Single Unified "Save & Connect" Action */}
                <div className="pt-2 border-t border-[var(--border-color)] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDisclosureModal(true)}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-color)] underline cursor-pointer"
                  >
                    Privacy Review
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!localCloudKey.trim()) {
                          setCloudTestStatus("error");
                          setCloudTestMessage("Please enter an API key first.");
                          return;
                        }
                        setIsSavingCloud(true);
                        setCloudTestStatus("idle");
                        setCloudTestMessage("");
                        try {
                          await invoke("test_cloud_connection", {
                            baseUrl: localCloudUrl,
                            apiKey: localCloudKey.trim(),
                            model: localCloudModel,
                          });
                          await onSaveCloudConfig?.(localCloudProvider, localCloudKey.trim(), localCloudUrl, localCloudModel);
                          setCloudTestStatus("success");
                          setCloudTestMessage("Connection verified & cloud configuration saved!");
                        } catch (err: any) {
                          setCloudTestStatus("error");
                          setCloudTestMessage(err?.toString() || "Connection test failed. Check key & URL.");
                        } finally {
                          setIsSavingCloud(false);
                        }
                      }}
                      disabled={isSavingCloud || !localCloudKey.trim()}
                      className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-violet-900/20"
                    >
                      {isSavingCloud ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>{isSavingCloud ? "Verifying..." : "Save & Connect"}</span>
                    </button>
                  </div>
                </div>

                {/* Revoke Key Danger Zone */}
                {cloudApiKey && (
                  <div className="pt-3 border-t border-rose-500/20 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-rose-400 block">Revoke Cloud Access</span>
                      <span className="text-[10px] text-[var(--text-muted)]">Deletes your API key from encrypted storage and reverts to offline.</span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await onRevokeCloudAccess?.();
                        setLocalCloudKey("");
                        setCloudTestStatus("idle");
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold cursor-pointer"
                    >
                      Delete Key
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* VIEW 3: AI OFF */}
            {selectedAiMode === "off" && (
              <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/30 text-xs space-y-3 pt-3">
                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                  <Ban className="w-4 h-4 text-zinc-400" />
                  <span className="font-semibold text-[var(--text-color)]">AI Reflections are Currently Off</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  LifeMirror is functioning purely as a private desktop activity tracker and focus timer. No CPU power, RAM, or network connections are used for AI.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      setSelectedAiMode("local");
                      await onUpdateAiMode?.("local");
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs cursor-pointer flex items-center gap-1"
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Turn On On-Device AI</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setSelectedAiMode("cloud");
                      await onUpdateAiMode?.("cloud");
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs cursor-pointer flex items-center gap-1"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Turn On Online Service</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Privacy Disclosure Modal */}
          <CloudPrivacyDisclosureModal
            isOpen={showDisclosureModal}
            provider={localCloudProvider}
            model={localCloudModel}
            onConfirm={async () => {
              setShowDisclosureModal(false);
              await onSaveCloudConfig?.(localCloudProvider, localCloudKey.trim(), localCloudUrl, localCloudModel);
              setCloudTestStatus("success");
              setCloudTestMessage("Cloud configuration saved successfully!");
            }}
            onCancel={() => setShowDisclosureModal(false)}
          />
        </div>
      )}

      {/* TAB 4: ABOUT, SUPPORT & MISSION */}
      {activeTab === "about" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Support Card */}
          <div className="bg-[var(--surface-color)] p-4 rounded-xl shadow-sm border border-sky-500/20 bg-sky-500/5 min-w-0">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <LifeBuoy className="w-4 h-4 text-sky-400 shrink-0" />
                <h4 className="text-sm font-semibold text-[var(--text-color)]">Help & Support</h4>
              </div>
              <span className="text-[10px] font-mono text-sky-400 font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 shrink-0">
                Direct Support
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-3 leading-relaxed">
              Email us directly at <span className="font-mono text-[var(--text-color)] font-medium select-all">vrpieapps@gmail.com</span> with prefilled diagnostics, or click below:
            </p>
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-sky-500/10">
              <span className="text-[11px] font-mono text-[var(--text-muted)] truncate">vrpieapps@gmail.com</span>
              <button
                onClick={onSupportClick}
                className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-sky-600/20 shrink-0"
              >
                <LifeBuoy className="w-3.5 h-3.5" />
                <span>Contact Support</span>
              </button>
            </div>
          </div>

          {/* Support Developer Card */}
          <div className="bg-[var(--surface-color)] p-4 rounded-xl shadow-sm border border-rose-500/20 bg-rose-500/5 min-w-0">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500/20 shrink-0" />
                <h4 className="text-sm font-semibold text-[var(--text-color)]">Support LifeMirror</h4>
              </div>
              <span className="text-[10px] text-rose-400 font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 shrink-0">
                100% Indie & Private
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-3 leading-relaxed">
              LifeMirror is independently built with zero tracking, no telemetry, and no subscriptions. If it brings clarity to your day, your support helps keep it thriving.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-rose-500/10">
              <button
                onClick={onDonateClick}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-rose-600/20 shrink-0"
              >
                <Heart className="w-3.5 h-3.5 fill-white/20" />
                <span>Support Developer</span>
              </button>
            </div>
          </div>

          {/* Companion Browser Extension Quick Link */}
          <div className="p-3 rounded-xl border border-violet-500/20 bg-violet-500/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400 shrink-0">
                <Globe className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-[var(--text-color)] block truncate">Companion Browser Extension</span>
                <span className="text-[10px] text-[var(--text-muted)] block">Chrome, Brave, Edge, Arc, Opera, Vivaldi</span>
              </div>
            </div>
            <button
              onClick={() => openUrl(CHROME_STORE_URL)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 text-xs font-medium transition-colors shrink-0 cursor-pointer"
            >
              <span>Chrome Store</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {/* LifeMirror Mobile (Android) Quick Link */}
          <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-[var(--text-color)] block truncate">LifeMirror for Android</span>
                <span className="text-[10px] text-[var(--text-muted)] block">Standalone, 100% offline time & habit tracker</span>
              </div>
            </div>
            <button
              onClick={() => openUrl(PLAY_STORE_URL)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium transition-colors shrink-0 cursor-pointer"
              title="Open LifeMirror on Google Play Store"
            >
              <span>Google Play</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {/* Local-First Architecture Reassurance */}
          <div className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/30 text-[11px] text-[var(--text-muted)] space-y-1">
            <div className="font-semibold text-[var(--text-color)] flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Offline & Encrypted by Design</span>
            </div>
            <p>
              Your logs are stored inside a locally encrypted SQLCipher database on your machine. No telemetry or analytics data ever leaves your device.
            </p>
          </div>
        </div>
      )}

      {/* Purge Confirmation Modal */}
      {purgeModalOpen && purgePreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => !isPurging && setPurgeModalOpen(false)}
          />
          <div className="relative bg-[var(--bg-primary)] dark:bg-zinc-900 border border-[var(--border-color)] dark:border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
                <Ban className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--text-color)]">
                  Exclude {pendingDomain}
                </h3>
                <span className="text-xs text-[var(--text-muted)]">
                  {pendingIncludeSubdomains ? `All subdomains (*.${pendingDomain}) will be excluded` : `Only exact host (${pendingDomain})`}
                </span>
              </div>
            </div>

            {/* Impact Count Summary */}
            <div className="p-3.5 rounded-xl bg-[var(--surface-color)]/70 border border-[var(--border-color)] space-y-2 text-xs">
              <span className="font-semibold text-[var(--text-color)] block">Existing History in LifeMirror:</span>
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span>Matching browser tab visits:</span>
                <span className="font-semibold font-mono text-[var(--text-color)]">{purgePreview.sub_sessions_count}</span>
              </div>
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span>Matching window activity logs:</span>
                <span className="font-semibold font-mono text-[var(--text-color)]">{purgePreview.activity_logs_count}</span>
              </div>
              {purgePreview.attached_notes_count > 0 && (
                <div className="flex items-center justify-between text-violet-400 font-medium pt-1 border-t border-[var(--border-color)]/50">
                  <span>Attached journal notes:</span>
                  <span>{purgePreview.attached_notes_count} (will be preserved in Unattached Notes)</span>
                </div>
              )}

              {purgePreview.matching_hosts.length > 0 && (
                <div className="pt-2 border-t border-[var(--border-color)]/50">
                  <span className="text-[10px] text-[var(--text-muted)] block mb-1">Subdomains found in history:</span>
                  <div className="flex flex-wrap gap-1">
                    {purgePreview.matching_hosts.map((host) => (
                      <span key={host} className="px-1.5 py-0.5 rounded bg-[var(--bg-color)] border border-[var(--border-color)] text-[10px] font-mono text-[var(--text-color)]">
                        {host}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Purge Choice (Directive 1) */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-[var(--text-color)] block">Choose action:</span>
              
              <label
                onClick={() => setPurgeExistingHistory(true)}
                className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                  purgeExistingHistory
                    ? "border-rose-500/50 bg-rose-500/10"
                    : "border-[var(--border-color)] bg-[var(--bg-color)]/20 hover:border-zinc-500/30"
                }`}
              >
                <input
                  type="radio"
                  name="purge_choice"
                  checked={purgeExistingHistory}
                  onChange={() => setPurgeExistingHistory(true)}
                  className="mt-0.5 accent-rose-500"
                />
                <div>
                  <span className="text-xs font-semibold text-[var(--text-color)] block">
                    Also delete existing history from LifeMirror (recommended)
                  </span>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                    Permanently purges matching visits, window titles, and AI summaries from LifeMirror's local database. Chrome's own history is untouched.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setPurgeExistingHistory(false)}
                className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                  !purgeExistingHistory
                    ? "border-violet-500/50 bg-violet-500/10"
                    : "border-[var(--border-color)] bg-[var(--bg-color)]/20 hover:border-zinc-500/30"
                }`}
              >
                <input
                  type="radio"
                  name="purge_choice"
                  checked={!purgeExistingHistory}
                  onChange={() => setPurgeExistingHistory(false)}
                  className="mt-0.5 accent-violet-500"
                />
                <div>
                  <span className="text-xs font-semibold text-[var(--text-color)] block">
                    Only stop tracking from now on
                  </span>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                    Keep previous history in LifeMirror, but never log or record visits to this domain in the future.
                  </p>
                </div>
              </label>
            </div>

            {/* Reassurance notes */}
            <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-[11px] text-emerald-400 flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 shrink-0" />
              <span>Chrome's own browsing history will not be touched.</span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isPurging}
                onClick={() => setPurgeModalOpen(false)}
                className="flex-1 py-2 rounded-xl text-xs font-medium text-[var(--text-color)] bg-[var(--bg-color)] border border-[var(--border-color)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPurging}
                onClick={handleConfirmExclude}
                className="flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isPurging ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Purging...</span>
                  </>
                ) : (
                  <span>Exclude Domain</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unattached Notes Modal */}
      {notesModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setNotesModalOpen(false)}
          />
          <div className="relative bg-[var(--bg-primary)] dark:bg-zinc-900 border border-[var(--border-color)] dark:border-zinc-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-violet-400" />
                <h3 className="text-base font-semibold text-[var(--text-color)]">
                  Unattached Reflection Notes
                </h3>
              </div>
              <button
                onClick={() => setNotesModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-color)] p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              These notes were preserved when their timeline events were purged during domain exclusion. Your personal reflections are never lost.
            </p>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {localUnattachedNotes.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] italic py-4 text-center">
                  No unattached notes found.
                </p>
              ) : (
                localUnattachedNotes.map((note, index) => (
                  <div
                    key={note.id || index}
                    className="p-3 rounded-xl bg-[var(--surface-color)] border border-[var(--border-color)] space-y-2"
                  >
                    <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                      <span>{note.timestamp}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyNote(note)}
                        className="inline-flex items-center gap-1 hover:text-violet-400 transition-colors cursor-pointer"
                      >
                        {copiedNoteId === note.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400 font-semibold">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-[var(--text-color)] whitespace-pre-wrap leading-relaxed">
                      {note.notes}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-[var(--border-color)] flex justify-end">
              <button
                type="button"
                onClick={() => setNotesModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-color)] bg-[var(--surface-color)] hover:bg-zinc-500/10 border border-[var(--border-color)] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal: Clear & Archive Vault */}
      <ConfirmModal
        isOpen={isClearVaultModalOpen}
        title="Clear & Archive Vault"
        message="This will archive all current notes (projects, topics, sessions, periodic) into a timestamped snapshot in .trash/ and reset your vault index. Your encrypted SQLite database history is completely untouched. Are you sure you want to proceed?"
        onConfirm={handleClearVault}
        onCancel={() => setIsClearVaultModalOpen(false)}
      />
    </div>
  );
};
