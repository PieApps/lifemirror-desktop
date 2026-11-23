import React from "react";
import {
  ShieldAlert, Sparkles, Send, Trash2, ArrowRight, Lock
} from "lucide-react";
import type { ChatMessage } from "../types";
import { ProductivityDashboard } from "./ProductivityDashboard";
import type { ProductivityMetrics } from "../services/analytics";

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

  return (
    <div className="glass rounded-2xl p-4 sm:p-6 border border-[var(--border-color)] flex flex-col gap-4 text-left flex-1 h-full overflow-hidden min-h-0">
      {/* Analytics Dashboard */}
      <ProductivityDashboard metrics={metrics} />

      {/* Header: The Flow Companion */}
      <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-bold text-[var(--text-color)]">Flow Companion</h3>
        </div>
        <div className="flex items-center gap-2">
          {!isAiAvailable ? (
            <button
              onClick={() => onAILockedClick?.("AI Engine")}
              className="text-[10px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
              title="AI Engine is offline (Click to view requirements)"
            >
              <Lock className="w-2.5 h-2.5" />
              <span>AI Offline</span>
            </button>
          ) : (
            <span className="text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/30 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider shadow-sm">
              {getPeriodLabel()}
            </span>
          )}
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
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center mb-2.5">
                  <Lock className="w-5 h-5 text-amber-500" />
                </div>
                <h4 className="text-xs font-bold text-[var(--text-color)] mb-1">AI Companion is Locked</h4>
                <p className="text-[11px] text-[var(--text-muted)] max-w-[260px] mb-3 leading-relaxed">
                  The Flow Companion requires an on-device Ollama model or cloud API to observe and converse about your day.
                </p>
                <button
                  onClick={() => onAILockedClick?.("AI Chat")}
                  className="text-xs px-3.5 py-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>How to unlock AI</span>
                </button>
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

        {/* Chat input box */}
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
            onClick={() => {
              if (!isAiAvailable && onAILockedClick) {
                onAILockedClick("AI Chat");
              }
            }}
            disabled={chatLoading}
            placeholder={
              !isAiAvailable
                ? "AI Engine is offline (click to configure)..."
                : chatLoading
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
            disabled={chatLoading || (isAiAvailable && !chatInput.trim())}
            aria-haspopup={!isAiAvailable ? "dialog" : undefined}
            className={`p-2.5 rounded-xl cursor-pointer transition-all shadow-md shrink-0 ${
              !isAiAvailable
                ? "border border-zinc-300 dark:border-zinc-700/50 bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400"
                : "bg-violet-600 hover:bg-violet-500 text-white shadow-violet-500/20 disabled:opacity-30 disabled:cursor-not-allowed"
            }`}
            title={!isAiAvailable ? "AI Chat is locked (Requires AI Engine)" : "Send inquiry"}
          >
            {!isAiAvailable ? (
              <Lock className="w-3.5 h-3.5" />
            ) : chatLoading ? (
              <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
