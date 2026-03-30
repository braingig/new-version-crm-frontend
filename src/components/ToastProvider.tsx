'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export type ToastOptions = {
  id?: string;
  title?: string;
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastInternal = Required<Pick<ToastOptions, 'id' | 'message' | 'variant' | 'durationMs'>> &
  Pick<ToastOptions, 'title'>;

type ToastContextValue = {
  showToast: (opts: ToastOptions) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function variantClasses(variant: ToastVariant) {
  switch (variant) {
    case 'success':
      return 'border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-900/20 dark:text-green-100';
    case 'error':
      return 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-100';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100';
    case 'info':
    default:
      return 'border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastInternal[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const showToast = useCallback(
    (opts: ToastOptions) => {
      const id =
        opts.id ??
        (typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

      const toast: ToastInternal = {
        id,
        title: opts.title,
        message: opts.message,
        variant: opts.variant ?? 'info',
        durationMs: opts.durationMs ?? 3500,
      };

      setToasts((prev) => {
        const next = [toast, ...prev];
        return next.slice(0, 4);
      });

      if (toast.durationMs > 0) {
        window.setTimeout(() => dismissToast(id), toast.durationMs);
      }

      return id;
    },
    [dismissToast],
  );

  const value = useMemo(() => ({ showToast, dismissToast, clearToasts }), [showToast, dismissToast, clearToasts]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-xl border shadow-lg px-4 py-3 ${variantClasses(t.variant ?? 'info')}`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {t.title && (
                  <div className="text-sm font-semibold leading-5">
                    {t.title}
                  </div>
                )}
                <div className="text-sm leading-5 break-words">{t.message}</div>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="rounded-md p-1 text-gray-600 hover:bg-black/5 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Dismiss"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

