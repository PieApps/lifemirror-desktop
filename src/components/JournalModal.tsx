import React, { useState } from "react";
import { X, Save, MessageSquare } from "lucide-react";
import { ActivityNode, TimelineNode, formatCleanTitle, getGroupedSessionTitle } from "./SCurveTimeline";

interface JournalModalProps {
  activity: ActivityNode | TimelineNode | any | null;
  onClose: () => void;
  onSave: (notes: string, activityIds?: number[]) => Promise<void>;
}

export const JournalModal: React.FC<JournalModalProps> = ({ activity, onClose, onSave }) => {
  const [notes, setNotes] = useState(activity?.notes || "");
  const [saving, setSaving] = useState(false);

  const isMultiActivity = Boolean(
    activity &&
    'originalActivities' in activity &&
    Array.isArray(activity.originalActivities) &&
    activity.originalActivities.length > 1
  );

  const title = activity
    ? ('originalActivities' in activity ? getGroupedSessionTitle(activity) : activity.window_title)
    : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) return;

    setSaving(true);
    try {
      const ids: number[] | undefined = (activity && 'originalActivities' in activity && Array.isArray(activity.originalActivities) && activity.originalActivities.length > 0)
        ? activity.originalActivities.map((a: ActivityNode) => a.id).filter((id: any): id is number => typeof id === 'number' && !isNaN(id))
        : (activity?.id && typeof activity.id === 'number' ? [activity.id] : undefined);

      await onSave(notes, ids && ids.length > 0 ? ids : undefined);
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
            <h3 className="text-lg font-semibold text-[var(--text-color)]">
              {isMultiActivity ? "Reflect on Episode" : "Write Reflection"}
            </h3>
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
            <div className="mb-5 p-3.5 rounded-xl bg-[var(--bg-color)]/40 border border-[var(--border-color)] text-sm">
              <span className="text-xs text-violet-400 font-semibold block mb-1">
                {isMultiActivity
                  ? `Reflecting on: ${activity.app_name} (${activity.originalActivities.length} activities)`
                  : `Reflecting on: ${activity.app_name}`}
              </span>
              <p className="text-[var(--text-color)] font-medium line-clamp-2">{title}</p>
              {activity.url && (
                <p className="text-xs text-[var(--text-muted)] mt-1 truncate">{activity.url}</p>
              )}

              {/* Multi-activity pill strand */}
              {isMultiActivity && (
                <div className="flex flex-wrap gap-1 mt-2.5 pt-2 border-t border-[var(--border-color)]/60">
                  {activity.originalActivities.slice(0, 5).map((a: ActivityNode, idx: number) => {
                    const clean = formatCleanTitle(a.window_title, a.app_name, a.domain_tag, a.url);
                    return (
                      <span
                        key={a.id ?? idx}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[var(--text-muted)] border border-[var(--border-color)]/50 truncate max-w-[150px]"
                        title={a.window_title}
                      >
                        {clean}
                      </span>
                    );
                  })}
                  {activity.originalActivities.length > 5 && (
                    <span className="text-[10px] text-[var(--text-muted)] font-mono self-center px-1">
                      +{activity.originalActivities.length - 5} more
                    </span>
                  )}
                </div>
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
              placeholder="What did you accomplish in this flow? What key insights or hurdles emerged?"
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
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white transition-all cursor-pointer shadow-md shadow-violet-500/20"
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
