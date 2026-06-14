import React, { useState } from "react";
import { X, Save, MessageSquare } from "lucide-react";
import { ActivityNode } from "./SCurveTimeline";

interface JournalModalProps {
  activity: ActivityNode | null;
  onClose: () => void;
  onSave: (notes: string) => Promise<void>;
}

export const JournalModal: React.FC<JournalModalProps> = ({ activity, onClose, onSave }) => {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) return;

    setSaving(true);
    try {
      await onSave(notes);
      setNotes("");
      onClose();
    } catch (err) {
      console.error("Failed to save journal:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg glass rounded-2xl shadow-2xl border border-[var(--border-color)] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-violet-400" />
            <h3 className="text-lg font-semibold text-[var(--text-color)]">Write Reflection</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-zinc-500/10 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {activity && (
            <div className="mb-5 p-3 rounded-lg bg-[var(--bg-color)]/30 border border-[var(--border-color)] text-sm">
              <span className="text-xs text-violet-400 font-semibold block mb-1">
                Reflecting on: {activity.app_name}
              </span>
              <p className="text-[var(--text-color)] font-medium line-clamp-2">{activity.window_title}</p>
              {activity.url && (
                <p className="text-xs text-[var(--text-muted)] mt-1 truncate">{activity.url}</p>
              )}
            </div>
          )}

          <div className="mb-5">
            <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Journal Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you learn? What was distracting? Write down your reflections here..."
              rows={5}
              className="w-full bg-[var(--bg-color)]/50 border border-[var(--border-color)] rounded-xl p-3.5 text-sm text-[var(--text-color)] placeholder-[var(--text-muted)] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all resize-none"
              required
              autoFocus
            />
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-zinc-500/10 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !notes.trim()}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? "Saving..." : "Save Entry"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
