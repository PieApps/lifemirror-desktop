import React from 'react';
import { Check, Shield, Lock, Download, Sparkles, KeyRound } from 'lucide-react';

export const PricingSection: React.FC = () => {
  return (
    <section id="pricing" className="py-24 px-6 max-w-7xl mx-auto text-center border-t border-white/5">
      <div className="mb-12">
        <span className="text-xs font-mono uppercase tracking-widest text-violet-400 font-semibold">
          Transparent Licensing
        </span>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-white mt-3 mb-4">
          Pay Once. Own Forever.
        </h2>
        <p className="text-gray-400 max-w-2xl mx-auto text-sm sm:text-base">
          No subscriptions. No cloud lock-in. No hidden monthly fees. Buy a perpetual license once and run LifeMirror Desktop completely offline on all your machines.
        </p>
      </div>

      {/* Pricing Glass Card */}
      <div className="max-w-xl mx-auto glass-card p-10 border-2 border-violet-500/40 relative overflow-hidden text-left shadow-2xl shadow-violet-500/10">
        <div className="absolute top-0 right-0 bg-gradient-to-l from-violet-600 to-indigo-600 text-white text-[11px] font-mono font-bold px-4 py-1.5 rounded-bl-xl uppercase tracking-wider">
          Perpetual License
        </div>

        <div className="mb-8">
          <div className="text-xs font-mono text-violet-400 uppercase tracking-wider mb-2 font-semibold">One-Time Purchase</div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-5xl font-extrabold text-white">$29</span>
            <span className="text-sm font-mono text-gray-400">/ lifetime</span>
          </div>
          <p className="text-xs text-gray-400">Install on all your personal computers. Free updates forever.</p>
        </div>

        {/* Included Feature List */}
        <div className="space-y-3.5 mb-8 border-t border-b border-white/10 py-6 text-sm text-gray-200">
          <div className="flex items-center gap-3">
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Lifetime desktop app access (Windows, macOS, Linux)</span>
          </div>
          <div className="flex items-center gap-3">
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>100% Offline SQLCipher encrypted local database</span>
          </div>
          <div className="flex items-center gap-3">
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Pluggable Local AI (Ollama) reflection engine</span>
          </div>
          <div className="flex items-center gap-3">
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Active Interdiction Shield & regex focus blocking</span>
          </div>
          <div className="flex items-center gap-3">
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Chrome Companion Extension & Native Host bridge</span>
          </div>
          <div className="flex items-center gap-3">
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>One-click Incognito protocol & memory wipe</span>
          </div>
        </div>

        {/* CTA Button */}
        <a
          href="#downloads"
          className="w-full py-4 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 text-white font-bold text-sm hover:from-violet-500 hover:to-cyan-500 shadow-xl shadow-violet-600/30 transition-all flex items-center justify-center gap-2 group"
        >
          <KeyRound className="w-4 h-4 group-hover:rotate-12 transition-transform" />
          <span>Get Perpetual Lifetime Access</span>
        </a>
      </div>
    </section>
  );
};
