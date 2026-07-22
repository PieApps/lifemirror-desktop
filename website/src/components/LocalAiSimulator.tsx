import React, { useState, useEffect } from 'react';
import { MOCK_AI_REFLECTIONS } from '../data/demoData';
import { Bot, Terminal, Send, CheckCircle2, ChevronRight, Code, Sparkles } from 'lucide-react';

export const LocalAiSimulator: React.FC = () => {
  const [selectedPromptIndex, setSelectedPromptIndex] = useState<number | null>(null);
  const [displayedText, setDisplayedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPayloadInspector, setShowPayloadInspector] = useState(false);

  const startStreamingText = (fullText: string) => {
    setIsGenerating(true);
    setDisplayedText('');
    let index = 0;
    const interval = setInterval(() => {
      if (index < fullText.length) {
        setDisplayedText((prev) => prev + fullText.charAt(index));
        index++;
      } else {
        clearInterval(interval);
        setIsGenerating(false);
      }
    }, 20);
  };

  const handleGenerateSummary = () => {
    setSelectedPromptIndex(null);
    startStreamingText(MOCK_AI_REFLECTIONS.dailySummary);
  };

  const handleSelectChatQuery = (idx: number) => {
    setSelectedPromptIndex(idx);
    startStreamingText(MOCK_AI_REFLECTIONS.chatResponses[idx].response);
  };

  useEffect(() => {
    handleGenerateSummary();
  }, []);

  return (
    <section id="ai-experience" className="py-24 px-6 max-w-7xl mx-auto border-t border-white/5 text-center">
      <div className="mb-12">
        <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-semibold">
          Offline Intelligence
        </span>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-white mt-3 mb-4">
          Local AI Reflection Experience
        </h2>
        <p className="text-gray-400 max-w-2xl mx-auto text-sm sm:text-base mb-6">
          LifeMirror interfaces natively with Ollama running locally on your hardware (<code className="text-violet-400">http://localhost:11434</code>). Watch reflections stream live offline!
        </p>

        {/* Optional Callout Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono max-w-xl mx-auto">
          <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <span><strong>Completely Optional:</strong> LifeMirror works 100% standalone out of the box. Ollama is only required if you choose to enable automated AI reflections and local chat.</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
        {/* Sidebar Controls */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 mb-6 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Ollama Engine Connected</span>
            </div>

            <button
              onClick={handleGenerateSummary}
              disabled={isGenerating}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium text-xs mb-6 hover:from-violet-500 hover:to-indigo-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-600/25"
            >
              <Bot className="w-4 h-4" />
              <span>Compile Reflection Card</span>
            </button>

            <div className="text-xs font-mono text-gray-400 mb-3">Interactive Q&A Prompts:</div>
            <div className="space-y-2">
              {MOCK_AI_REFLECTIONS.chatResponses.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectChatQuery(idx)}
                  disabled={isGenerating}
                  className={`w-full text-left p-3 rounded-xl text-xs font-mono transition-all border ${
                    selectedPromptIndex === idx
                      ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
                      : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.query}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowPayloadInspector(!showPayloadInspector)}
            className="mt-6 flex items-center justify-between text-[11px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors pt-4 border-t border-white/10"
          >
            <span className="flex items-center gap-1.5">
              <Code className="w-3.5 h-3.5" />
              Payload Inspector
            </span>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showPayloadInspector ? 'rotate-90' : ''}`} />
          </button>
        </div>

        {/* Live Terminal Streaming View */}
        <div className="md:col-span-2 glass-card p-6 border border-violet-500/30 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
            <div className="flex items-center gap-2 font-mono text-xs text-gray-400">
              <Terminal className="w-4 h-4 text-violet-400" />
              <span>Ollama Local Stream (localhost:11434)</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/20 text-violet-300">
              Model: llama3.2
            </span>
          </div>

          <div className="flex-1 bg-black/60 rounded-xl p-5 border border-white/5 font-mono text-xs sm:text-sm leading-relaxed text-gray-200 min-h-[180px]">
            {displayedText}
            {isGenerating && <span className="inline-block w-2 h-4 bg-cyan-400 ml-1 animate-pulse" />}
          </div>

          {/* Expandable JSON Inspector */}
          {showPayloadInspector && (
            <div className="mt-4 p-4 rounded-xl bg-black/90 border border-cyan-500/30 text-[11px] font-mono text-cyan-300 overflow-x-auto">
              <div className="text-[10px] text-gray-400 mb-2">// Direct JSON POST payload sent to localhost:11434/api/generate</div>
              <pre>{JSON.stringify({
                model: "llama3.2",
                prompt: "Summarize today's focus metrics: 1.5h VS Code, 45m Chrome, 1 Shield deflection.",
                stream: true,
                options: { temperature: 0.2 }
              }, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
