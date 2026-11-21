import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ variant?: 'compact' | 'full' }> = ({ variant = 'compact' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={
          variant === 'full'
            ? 'inline-flex items-center justify-center gap-2 rounded-lg bg-[#0B1F3A] dark:bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-[#13325c] dark:hover:bg-teal-500 transition-colors whitespace-nowrap shrink-0'
            : 'inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D1B2E] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0'
        }
      >
        <Download className="w-4 h-4 text-teal-600 dark:text-teal-400" />
        <span>Install STOVRA App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D1B2E] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Smartphone className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Install STOVRA on iPhone / iPad</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                  aria-label="Close guide"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300 list-decimal list-inside">
                <li>Tap the <strong>Share</strong> button in Safari&apos;s toolbar.</li>
                <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                <li>Confirm by tapping <strong>Add</strong> in the top right.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-lg bg-[#0B1F3A] dark:bg-teal-600 py-2.5 text-sm font-medium text-white hover:opacity-95"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
