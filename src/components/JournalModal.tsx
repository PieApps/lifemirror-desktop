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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg glass rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-violet-400" />
            <h3 className="text-lg font-semibold text-gray-200">Write Reflection</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 hover:bg-zinc-800/50 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {activity && (
            <div className="mb-5 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 text-sm">
              <span className="text-xs text-violet-400 font-semibold block mb-1">
                Reflecting on: {activity.app_name}
              </span>
              <p className="text-gray-300 font-medium line-clamp-2">{activity.window_title}</p>
              {activity.url && (
                <p className="text-xs text-gray-500 mt-1 truncate">{activity.url}</p>
              )}
            </div>
          )}

          <div className="mb-5">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Journal Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you learn? What was distracting? Write down your reflections here..."
              rows={5}
              className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl p-3.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all resize-none"
              required
              autoFocus
            />
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-zinc-800/50 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !notes.trim()}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-medium bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800/30 disabled:text-gray-500 text-gray-100 transition-all cursor-pointer"
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
