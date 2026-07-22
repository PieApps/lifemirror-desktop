import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, HelpCircleIcon } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
  category: 'Privacy' | 'Setup' | 'Features' | 'Licensing';
}

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs: FaqItem[] = [
    {
      category: 'Setup',
      question: 'Is Ollama or local AI mandatory to use LifeMirror Desktop?',
      answer: 'No! LifeMirror Desktop works 100% standalone right out of the box. All continuous OS focus tracking, serpentine S-Curve timeline visualization, browser session grouping, reflection notes, system tray controls, and regex focus shields work completely without Ollama. Ollama is strictly an optional enhancement if you choose to enable automated local AI summaries and offline chat.',
    },
    {
      category: 'Privacy',
      question: 'Does any of my activity data or browser history leave my computer?',
      answer: 'Zero bytes ever leave your host machine. LifeMirror Desktop operates under a strict zero-telemetry guarantee. Your activity logs are encrypted on your disk using page-level OpenSSL SQLCipher encryption (`rusqlite`). There are no external cloud servers, remote analytics hooks, or network tracking endpoints.',
    },
    {
      category: 'Privacy',
      question: 'How does Chrome browser tab tracking work without opening network ports?',
      answer: 'Unlike web tools that spin up unencrypted local HTTP servers or WebSockets, LifeMirror connects to Chrome via Chrome Native Messaging API over secure stdio stdin/stdout pipes. No listening network ports are exposed on your computer.',
    },
    {
      category: 'Licensing',
      question: 'Is LifeMirror Desktop a monthly subscription or a one-time purchase?',
      answer: 'LifeMirror Desktop is a perpetual one-time purchase ($29 lifetime access). Pay once and use it on all your personal computers (Windows, macOS, Linux) with lifetime updates included. No recurring monthly fees or cloud paywalls.',
    },
    {
      category: 'Features',
      question: 'What happens when I toggle Incognito Mode?',
      answer: 'Toggling Incognito Mode instantly wipes in-memory active session caches, displays a frosted glass lockout message, halts all database write transactions, and shifts AI chat routing to a volatile, non-saved memory array to guarantee complete privacy.',
    },
    {
      category: 'Features',
      question: 'How does Active Interdiction block distracting applications?',
      answer: 'Active Interdiction operates in two phases: Phase 1 uses a hyper-fast Regex Engine to match window titles against user-defined blacklists. Phase 2 asynchronously pings your optional local AI against your active goal (e.g. "Writing Rust Code"). When a distraction is detected, an always-on-top glassmorphic overlay blocks the window.',
    },
  ];

  const toggleFaq = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-24 px-6 max-w-7xl mx-auto border-t border-white/5 text-center">
      <div className="mb-16">
        <span className="text-xs font-mono uppercase tracking-widest text-violet-400 font-semibold">
          Frequently Asked Questions
        </span>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-white mt-3 mb-4">
          Everything You Need to Know
        </h2>
        <p className="text-gray-400 max-w-2xl mx-auto text-sm sm:text-base">
          Clear answers about local encryption, optional Ollama setup, native stdio bridges, and perpetual licensing.
        </p>
      </div>

      {/* Accordion Container */}
      <div className="max-w-3xl mx-auto space-y-4 text-left font-sans">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className={`glass-card p-6 border transition-all duration-300 ${
                isOpen ? 'border-violet-500/40 bg-violet-950/20' : 'border-white/10'
              }`}
            >
              <button
                onClick={() => toggleFaq(idx)}
                className="w-full flex items-center justify-between gap-4 text-left focus:outline-none"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 uppercase border border-violet-500/30">
                    {faq.category}
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                    {faq.question}
                  </h3>
                </div>
                {isOpen ? (
                  <ChevronUp className="w-5 h-5 text-violet-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
              </button>

              {isOpen && (
                <div className="mt-4 pt-4 border-t border-white/10 text-xs sm:text-sm text-gray-300 font-mono leading-relaxed animate-fadeIn">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
