import React from 'react';
import { Check, Globe, ExternalLink, KeyRound, Gift, Users, Mail, RefreshCw } from 'lucide-react';

// ─── UPDATE THESE when you publish your Gumroad product ────────────────────────
// TODO: After publishing, replace with your final Gumroad product URL.
const GUMROAD_PRODUCT_URL = 'https://raviousprime.gumroad.com/l/lifemirror-desktop';
// Adding ?wanted=true skips the Gumroad overlay and goes straight to checkout.
const GUMROAD_BUY_URL = `${GUMROAD_PRODUCT_URL}?wanted=true`;

// TODO: Replace these demo placeholder values with real numbers once you have them.
//       e.g. { label: 'Licenses Sold', value: '1,200+' }
const DEMO_STATS = [
  { label: 'Licenses Sold', value: '—' },
  { label: 'Countries',     value: '—' },
  { label: 'Avg. Rating',   value: '—' },
];
// ───────────────────────────────────────────────────────────────────────────────

export const PricingSection: React.FC = () => {
  return (
    <section id="pricing" className="py-24 px-6 max-w-7xl mx-auto text-center border-t border-white/5">

      {/* Section Header */}
      <div className="mb-12">
        <span className="text-xs font-mono uppercase tracking-widest text-violet-400 font-semibold">
          Transparent Licensing
        </span>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-white mt-3 mb-4">
          Pay Once. Own Forever.
        </h2>
        <p className="text-gray-400 max-w-2xl mx-auto text-sm sm:text-base">
          No subscriptions. No cloud lock-in. No hidden monthly fees. Buy a perpetual license
          once and run LifeMirror Desktop completely offline on all your machines.
        </p>
      </div>

      {/* Demo Stats Row — fill in DEMO_STATS above when you have real numbers */}
      <div className="flex justify-center gap-12 mb-12">
        {DEMO_STATS.map(({ label, value }) => (
          <div key={label} className="text-center">
            <div className="text-2xl font-extrabold text-white">{value}</div>
            <div className="text-xs font-mono text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Pricing Glass Card */}
      <div className="max-w-xl mx-auto glass-card p-10 border-2 border-violet-500/40 relative overflow-hidden text-left shadow-2xl shadow-violet-500/10">

        {/* Badge */}
        <div className="absolute top-0 right-0 bg-gradient-to-l from-violet-600 to-indigo-600 text-white text-[11px] font-mono font-bold px-4 py-1.5 rounded-bl-xl uppercase tracking-wider">
          Perpetual License
        </div>

        {/* Price */}
        <div className="mb-8">
          <div className="text-xs font-mono text-violet-400 uppercase tracking-wider mb-2 font-semibold">
            One-Time Purchase
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-5xl font-extrabold text-white">$29</span>
            <span className="text-sm font-mono text-gray-400">/ lifetime</span>
          </div>
          <p className="text-xs text-gray-400">Install on all your personal computers. Free updates forever.</p>
        </div>

        {/* Included Feature List */}
        <div className="space-y-3.5 mb-6 border-t border-b border-white/10 py-6 text-sm text-gray-200">
          {[
            'Lifetime desktop app access (Windows, macOS, Linux)',
            '100% Offline SQLCipher encrypted local database',
            'Pluggable Local AI (Ollama) reflection engine',
            'Active Interdiction Shield & regex focus blocking',
            'Chrome Companion Extension & Native Host bridge',
            'One-click Incognito protocol & memory wipe',
            'All future updates included — no extra charge',
          ].map((feat) => (
            <div key={feat} className="flex items-center gap-3">
              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{feat}</span>
            </div>
          ))}
        </div>

        {/* PPP Note */}
        <div className="flex items-start gap-2.5 mb-6 bg-violet-500/8 border border-violet-500/20 rounded-xl px-4 py-3">
          <Globe className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400 leading-relaxed">
            <span className="text-violet-300 font-semibold">Purchasing Power Parity available.</span>{' '}
            If $29 is steep in your country, Gumroad automatically offers a local discount at
            checkout — no coupon code needed.{' '}
            <a
              href={GUMROAD_PRODUCT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 underline hover:text-violet-300 transition-colors"
            >
              Check your price →
            </a>
          </p>
        </div>

        {/* Post-purchase info grid */}
        {/* TODO: Update these details to match your Gumroad product configuration. */}
        <div className="grid grid-cols-2 gap-3 mb-8 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            {/* TODO: Confirm Gumroad delivers a receipt/key automatically */}
            <span>License receipt delivered instantly by Gumroad</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            {/* TODO: Update seat limit if your Gumroad product limits activations */}
            <span>Use on unlimited personal machines</span>
          </div>
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            <span>Free updates for the lifetime of the product</span>
          </div>
          <div className="flex items-center gap-2">
            <Gift className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            {/* TODO: Set your actual refund window in Gumroad product settings */}
            <span>30-day money-back guarantee</span>
          </div>
        </div>

        {/* Primary CTA — Gumroad */}
        <a
          href={GUMROAD_BUY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-4 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 text-white font-bold text-sm hover:from-violet-500 hover:to-cyan-500 shadow-xl shadow-violet-600/30 transition-all flex items-center justify-center gap-2 group"
        >
          <KeyRound className="w-4 h-4 group-hover:rotate-12 transition-transform" />
          <span>Get Perpetual Lifetime Access — $29</span>
          <ExternalLink className="w-3.5 h-3.5 opacity-60" />
        </a>

        {/* Gumroad attribution */}
        <p className="text-center text-[11px] text-gray-600 font-mono mt-3">
          Secure checkout powered by{' '}
          <a
            href="https://gumroad.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-400 transition-colors underline"
          >
            Gumroad
          </a>
          {' '}· VAT &amp; global taxes handled automatically
        </p>
      </div>
    </section>
  );
};
