import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ isOpen, title, message, onConfirm, onCancel }: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onCancel}
      />
      
      {/* Modal Box */}
      <div className="relative bg-[var(--bg-primary)] dark:bg-zinc-900 border border-[var(--border-color)] dark:border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-500" />
          </div>
          
          <h3 className="text-lg font-semibold text-[var(--text-color)] mb-2">
            {title}
          </h3>
          
          <p className="text-sm text-[var(--text-muted)] mb-6">
            {message}
          </p>
          
          <div className="flex items-center gap-3 w-full">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[var(--text-color)] bg-[var(--bg-color)] border border-[var(--border-color)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm();
                onCancel();
              }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-500/20 transition-colors cursor-pointer"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
