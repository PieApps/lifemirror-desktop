import React from 'react';
import { Lock, ShieldCheck, Cpu, HardDrive } from 'lucide-react';

export const WhyLifeMirror: React.FC = () => {
  return (
    <section className="py-20 px-6 max-w-7xl mx-auto border-t border-b border-white/5">
      <div className="max-w-3xl mx-auto text-center mb-16">
        <span className="text-xs font-mono uppercase tracking-widest text-violet-400 font-semibold">
          Why LifeMirror Exists
        </span>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-white mt-3 mb-6">
          Your Digital Footprint Belongs to You.
        </h2>
        <p className="text-gray-400 text-base sm:text-lg leading-relaxed">
          Cloud trackers record every window title, document name, and website URL onto remote cloud servers. LifeMirror Desktop was engineered from the ground up on a fundamental guarantee: zero network sockets, zero cloud servers, and complete local encryption.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="glass-card p-8 text-left relative overflow-hidden group">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-6 text-violet-400 group-hover:scale-110 transition-transform">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-white mb-3">100% SQLCipher Encrypted</h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            Your daily computer logs are stored strictly inside a local SQLite database protected by page-level OpenSSL SQLCipher encryption (`rusqlite`).
          </p>
        </div>

        <div className="glass-card p-8 text-left relative overflow-hidden group">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-6 text-cyan-400 group-hover:scale-110 transition-transform">
            <Cpu className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-white mb-3">Optional Local AI (Ollama)</h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            Optionally plug in Ollama (`http://localhost:11434`) for daily AI reflections & interactive Q&A on your GPU/CPU. Zero cloud LLM API calls.
          </p>
        </div>

        <div className="glass-card p-8 text-left relative overflow-hidden group">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6 text-emerald-400 group-hover:scale-110 transition-transform">
            <HardDrive className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-white mb-3">Native Stdio Bridge</h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            Browser tab sync operates over Chrome's Native Messaging API stdio pipe. No local HTTP servers or listening network ports exposed.
          </p>
        </div>
      </div>
    </section>
  );
};
