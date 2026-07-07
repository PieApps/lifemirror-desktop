import { ResumeContextResponse } from "../types/resume";
import { open } from "@tauri-apps/plugin-shell";

interface Props {
  context: ResumeContextResponse;
  projectName: string;
  onClose: () => void;
}

export const ResumeContextCard = ({ context, projectName, onClose }: Props) => {
  const handleOpenPath = async (path: string) => {
    try {
      // In a real app, this might use a custom rust command to open in VS Code specifically,
      // but tauri's shell open usually opens default associated app or folder.
      await open(path);
    } catch (e) {
      console.error("Failed to open path:", e);
    }
  };

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-8 max-w-5xl w-full mx-auto shadow-2xl overflow-y-auto max-h-[90vh]">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600">
              Resume Context
            </h1>
            <span className="px-3 py-1 bg-[var(--border-color)] rounded-full text-xs font-medium">
              {projectName}
            </span>
          </div>
          <p className="text-[var(--text-muted)] text-sm flex items-center space-x-2">
            <span>Branch: <code className="bg-[var(--border-color)] px-1.5 py-0.5 rounded text-xs">{context.branch}</code></span>
            <span>•</span>
            <span>Est. {context.time_to_resume} to flow</span>
          </p>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-[var(--border-color)] rounded-full transition-colors"
        >
          <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column (Primary Focus) */}
        <div className="md:col-span-7 space-y-6">
          {/* Current Status */}
          <div className="bg-[var(--bg-color)] rounded-lg p-5 border border-[var(--border-color)]">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3 flex items-center">
              <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
              Current Status
            </h2>
            <p className="text-[var(--text-color)] text-lg leading-relaxed mb-4">
              {context.status}
            </p>
            <div className="w-full bg-[var(--border-color)] rounded-full h-2 mb-1">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${context.progress}%` }}></div>
            </div>
            <div className="text-right text-xs text-[var(--text-muted)]">{context.progress}% Complete</div>
          </div>

          {/* Next Task */}
          <div className="bg-indigo-500/10 rounded-lg p-5 border border-indigo-500/20">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-indigo-500 mb-3 flex items-center justify-between">
              <div className="flex items-center">
                <span className="w-2 h-2 rounded-full bg-indigo-500 mr-2"></span>
                Next Suggested Task
              </div>
              <span className="text-xs bg-indigo-500/20 px-2 py-1 rounded text-indigo-400">
                {context.confidence}% Confidence
              </span>
            </h2>
            <p className="text-[var(--text-color)] text-xl font-medium mb-2">
              {context.next_task}
            </p>
          </div>

          {/* Summary */}
          <div className="bg-[var(--bg-color)] rounded-lg p-5 border border-[var(--border-color)]">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Session Summary
            </h2>
            <p className="text-[var(--text-color)] whitespace-pre-wrap">
              {context.summary}
            </p>
          </div>
        </div>

        {/* Right Column (Contextual details) */}
        <div className="md:col-span-5 space-y-6">
          {/* Blockers */}
          {context.blockers && context.blockers.length > 0 && (
            <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/20">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-red-500 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Blockers & Risks
              </h2>
              <ul className="list-disc list-inside text-[var(--text-color)] text-sm space-y-1">
                {context.blockers.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Files */}
          <div className="bg-[var(--bg-color)] rounded-lg p-4 border border-[var(--border-color)]">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Recent Files
            </h2>
            <div className="space-y-2">
              {context.files?.map((f, i) => (
                <button 
                  key={i} 
                  onClick={() => handleOpenPath(f)}
                  className="w-full text-left flex items-center p-2 hover:bg-[var(--border-color)] rounded transition-colors group"
                >
                  <svg className="w-4 h-4 mr-3 text-[var(--text-muted)] group-hover:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm font-mono truncate text-[var(--text-color)]">{f.split('/').pop() || f}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Documentation */}
          <div className="bg-[var(--bg-color)] rounded-lg p-4 border border-[var(--border-color)]">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Documentation
            </h2>
            <div className="space-y-2">
              {context.documentation?.map((d, i) => (
                <button 
                  key={i}
                  onClick={() => handleOpenPath(d)} 
                  className="w-full text-left flex items-center p-2 hover:bg-[var(--border-color)] rounded transition-colors group"
                >
                  <svg className="w-4 h-4 mr-3 text-[var(--text-muted)] group-hover:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  <span className="text-sm truncate text-[var(--text-color)] hover:underline">{d}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          {context.journal && context.journal.length > 0 && (
            <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/20">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-yellow-600 mb-2">
                Journal Notes
              </h2>
              <ul className="text-sm text-[var(--text-color)] space-y-2">
                {context.journal.map((n, i) => (
                  <li key={i} className="pl-3 border-l-2 border-yellow-500/50 italic">{n}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
