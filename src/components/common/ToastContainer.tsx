import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useAppStore();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg transition-all ${
            t.type === 'success'
              ? 'border-emerald-200 dark:border-emerald-800 bg-white dark:bg-[#0D1B2E] text-slate-900 dark:text-slate-100'
              : t.type === 'error'
                ? 'border-rose-200 dark:border-rose-800 bg-white dark:bg-[#0D1B2E] text-slate-900 dark:text-slate-100'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] text-slate-900 dark:text-slate-100'
          }`}
        >
          {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />}
          {t.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />}
          {t.type === 'info' && <Info className="w-4 h-4 text-teal-600 dark:text-teal-400 mt-0.5 shrink-0" />}
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            type="button"
            onClick={() => dismissToast(t.id)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
