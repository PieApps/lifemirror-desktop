import React, { useState } from 'react';
import { Lock, EyeOff, ShieldCheck, Database, RefreshCw, Key } from 'lucide-react';

export const PrivacyInspector: React.FC = () => {
  const [isIncognito, setIsIncognito] = useState(false);

  return (
    <section id="privacy" className="py-24 px-6 max-w-7xl mx-auto border-t border-white/5 text-center">
      <div className="mb-12">
        <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-semibold">
          Zero-Cloud Architecture
        </span>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-white mt-3 mb-4">
          SQLCipher Encryption & Incognito Mode
        </h2>
        <p className="text-gray-400 max-w-2xl mx-auto text-sm sm:text-base">
          Every database write transaction is encrypted locally at the page level using SQLCipher. Toggle Incognito Mode to test instant in-memory session wipes!
        </p>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
        {/* Card 1: SQLCipher Page Encryption */}
        <div className="glass-card p-8 border border-white/10 relative overflow-hidden">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">SQLCipher AES-256</h3>
              <p className="text-xs text-gray-400 font-mono">Page-Level SQLite Encryption</p>
            </div>
          </div>

          <div className="bg-black/60 p-4 rounded-xl border border-white/5 font-mono text-xs text-gray-300 space-y-2 mb-6">
            <div className="flex items-center justify-between text-emerald-400">
              <span>PRAGMA key = "spk_99..."</span>
              <Key className="w-3.5 h-3.5" />
            </div>
            <div className="text-[11px] text-gray-500">// sqlite_master verification loop passed</div>
            <div className="p-2.5 rounded bg-emerald-950/30 border border-emerald-500/20 text-emerald-300 text-[11px]">
              🔒 Encrypted tables: activity_logs, journal_entries, settings, distraction_events
            </div>
          </div>
        </div>

        {/* Card 2: Incognito Mode Simulator */}
        <div className={`glass-card p-8 border transition-all duration-500 relative overflow-hidden ${
          isIncognito ? 'border-amber-500/50 bg-amber-950/20' : 'border-white/10'
        }`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                isIncognito ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-white/5 text-gray-400'
              }`}>
                <EyeOff className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Incognito Protocol</h3>
                <p className="text-xs text-gray-400 font-mono">
                  {isIncognito ? 'Logging Paused (Volatile Memory)' : 'Logging Active'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsIncognito(!isIncognito)}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all ${
                isIncognito
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {isIncognito ? 'Deactivate' : 'Activate Incognito'}
            </button>
          </div>

          <div className={`p-4 rounded-xl border font-mono text-xs leading-relaxed transition-all ${
            isIncognito
              ? 'bg-amber-950/40 border-amber-500/30 text-amber-200'
              : 'bg-black/60 border-white/5 text-gray-400'
          }`}>
            {isIncognito ? (
              <div>
                <div className="font-bold text-amber-400 mb-1">🥷 Incognito Active</div>
                <div>• In-memory active session cache wiped</div>
                <div>• Database write guardrail enforced</div>
                <div>• Volatile non-saved AI memory active</div>
              </div>
            ) : (
              <div>
                <div>• Continuous OS window tracking enabled</div>
                <div>• Session threshold: 60s minimum</div>
                <div>• Encrypted SQLite transactions active</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
