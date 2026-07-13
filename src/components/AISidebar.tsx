import React from "react";
import {
  ShieldAlert, Sparkles, Send, Trash2, MessageSquare, ArrowRight, Info
} from "lucide-react";
import type { ChatMessage } from "../types";
import { ProductivityDashboard } from "./ProductivityDashboard";
import type { ProductivityMetrics } from "../services/analytics";

interface AISidebarProps {
  // Metrics
  metrics: ProductivityMetrics;

  // Incognito
  isIncognito: boolean;

  // Period
  getPeriodLabel: () => string;

  // Reflection
  aiReflection: string;
  aiLoading: boolean;
  generateAIReflection: () => void;

  // Chat
  activeAiTab: "reflection" | "chat";
  setActiveAiTab: (tab: "reflection" | "chat") => void;
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
}

export const AISidebar: React.FC<AISidebarProps> = ({
  metrics,
  isIncognito,
  getPeriodLabel,
  aiReflection,
  aiLoading,
  generateAIReflection,
  activeAiTab,
  setActiveAiTab,
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
}) => {
  return (
    <div className="glass rounded-2xl p-6 border border-[var(--border-color)] flex flex-col gap-4 text-left flex-1 overflow-hidden min-h-0">
      {/* Analytics Dashboard */}
      <ProductivityDashboard metrics={metrics} />

      {/* Header with Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
        <div className="flex items-center gap-2">
          {activeAiTab === "reflection" ? (
            <Sparkles className="w-5 h-5 text-violet-400" />
          ) : (
            <MessageSquare className="w-5 h-5 text-violet-400" />
          )}
          <div className="flex items-center gap-2">
            {activeAiTab === "chat" && (
              <>
                <span className="text-[10px] bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/30 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider shadow-sm">
                  {getPeriodLabel()}
                </span>
                <div 
                  className="flex items-center"
                  title="Note: Context is limited to your 50 most recent focus and tab events to ensure fast, stable local AI performance."
                >
                  <Info className="w-4 h-4 text-[var(--text-muted)] hover:text-violet-500 transition-colors cursor-help" />
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Tabs Toggle buttons */}
        <div className="flex bg-[var(--bg-color)]/60 dark:bg-zinc-800/40 p-0.5 rounded-lg border border-[var(--border-color)] text-xs">
          <button
            onClick={() => setActiveAiTab("reflection")}
            className={`px-2.5 py-1 font-semibold rounded-md transition-all cursor-pointer ${
              activeAiTab === "reflection"
                ? "bg-violet-600 text-white shadow"
                : "text-[var(--text-muted)] hover:text-[var(--text-color)]"
            }`}
          >
            Reflect
          </button>
          <button
            onClick={() => setActiveAiTab("chat")}
            className={`px-2.5 py-1 font-semibold rounded-md transition-all cursor-pointer ${
              activeAiTab === "chat"
                ? "bg-violet-600 text-white shadow"
                : "text-[var(--text-muted)] hover:text-[var(--text-color)]"
            }`}
          >
            Chat
          </button>
        </div>
      </div>

      {activeAiTab === "reflection" ? (
        /* Reflection Tab Content */
        <div className="flex flex-col gap-4 flex-1">
          <div className="p-4 rounded-xl bg-[var(--bg-color)]/30 border border-[var(--border-color)] text-sm leading-relaxed text-[var(--text-color)] min-h-[150px] flex items-center justify-center flex-1">
            {aiLoading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-[var(--text-muted)]">Querying local AI...</span>
              </div>
            ) : aiReflection ? (
              <p className="italic font-medium">"{aiReflection}"</p>
            ) : (
              <p className="text-[var(--text-muted)] text-center text-xs">
                Click reflect to compile your active log focus nodes into a local AI reflection.
              </p>
            )}
          </div>

          <button
            onClick={generateAIReflection}
            disabled={aiLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-violet-500/10"
          >
            <Sparkles className="w-4 h-4" />
            <span>Reflect with AI</span>
          </button>
        </div>
      ) : (
        /* Chat Tab Content */
        <div className="flex flex-col gap-3 flex-1 overflow-hidden min-h-0">

          {/* Warning banner for Incognito mode */}
          {isIncognito && (
            <div className="flex items-start gap-1.5 p-2 rounded-xl bg-amber-950/20 border border-amber-800/30 text-amber-500 text-[10px] leading-tight">
              <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>
                Incognito Mode active. Chat history is temporary and will self-destruct if you switch dates, switch tabs, or close the app.
              </span>
            </div>
          )}

          {/* Messages list */}
          <div 
            id="chat-messages-container"
            className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0 scrollbar-thin"
          >
            {(isIncognito ? volatileChatHistory : chatMessages).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <MessageSquare className="w-8 h-8 text-[var(--text-muted)] opacity-30 mb-2" />
                <p className="text-xs text-[var(--text-muted)] mb-3">
                  Ask anything about your focus logs or productivity today!
                </p>
                
                {/* Suggestion Pills */}
                <div className="flex flex-col gap-3 w-full max-w-[280px] mt-4 items-center">
                  {chatSuggestions.length > 0 ? (
                    <div className="flex flex-col gap-2 w-full">
                      {chatSuggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          disabled={chatLoading}
                          onClick={() => {
                            setChatInput(suggestion);
                            handleSendChat(suggestion);
                          }}
                          className="text-left px-3 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)]/40 hover:border-violet-500/40 hover:bg-violet-500/10 transition-all text-xs text-[var(--text-color)] group flex items-center justify-between cursor-pointer shadow-sm disabled:opacity-50"
                        >
                          <span className="pr-2 leading-tight">{suggestion}</span>
                          <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-violet-500 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 w-full items-center">
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {["Summarize my day", "Where did I waste time?", "How was my focus?"].map((pillText) => (
                          <button
                            key={pillText}
                            disabled={chatLoading || loadingSuggestions}
                            onClick={() => handleSendChat(pillText)}
                            className="text-[10px] px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-color)]/20 hover:bg-zinc-500/10 hover:text-[var(--text-color)] text-[var(--text-muted)] font-medium transition-all cursor-pointer disabled:opacity-50"
                          >
                            {pillText}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={handleGenerateSuggestions}
                        disabled={chatLoading || loadingSuggestions}
                        className={`flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg border transition-all shadow-sm ${
                          loadingSuggestions
                            ? "border-zinc-500/30 bg-zinc-500/10 text-zinc-500 cursor-not-allowed"
                            : "border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 font-semibold cursor-pointer shadow-violet-500/5"
                        }`}
                      >
                        {loadingSuggestions ? (
                          <>
                            <div className="w-3 h-3 border border-zinc-500 border-t-transparent rounded-full animate-spin" />
                            Analyzing activity...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" />
                            Generate AI Suggestions
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                {(isIncognito ? volatileChatHistory : chatMessages).map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col max-w-[85%] ${
                      msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                    }`}
                  >
                    <div
                      className={`p-3 rounded-2xl text-xs leading-normal font-medium shadow-sm ${
                        msg.role === "user"
                          ? "bg-violet-600 text-white rounded-tr-none"
                          : "bg-[var(--bg-color)]/40 border border-[var(--border-color)] text-[var(--text-color)] rounded-tl-none"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    <span className="text-[8px] text-[var(--text-muted)] font-mono mt-1 px-1">
                      {msg.role === "user" ? "You" : "AI"}
                    </span>
                  </div>
                ))}
                
                {/* Typing Indicator Bubble */}
                {chatLoading && (
                  <div className="flex flex-col max-w-[85%] mr-auto items-start">
                    <div className="p-3.5 rounded-2xl text-xs leading-normal font-medium shadow-sm bg-[var(--bg-color)]/40 border border-[var(--border-color)] text-[var(--text-color)] rounded-tl-none flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                      <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                      <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                    </div>
                    <span className="text-[8px] text-[var(--text-muted)] font-mono mt-1 px-1">
                      AI is thinking...
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Chat input box */}
          <div className="flex gap-2 items-center border-t border-[var(--border-color)] pt-3 mt-auto">
            <button
              onClick={clearChat}
              disabled={chatLoading}
              title="Clear Chat History"
              className="p-2.5 rounded-xl border border-[var(--border-color)] hover:bg-red-500/10 hover:border-red-500/30 text-[var(--text-muted)] hover:text-red-500 cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !chatLoading && chatInput.trim()) {
                  handleSendChat();
                }
              }}
              disabled={chatLoading}
              placeholder={chatLoading ? "AI is typing..." : "Ask AI..."}
              className="flex-1 bg-[var(--bg-color)]/50 border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-color)] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 disabled:opacity-50"
            />
            <button
              onClick={() => handleSendChat()}
              disabled={chatLoading || !chatInput.trim()}
              className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-violet-500/10"
            >
              {chatLoading ? (
                <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
