import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  enable as enableAutostart,
  disable as disableAutostart,
  isEnabled as isAutostartActive,
} from "@tauri-apps/plugin-autostart";

export function useSettings() {
  // Theme
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  // Incognito & Tracking
  const [isIncognito, setIsIncognito] = useState(false);
  const [trackingActive, setTrackingActive] = useState(true);

  // Settings panel visibility
  const [showSettings, setShowSettings] = useState(false);

  // Ollama configuration
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("llama3.2");

  // DB Log Threshold & Windows configurations
  const [minLogDuration, setMinLogDurationState] = useState(60);
  const [minSubSessionDuration, setMinSubSessionDurationState] = useState(60);
  const [isAutostartEnabled, setIsAutostartEnabled] = useState(false);

  // Apply theme class and data attribute
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Load configuration settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        let url = await invoke<string>("get_db_setting", { key: "ollama_url" });
        if (url === "disabled") {
          setOllamaUrl("");
        } else if (url && url !== "false" && url.trim() !== "") {
          url = url.trim();
          if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "http://" + url;
          }
          setOllamaUrl(url);
        } else {
          setOllamaUrl("http://localhost:11434");
        }

        const model = await invoke<string>("get_db_setting", { key: "ollama_model" });
        if (model === "disabled") {
          setOllamaModel("");
        } else if (model && model !== "false" && model.trim() !== "") {
          setOllamaModel(model);
        } else {
          setOllamaModel("llama3.2");
        }

        const minLogDurationStr = await invoke<string>("get_db_setting", { key: "min_log_duration" });
        if (minLogDurationStr && minLogDurationStr !== "false" && minLogDurationStr.trim() !== "") {
          const parsed = parseInt(minLogDurationStr, 10);
          if (!isNaN(parsed)) setMinLogDurationState(Math.max(60, parsed));
        }

        const minSubSessionDurationStr = await invoke<string>("get_db_setting", { key: "min_sub_session_duration" });
        if (minSubSessionDurationStr && minSubSessionDurationStr !== "false" && minSubSessionDurationStr.trim() !== "") {
          const parsed = parseInt(minSubSessionDurationStr, 10);
          if (!isNaN(parsed)) setMinSubSessionDurationState(Math.max(0, parsed));
        }

        try {
          const autostartActive = await isAutostartActive();
          setIsAutostartEnabled(autostartActive);
        } catch (autostartErr) {
          console.error("Autostart plugin error:", autostartErr);
        }

        const active = await invoke<boolean>("is_tracking_active");
        setTrackingActive(active);
      } catch (e) {
        console.error("Failed to load settings:", e);
      }
    };
    loadSettings();

    // Subscribe to system tray status updates
    const unlistenIncognito = listen<boolean>("incognito-changed", (event) => {
      setIsIncognito(event.payload);
    });
    const unlistenTracking = listen<boolean>("tracking-changed", (event) => {
      setTrackingActive(event.payload);
    });

    return () => {
      unlistenIncognito.then(fn => fn());
      unlistenTracking.then(fn => fn());
    };
  }, []);

  const updateMinLogDuration = async (duration: number) => {
    const clamped = Math.max(60, duration);
    setMinLogDurationState(clamped);
    try {
      await invoke("set_db_setting", { key: "min_log_duration", value: String(clamped) });
    } catch (e) {
      console.error("Failed to save min_log_duration setting:", e);
    }
  };

  const updateMinSubSessionDuration = async (duration: number) => {
    const clamped = Math.max(0, duration);
    setMinSubSessionDurationState(clamped);
    try {
      await invoke("set_db_setting", { key: "min_sub_session_duration", value: String(clamped) });
    } catch (e) {
      console.error("Failed to save min_sub_session_duration setting:", e);
    }
  };

  const toggleAutostart = async () => {
    const nextState = !isAutostartEnabled;
    setIsAutostartEnabled(nextState);
    try {
      if (nextState) {
        await enableAutostart();
        // auto-launch 0.5.0 writes the Registry Run value without quoting the exe
        // path, which causes silent launch failure when the path contains spaces.
        // This rewrites the entry with a properly quoted path.
        try {
          await invoke("fix_autostart_registry_path");
        } catch (fixErr) {
          console.error("Failed to fix autostart registry path quoting:", fixErr);
        }
      } else {
        await disableAutostart();
      }
    } catch (e) {
      console.error("Failed to toggle autostart registry:", e);
      setIsAutostartEnabled(!nextState);
      throw e;
    }
  };

  const updateOllamaUrl = async (url: string) => {
    let sanitizedUrl = url.trim();
    if (sanitizedUrl === "" || sanitizedUrl === "false" || sanitizedUrl === "null" || sanitizedUrl === "disabled") {
      sanitizedUrl = "disabled";
    } else if (!sanitizedUrl.startsWith("http://") && !sanitizedUrl.startsWith("https://")) {
      sanitizedUrl = "http://" + sanitizedUrl;
    }
    setOllamaUrl(sanitizedUrl === "disabled" ? "" : sanitizedUrl);
    try {
      await invoke("set_db_setting", { key: "ollama_url", value: sanitizedUrl });
    } catch (e) {
      console.error(e);
    }
  };

  const updateOllamaModel = async (model: string) => {
    const sanitizedModel = model.trim() === "" || model.trim() === "false" || model.trim() === "null" || model.trim() === "disabled" ? "disabled" : model.trim();
    setOllamaModel(model);
    try {
      await invoke("set_db_setting", { key: "ollama_model", value: sanitizedModel });
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleIncognito = async () => {
    try {
      const newState = await invoke<boolean>("toggle_incognito");
      setIsIncognito(newState);
    } catch (e) {
      console.error("Failed to toggle incognito:", e);
    }
  };

  const handleToggleTracking = async () => {
    try {
      const newState = await invoke<boolean>("toggle_tracking");
      setTrackingActive(newState);
    } catch (e) {
      console.error("Failed to toggle tracking:", e);
    }
  };

  return {
    theme,
    setTheme,
    isIncognito,
    setIsIncognito,
    trackingActive,
    setTrackingActive,
    showSettings,
    setShowSettings,
    ollamaUrl,
    ollamaModel,
    updateOllamaUrl,
    updateOllamaModel,
    minLogDuration,
    updateMinLogDuration,
    minSubSessionDuration,
    updateMinSubSessionDuration,
    isAutostartEnabled,
    toggleAutostart,
    handleToggleIncognito,
    handleToggleTracking,
  };
}
