import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ActivityNode, SubSessionEvent, ChatMessage, DailySummary } from "../types";

// ─── Helpers ────────────────────────────────────────────────

export const formatDurationForAI = (seconds: number) => {
  if (seconds < 60) return `${Math.floor(seconds)} seconds`;
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) {
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `${hrs}h ${remainingMins}m` : `${hrs}h`;
  }
  return `${mins}m`;
};

// ─── Hook ───────────────────────────────────────────────────

interface UseLocalAIOptions {
  aiUrl: string;
  aiModel: string;
  isIncognito: boolean;
  selectedDate: string;
  viewMode: "daily" | "weekly" | "monthly";

  // Data sources for context
  activities: ActivityNode[];
  subSessionEvents: SubSessionEvent[];
  weeklySummaries: DailySummary[];
  monthlySummaries: DailySummary[];

  // Chat message state managed in useActivityData
  chatMessages: ChatMessage[];
  setChatMessages: (msgs: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;

  // Period label for chat context banner
  getPeriodLabel: () => string;
}

export function useLocalAI({
  aiUrl,
  aiModel,
  isIncognito,
  selectedDate,
  viewMode,
  activities,
  subSessionEvents,
  weeklySummaries,
  monthlySummaries,
  chatMessages,
  setChatMessages,
}: UseLocalAIOptions) {
  const [aiReflection, setAiReflection] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [activeAiTab, setActiveAiTab] = useState<"reflection" | "chat">("reflection");
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSuggestions, setChatSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [volatileChatHistory, setVolatileChatHistory] = useState<ChatMessage[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load saved reflection on mount
  const loadReflection = async () => {
    try {
      const reflection = await invoke<string>("get_db_setting", { key: "last_ai_reflection" });
      if (reflection && reflection !== "false") setAiReflection(reflection);
    } catch (e) {
      console.error("Failed to load reflection:", e);
    }
  };

  // ─── Context Rollup ────────────────────────────────────

  const compileContextRollup = (): string => {
    if (viewMode === "daily") {
      if (activities.length === 0) {
        return "No activity logs recorded for this day.";
      }

      const appDurations: Record<string, number> = {};
      activities.forEach((node) => {
        appDurations[node.app_name] = (appDurations[node.app_name] || 0) + node.duration;
      });

      const topApps = Object.entries(appDurations)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([app, duration]) => `- ${app}: ${formatDurationForAI(duration)}`)
        .join("\n");

      const chronologicalFocus = [...activities].slice(0, 50).reverse();
      const recentFocus = chronologicalFocus
        .map((node) => {
          const time = new Date(node.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const noteText = node.notes ? ` (User Journal: "${node.notes}")` : "";
          return `[${time}] ${node.app_name} (${formatDurationForAI(node.duration)}) - "${node.window_title}"${noteText}`;
        })
        .join("\n");
        
      const chronologicalSubSessions = [...subSessionEvents].slice(0, 50).reverse();
      const recentSubSessions = chronologicalSubSessions.length > 0 
        ? "\n\nDetailed Browser Tab Switching Events:\n" + chronologicalSubSessions
            .map((e) => {
              const noteText = e.metadata ? ` (Context: ${e.metadata})` : "";
              return `[${new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] Switch to tab: "${e.title}" (${e.context_tag || 'Unknown domain'})${noteText}`;
            })
            .join("\n")
        : "";

      return `Selected Date: ${selectedDate}\n\nTop Applications by Duration:\n${topApps}\n\nChronological Focus Transitions:\n${recentFocus}${recentSubSessions}`;
    } else if (viewMode === "weekly") {
      if (weeklySummaries.length === 0) {
        return "No activity summary recorded for this week.";
      }
      const appDurations: Record<string, number> = {};
      weeklySummaries.forEach((sum) => {
        appDurations[sum.app_name] = (appDurations[sum.app_name] || 0) + sum.total_duration;
      });
      const topApps = Object.entries(appDurations)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([app, duration]) => `- ${app}: ${formatDurationForAI(duration)}`)
        .join("\n");
        
      const dates = Array.from(new Set(weeklySummaries.map(s => s.date))).sort();
      const dailyBreakdown = dates.map(dateStr => {
        const daySums = weeklySummaries.filter(s => s.date === dateStr);
        const top5 = [...daySums].sort((a,b) => b.total_duration - a.total_duration).slice(0, 5);
        const total = daySums.reduce((acc, s) => acc + s.total_duration, 0);
        return `${dateStr} (Total Focus: ${formatDurationForAI(total)}):\n` + 
               top5.map(s => `  - ${s.app_name}: ${formatDurationForAI(s.total_duration)}`).join("\n");
      }).join("\n\n");
      
      return `Selected Period: Week of ${selectedDate}\n\nTop Applications This Week:\n${topApps}\n\nDaily Breakdown (To compute averages/trends):\n${dailyBreakdown}`;
    } else {
      if (monthlySummaries.length === 0) {
        return "No activity summary recorded for this month.";
      }
      const appDurations: Record<string, number> = {};
      monthlySummaries.forEach((sum) => {
        appDurations[sum.app_name] = (appDurations[sum.app_name] || 0) + sum.total_duration;
      });
      
      const uniqueDays = new Set(monthlySummaries.map(s => s.date)).size || 1;
      const topApps = Object.entries(appDurations)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([app, duration]) => `- ${app}: ${formatDurationForAI(duration)} (Daily Avg: ${formatDurationForAI(duration / uniqueDays)})`)
        .join("\n");
        
      return `Selected Period: Month of ${selectedDate.substring(0, 7)}\n\nTop Applications This Month:\n${topApps}`;
    }
  };

  const compileMessagesForAI = (history: ChatMessage[]): { role: string; content: string }[] => {
    const systemContent = `You are a helpful local productivity AI companion for the LifeMirror desktop application.
You have access to the user's activity log summary for the currently selected period.
Use these logs to answer user questions about their focus, time spent, or productivity if relevant. If they ask about unrelated topics, answer them normally.
Always be concise, supportive, and friendly.

${compileContextRollup()}`;

    const systemMessage = {
      role: "system",
      content: systemContent,
    };

    const slidingWindow = history.slice(-6).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    return [systemMessage, ...slidingWindow];
  };

  // ─── Reflection ────────────────────────────────────────

  const generateAIReflection = async () => {
    if (activities.length === 0) {
      setAiReflection("No activity nodes recorded to reflect on.");
      return;
    }

    if (!aiUrl || aiUrl === "false" || !aiModel || aiModel === "false") {
      setAiReflection("Local AI is disabled or the configuration is incomplete.");
      return;
    }

    setAiLoading(true);
    setAiReflection("");
    
    try {
      const summaryText = activities.slice(0, 10).map(node => 
        `- App: ${node.app_name}, Session Title: ${node.window_title}, Spent: ${formatDurationForAI(node.duration)}`
      ).join("\n");

      const prompt = `You are a personal productivity coach. Below is a log of my recent desktop focus events. Provide exactly 3 specific, data-driven insights about my productivity. Each must include a concrete number from the logs. Format: one short sentence per insight, each on its own line. Be direct and specific. Examples of good insights:
- "Chrome stole 41 minutes today."
- "61% of your distractions came from YouTube."
- "Your longest uninterrupted coding session was 52 minutes."
Do NOT write generic advice. Only reference what actually happened.

Logs:
${summaryText}

Insights (exactly 3 lines):`;

      const response = await fetch(`${aiUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: aiModel,
          prompt: prompt,
          stream: false
        })
      });

      if (!response.ok) {
        let errorMsg = `status ${response.status}`;
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errorMsg = errData.error;
          }
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setAiReflection(data.response || "No response received.");
    } catch (err: any) {
      console.error(err);
      setAiReflection(`Mindfulness engine failed: ${err.message || err}. Check that Local AI is running locally (${aiUrl}) and that you ran 'ollama pull ${aiModel}' first.`);
    } finally {
      setAiLoading(false);
    }
  };

  // ─── Chat ──────────────────────────────────────────────

  const scrollToBottom = () => {
    setTimeout(() => {
      const container = document.getElementById("chat-messages-container");
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 50);
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, volatileChatHistory]);

  const handleGenerateSuggestions = async () => {
    if (!aiUrl || aiUrl === "false" || !aiModel || aiModel === "false") return;
    setLoadingSuggestions(true);
    try {
      const suggestions = await invoke<string[]>("generate_chat_suggestions");
      setChatSuggestions(suggestions);
    } catch (e) {
      console.error("Failed to generate chat suggestions:", e);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    if (activeAiTab !== "chat") {
      setChatSuggestions([]);
    }
  }, [activeAiTab]);

  // Reset on date/incognito change
  useEffect(() => {
    abortControllerRef.current?.abort();
    setVolatileChatHistory([]);
    setChatInput("");
    setChatLoading(false);
  }, [selectedDate, isIncognito]);

  const handleSendChat = async (overrideText?: string) => {
    const startMsg = `[DEBUG Chat Flow] Starting chat request with overrideText: ${overrideText}, chatInput: ${chatInput}`;
    console.log(startMsg);
    invoke("log_debug", { msg: startMsg }).catch(console.error);

    const textToSend = (overrideText || chatInput).trim();
    if (!textToSend || chatLoading) {
      const skipMsg = "[DEBUG Chat Flow] Skipping request because text is empty or already loading.";
      console.log(skipMsg);
      invoke("log_debug", { msg: skipMsg }).catch(console.error);
      return;
    }

    if (!aiUrl || aiUrl === "false" || aiUrl === "disabled" || !aiModel || aiModel === "false" || aiModel === "disabled") {
      const skipMsg2 = `[DEBUG Chat Flow] Skipping request because Local AI is disabled or incomplete. URL: ${aiUrl}, Model: ${aiModel}`;
      console.log(skipMsg2);
      invoke("log_debug", { msg: skipMsg2 }).catch(console.error);
      const errMsg = "Local AI is disabled or configuration is incomplete.";
      if (isIncognito) {
        setVolatileChatHistory(prev => [
          ...prev, 
          { date: selectedDate, role: "user", content: textToSend, timestamp: new Date().toISOString() },
          { date: selectedDate, role: "assistant", content: errMsg, timestamp: new Date().toISOString() }
        ]);
      } else {
        setChatMessages(prev => [
          ...prev, 
          { date: selectedDate, role: "user", content: textToSend, timestamp: new Date().toISOString() },
          { date: selectedDate, role: "assistant", content: errMsg, timestamp: new Date().toISOString() }
        ]);
      }
      return;
    }

    const prepMsg = `[DEBUG Chat Flow] Preparing to send request. URL: ${aiUrl}, Model: ${aiModel}`;
    console.log(prepMsg);
    invoke("log_debug", { msg: prepMsg }).catch(console.error);
    setChatLoading(true);
    setChatInput("");
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    const timestamp = new Date().toISOString();
    let currentHistory: ChatMessage[] = [];

    if (isIncognito) {
      const updatedHistory: ChatMessage[] = [
        ...volatileChatHistory,
        { date: selectedDate, role: "user", content: textToSend, timestamp }
      ];
      setVolatileChatHistory([
        ...updatedHistory,
        { date: selectedDate, role: "assistant", content: "", timestamp: new Date().toISOString() }
      ]);
      currentHistory = updatedHistory;
    } else {
      try {
        await invoke("add_chat_message", { date: selectedDate, role: "user", content: textToSend });
        const history = await invoke<ChatMessage[]>("get_chat_history", { date: selectedDate });
        setChatMessages([
          ...history,
          { date: selectedDate, role: "assistant", content: "", timestamp: new Date().toISOString() }
        ]);
        currentHistory = history;
      } catch (err: any) {
        console.error(err);
        setChatLoading(false);
        return;
      }
    }

    scrollToBottom();

    try {
      console.log("[DEBUG Chat Flow] Compiling messages for context...");
      invoke("log_debug", { msg: "[DEBUG Chat Flow] Compiling messages for context..." }).catch(console.error);
      const systemContext = compileMessagesForAI(currentHistory);
      const ctxMsg = `[DEBUG Chat Flow] Context generated with ${systemContext.length} messages.`;
      console.log(ctxMsg);
      invoke("log_debug", { msg: ctxMsg }).catch(console.error);

      const fetchMsg = `[DEBUG Chat Flow] Executing fetch request to ${aiUrl}/api/chat`;
      console.log(fetchMsg);
      invoke("log_debug", { msg: fetchMsg }).catch(console.error);
      const response = await fetch(`${aiUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: aiModel,
          messages: systemContext,
          stream: true,
          options: {
            num_ctx: 4096
          }
        }),
        signal: abortControllerRef.current.signal,
      });

      const resMsg = `[DEBUG Chat Flow] Fetch response received. Status: ${response.status} ${response.statusText}`;
      console.log(resMsg);
      invoke("log_debug", { msg: resMsg }).catch(console.error);

      if (!response.ok) {
        let errorMsg = `HTTP status ${response.status}`;
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errorMsg = errData.error;
          }
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/html")) {
        throw new Error("Received HTML response. Ensure the Local AI URL is correct.");
      }

      if (!response.body) {
        console.error("[DEBUG Chat Flow] Response body is null.");
        invoke("log_debug", { msg: "[DEBUG Chat Flow] Error: Response body is null." }).catch(console.error);
        throw new Error("No response body received from Local AI server.");
      }

      console.log("[DEBUG Chat Flow] Starting to read response stream.");
      invoke("log_debug", { msg: "[DEBUG Chat Flow] Starting to read response stream." }).catch(console.error);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedResponse = "";
      let chunkCount = 0;

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          console.log("[DEBUG Chat Flow] Stream reading completed.");
          invoke("log_debug", { msg: "[DEBUG Chat Flow] Stream reading completed." }).catch(console.error);
          break;
        }

        chunkCount++;
        if (chunkCount === 1) {
          console.log("[DEBUG Chat Flow] First data chunk received from stream.");
          invoke("log_debug", { msg: "[DEBUG Chat Flow] First data chunk received from stream." }).catch(console.error);
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim() === "") continue;
          try {
            const parsed = JSON.parse(line);
            const textChunk = parsed.message?.content || "";
            accumulatedResponse += textChunk;

            if (isIncognito) {
              setVolatileChatHistory(prev => {
                const next = [...prev];
                if (next.length > 0) {
                  next[next.length - 1] = {
                    ...next[next.length - 1],
                    content: accumulatedResponse,
                  };
                }
                return next;
              });
            } else {
              setChatMessages(prev => {
                const next = [...prev];
                if (next.length > 0) {
                  next[next.length - 1] = {
                    ...next[next.length - 1],
                    content: accumulatedResponse,
                  };
                }
                return next;
              });
            }
          } catch (jsonErr) {
            console.warn("Failed to parse stream chunk:", jsonErr);
          }
        }
      }

      // Finalize non-incognito message in SQLite
      if (!isIncognito) {
        console.log("[DEBUG Chat Flow] Finalizing message to local database.");
        invoke("log_debug", { msg: "[DEBUG Chat Flow] Finalizing message to local database." }).catch(console.error);
        await invoke("add_chat_message", { date: selectedDate, role: "assistant", content: accumulatedResponse });
        const finalizedHistory = await invoke<ChatMessage[]>("get_chat_history", { date: selectedDate });
        setChatMessages(finalizedHistory);
      }
      console.log("[DEBUG Chat Flow] Chat request finished successfully.");
      invoke("log_debug", { msg: "[DEBUG Chat Flow] Chat request finished successfully." }).catch(console.error);
    } catch (err: any) {
      console.error("[DEBUG Chat Flow] Caught error during request:", err);
      invoke("log_debug", { msg: `[DEBUG Chat Flow] Caught error during request: ${err.message || err}` }).catch(console.error);
      if (err.name === "AbortError") {
        console.log("Chat stream request aborted.");
        return;
      }
      console.error(err);
      const errText = `Failed to get response: ${err.message || err}. Ensure Local AI is running at ${aiUrl} and '${aiModel}' model is pulled.`;
      
      if (isIncognito) {
        setVolatileChatHistory(prev => {
          const next = [...prev];
          if (next.length > 0) {
            next[next.length - 1] = {
              ...next[next.length - 1],
              content: errText,
            };
          }
          return next;
        });
      } else {
        setChatMessages(prev => {
          const next = [...prev];
          if (next.length > 0) {
            next[next.length - 1] = {
              ...next[next.length - 1],
              content: errText,
            };
          }
          return next;
        });
      }
    } finally {
      setChatLoading(false);
      abortControllerRef.current = null;
      scrollToBottom();
    }
  };

  const clearChat = async () => {
    abortControllerRef.current?.abort();
    setChatLoading(false);
    
    if (isIncognito) {
      setVolatileChatHistory([]);
    } else {
      try {
        await invoke("clear_chat_history", { date: selectedDate });
        setChatMessages([]);
      } catch (err) {
        console.error("Failed to clear chat history from database:", err);
      }
    }
  };

  return {
    // Reflection
    aiReflection,
    aiLoading,
    generateAIReflection,
    loadReflection,

    // Chat
    activeAiTab,
    setActiveAiTab,
    chatInput,
    setChatInput,
    chatLoading,
    chatSuggestions,
    loadingSuggestions,
    volatileChatHistory,
    handleSendChat,
    handleGenerateSuggestions,
    clearChat,

    // Context (exposed for potential reuse)
    compileContextRollup,
  };
}
