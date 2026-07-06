import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useFocus() {
  const [activeIntention, setActiveIntention] = useState("");
  const [intentionInput, setIntentionInput] = useState("");

  const handleStartFocus = async () => {
    if (!intentionInput.trim()) return;
    try {
      await invoke("set_db_setting", { key: "active_intention", value: intentionInput.trim() });
      setActiveIntention(intentionInput.trim());
      setIntentionInput("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleStopFocus = async () => {
    try {
      await invoke("set_db_setting", { key: "active_intention", value: "false" });
      setActiveIntention("");
    } catch (err) {
      console.error(err);
    }
  };

  // Load persisted intention on mount
  const loadIntention = async () => {
    try {
      const intent = await invoke<string>("get_db_setting", { key: "active_intention" });
      if (intent && intent !== "false") {
        setActiveIntention(intent);
      }
    } catch (e) {
      console.error("Failed to load intention:", e);
    }
  };

  return {
    activeIntention,
    intentionInput,
    setIntentionInput,
    handleStartFocus,
    handleStopFocus,
    loadIntention,
  };
}
