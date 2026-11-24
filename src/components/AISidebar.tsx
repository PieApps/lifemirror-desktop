import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ShieldAlert, Sparkles, Send, Trash2, ArrowRight,
  BookOpen, Feather, CheckCheck, Compass
} from "lucide-react";
import type { ChatMessage } from "../types";
import { ProductivityDashboard } from "./ProductivityDashboard";
import type { ProductivityMetrics } from "../services/analytics";
import { formatDuration } from "../utils/formatDuration";
import { sound } from "../utils/sound";

interface AISidebarProps {
  metrics: ProductivityMetrics;
  isIncognito: boolean;
  getPeriodLabel: () => string;
  chatMessages: ChatMessage[];
  volatileChatHistory: ChatMessage[];
  chatInput: string;
  setChatInput: (v: string) => void;
  chatLoading: boolean;
  chatSuggestions: string[];
  loadingSuggestions: boolean;
  handleSendChat: (overrideText?: string) => void;
  handleGenerateSuggestions: () => void;
  clearChat: () => void;
  isAiAvailable?: boolean;
  onAILockedClick?: (featureName: string) => void;
}

export const AISidebar: React.FC<AISidebarProps> = ({
  metrics,
  isIncognito,
  getPeriodLabel,
  chatMessages,
  volatileChatHistory,
  chatInput,
  setChatInput,
  chatLoading,
  chatSuggestions,
  loadingSuggestions,
  handleSendChat,
  handleGenerateSuggestions,
  clearChat,
  isAiAvailable = true,
  onAILockedClick,
}) => {
  const activeMessages = isIncognito ? volatileChatHistory : chatMessages;

  const [reflectionText, setReflectionText] = useState("");
  const [isSavingReflection, setIsSavingReflection] = useState(false);
  const [reflectionSaved, setReflectionSaved] = useState(false);

  const handleSaveReflection = async () => {
    if (!reflectionText.trim()) return;
    setIsSavingReflection(true);
    try {
      await invoke("add_journal_entry", {
        entry: {
          timestamp: new Date().toISOString(),
          title: "Personal Reflection",
          content: reflectionText.trim(),
          tags: ["reflection", "daily-flow"],
        },
      });
      try {
        await invoke("compile_period_note", {
          periodType: "day",
          dateKey: new Date().toISOString().split("T")[0],
        });
      } catch {}
      sound.playIgniteFocus();
      setReflectionSaved(true);
      setReflectionText("");
      setTimeout(() => setReflectionSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save reflection to vault:", err);
    } finally {
      setIsSavingReflection(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-4 sm:p-6 border border-[var(--border-color)] flex flex-col gap-4 text-left flex-1 h-full overflow-hidden min-h-0">
      {/* Analytics Dashboard */}
      <ProductivityDashboard metrics={metrics} />

      {/* Header: The Flow Companion */}
      <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-bold text-[var(--text-color)]">
            {!isAiAvailable && activeMessages.length === 0 ? "Creative Flow Mirror" : "Flow Companion"}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/30 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider shadow-sm">
            {getPeriodLabel()}
          </span>
        </div>
      </div>

      {/* Main Conversation Body */}
      <div className="flex flex-col gap-3 flex-1 overflow-hidden min-h-0">
        {/* Warning banner for Incognito mode */}
        {isIncognito && (
          <div className="flex items-start gap-1.5 p-2 rounded-xl bg-amber-950/20 border border-amber-800/30 text-amber-500 text-[10px] leading-tight">
            <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              Incognito Mode active. Chat history is temporary and will self-destruct if you switch dates, tabs, or close the app.
            </span>
          </div>
        )}

        {/* Messages list */}
        <div
          id="chat-messages-container"
          className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0 scrollbar-thin"
        >
          {activeMessages.length === 0 ? (
            !isAiAvailable ? (
              <div className="flex-1 flex flex-col gap-3.5 py-1">
                {/* Creative Flow Rhythm Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-500/15 via-violet-500/5 to-transparent border border-violet-500/25 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-violet-400" />
                      <span>Flow Rhythm</span>
                    </span>
                    <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-lg">
                      {metrics.score}/100 {metrics.scoreLabel || "Purity"}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-color)] font-medium leading-relaxed">
                    {metrics.deepWorkTime > 0
                      ? `You've locked in ${formatDuration(metrics.deepWorkTime)} of deep craft today.`
                      : "Start a focused session to watch your daily rhythm take shape."}
                  </p>
                  {metrics.longestFocusBlock > 0 && (
                    <div className="text-[11px] text-[var(--text-muted)] flex items-center justify-between pt-1 border-t border-[var(--border-color)]/40 font-mono">
                      <span>Peak Flow Window</span>
                      <span className="text-[var(--text-color)] font-semibold">
                        {formatDuration(metrics.longestFocusBlock)} in {metrics.longestFocusApp}
                      </span>
                    </div>
                  )}
                </div>

                {/* Instant Journal Reflection */}
                <div className="p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)]/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Feather className="w-3.5 h-3.5" />
                      <span>Personal Reflection</span>
                    </span>
                    {reflectionSaved && (
                      <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 animate-in fade-in">
                        <CheckCheck className="w-3 h-3" />
                        <span>Saved to Vault</span>
                      </span>
                    )}
                  </div>
                  <textarea
                    placeholder="Inscribe a thought, insight, or achievement from today's craft..."
                    value={reflectionText}
                    onChange={(e) => setReflectionText(e.target.value)}
                    rows={3}
                    className="w-full text-xs bg-[var(--bg-color)]/60 border border-[var(--border-color)] rounded-xl p-3 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 resize-none font-serif text-[var(--text-color)] placeholder:text-[var(--text-muted)] leading-relaxed"
                  />
                  <button
                    onClick={handleSaveReflection}
                    disabled={!reflectionText.trim() || isSavingReflection}
                    className="w-full py-2 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isSavingReflection ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <BookOpen className="w-3.5 h-3.5" />
                    )}
                    <span>{isSavingReflection ? "Inscribing..." : "Save Reflection to Vault"}</span>
                  </button>
                </div>

                {/* Subtle Local AI Status Footer */}
                <div className="mt-auto pt-3 border-t border-[var(--border-color)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
                    <span>Local AI Offline</span>
                  </div>
                  <button
                    onClick={() => onAILockedClick?.("AI Engine")}
                    className="text-violet-400 hover:text-violet-300 font-semibold cursor-pointer hover:underline flex items-center gap-1"
                  >
                    <span>Connect Ollama</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/10 border border-violet-500/25 flex items-center justify-center mb-2 shadow-xs">
                  <Sparkles className="w-5 h-5 text-violet-400" />
                </div>
                <h4 className="text-xs font-bold text-[var(--text-color)] mb-1">Observant Biographer & Guide</h4>
                <p className="text-[11px] text-[var(--text-muted)] max-w-[260px] mb-3 leading-relaxed">
                  I observe the cadence of your deep craft. Ask me to synthesize achievements, analyze context switches, or draft updates.
                </p>

                {/* Suggestion Pills */}
                <div className="flex flex-col gap-2 w-full max-w-[290px] mt-2 items-center">
                  {chatSuggestions.length > 0 ? (
                    <div className="flex flex-col gap-1.5 w-full">
                      {chatSuggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          disabled={chatLoading}
                          onClick={() => {
                            setChatInput(suggestion);
                            handleSendChat(suggestion);
                          }}
                          className="text-left px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/40 hover:border-violet-500/40 hover:bg-violet-500/10 transition-all text-xs text-[var(--text-color)] group flex items-center justify-between cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          <span className="pr-2 leading-tight truncate">{suggestion}</span>
                          <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-violet-500 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5 w-full items-center">
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {[
                          "Synthesize my milestones today",
                          "What broke my focus?",
                          "Draft a standup update",
                          "Summarize research points",
                        ].map((pillText) => (
                          <button
                            key={pillText}
                            disabled={chatLoading || loadingSuggestions}
                            onClick={() => {
                              if (!isAiAvailable && onAILockedClick) {
                                onAILockedClick("AI Chat");
                              } else {
                                handleSendChat(pillText);
                              }
                            }}
                            className="text-[10px] px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-color)]/30 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-300 text-[var(--text-muted)] font-medium transition-all cursor-pointer disabled:opacity-50"
                          >
                            {pillText}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={!isAiAvailable && onAILockedClick ? () => onAILockedClick("AI Suggestions") : handleGenerateSuggestions}
                        disabled={chatLoading || loadingSuggestions}
                        aria-haspopup={!isAiAvailable ? "dialog" : undefined}
                        className={`flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg border transition-all shadow-xs ${
                          loadingSuggestions
                            ? "border-zinc-500/30 bg-zinc-500/10 text-zinc-500 cursor-not-allowed"
                            : !isAiAvailable
                            ? "border-zinc-300 dark:border-zinc-700/50 bg-zinc-100 dark:bg-zinc-800/40 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 font-semibold cursor-pointer"
                            : "border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 font-semibold cursor-pointer shadow-violet-500/5"
                        }`}
                        title={!isAiAvailable ? "Generate AI Suggestions (Locked - Requires AI Engine)" : "Generate suggestions from logs"}
                      >
                        {loadingSuggestions ? (
                          <>
                            <div className="w-3 h-3 border border-zinc-500 border-t-transparent rounded-full animate-spin" />
                            <span>Observing activity...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 text-violet-400" />
                            <span>Generate Activity Suggestions</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          ) : (
            <>
              {activeMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col max-w-[85%] ${
                    msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                  }`}
                >
                  <div
                    className={`p-3 rounded-2xl text-xs leading-normal font-medium shadow-sm ${
                      msg.role === "user"
                        ? "bg-violet-600 text-white rounded-tr-none shadow-violet-500/20"
                        : "bg-[var(--bg-color)]/60 border border-[var(--border-color)] text-[var(--text-color)] rounded-tl-none"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  <span className="text-[8px] text-[var(--text-muted)] font-mono mt-1 px-1">
                    {msg.role === "user" ? "You" : "Biographer"}
                  </span>
                </div>
              ))}

              {/* Typing Indicator Bubble */}
              {chatLoading && (
                <div className="flex flex-col max-w-[85%] mr-auto items-start">
                  <div className="p-3.5 rounded-2xl text-xs leading-normal font-medium shadow-sm bg-[var(--bg-color)]/60 border border-[var(--border-color)] text-[var(--text-color)] rounded-tl-none flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                    <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                    <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                  </div>
                  <span className="text-[8px] text-[var(--text-muted)] font-mono mt-1 px-1">
                    Biographer is observing...
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Chat input box (only when AI is available or chat history is active) */}
        {(isAiAvailable || activeMessages.length > 0) && (
          <div className="flex gap-2 items-center border-t border-[var(--border-color)] pt-3 mt-auto">
            {activeMessages.length > 0 && (
              <button
                onClick={clearChat}
                disabled={chatLoading}
                title="Clear Conversation"
                className="p-2.5 rounded-xl border border-[var(--border-color)] hover:bg-red-500/10 hover:border-red-500/30 text-[var(--text-muted)] hover:text-red-400 cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !chatLoading && chatInput.trim()) {
                  if (!isAiAvailable && onAILockedClick) {
                    onAILockedClick("AI Chat");
                  } else {
                    handleSendChat();
                  }
                }
              }}
              disabled={chatLoading}
              placeholder={
                chatLoading
                  ? "Companion is thinking..."
                  : "Ask companion about today's flow..."
              }
              className="flex-1 bg-[var(--bg-color)]/60 border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-color)] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 disabled:opacity-50"
            />
            <button
              onClick={() => {
                if (!isAiAvailable && onAILockedClick) {
                  onAILockedClick("AI Chat");
                } else {
                  handleSendChat();
                }
              }}
              disabled={chatLoading || (!isAiAvailable ? false : !chatInput.trim())}
              className="p-2.5 rounded-xl cursor-pointer transition-all shadow-md shrink-0 bg-violet-600 hover:bg-violet-500 text-white shadow-violet-500/20 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Send inquiry"
            >
              {chatLoading ? (
                <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
