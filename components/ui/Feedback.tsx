'use client';

// Infra de feedback do Fireowl Guardian: substitui window.confirm/alert nativos
// por um ConfirmDialog e Toasts internos, coerentes com o visual do sistema.
// Uso:
//   const toast = useToast();  toast.success('Salvo');  toast.error('Falhou');
//   const confirm = useConfirm();
//   if (await confirm({ title, message, confirmLabel, danger })) { ... }

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

type ToastVariant = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface FeedbackCtx {
  toast: {
    success: (m: string) => void;
    error: (m: string) => void;
    info: (m: string) => void;
  };
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const Ctx = createContext<FeedbackCtx | null>(null);

const VARIANT: Record<ToastVariant, { bar: string; icon: string; iconColor: string }> = {
  success: { bar: 'border-l-emerald-500', icon: 'check_circle', iconColor: 'text-emerald-500' },
  error: { bar: 'border-l-[#E63946]', icon: 'error', iconColor: 'text-[#E63946]' },
  info: { bar: 'border-l-[#1A1A72]', icon: 'info', iconColor: 'text-[#1A1A72]' },
};

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const nextId = useRef(1);

  const push = useCallback((variant: ToastVariant, message: string) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, variant, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3600);
  }, []);

  const toast = useMemo(
    () => ({
      success: (m: string) => push('success', m),
      error: (m: string) => push('error', m),
      info: (m: string) => push('info', m),
    }),
    [push]
  );

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setConfirmState({ ...opts, resolve })),
    []
  );

  const closeConfirm = (value: boolean) => {
    confirmState?.resolve(value);
    setConfirmState(null);
  };

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <Ctx.Provider value={value}>
      {children}

      {/* Toaster */}
      <div className="fixed bottom-4 right-4 z-[90] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none">
        {toasts.map((t) => {
          const v = VARIANT[t.variant];
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex items-center gap-2.5 bg-white border border-slate-200 border-l-4 ${v.bar} rounded-lg shadow-lg px-3.5 py-2.5 animate-[fadeIn_0.15s_ease-out]`}
            >
              <span className={`material-symbols-outlined text-lg ${v.iconColor}`}>{v.icon}</span>
              <span className="text-xs font-semibold text-slate-700 flex-1">{t.message}</span>
              <button
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="text-slate-300 hover:text-slate-500"
                aria-label="Fechar"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* ConfirmDialog */}
      {confirmState && (
        <div className="fixed inset-0 z-[95] bg-[#1A1A72]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 pt-5 pb-4">
              <div className="flex items-start gap-3">
                <span
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    confirmState.danger ? 'bg-red-50 text-[#E63946]' : 'bg-[#1A1A72]/10 text-[#1A1A72]'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">{confirmState.danger ? 'warning' : 'help'}</span>
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-base font-bold text-slate-900">{confirmState.title}</h3>
                  {confirmState.message && (
                    <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">{confirmState.message}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => closeConfirm(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                {confirmState.cancelLabel || 'Cancelar'}
              </button>
              <button
                onClick={() => closeConfirm(true)}
                className={`px-5 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider text-white transition-colors ${
                  confirmState.danger ? 'bg-[#E63946] hover:bg-[#a51515]' : 'bg-[#1A1A72] hover:bg-[#12124f]'
                }`}
              >
                {confirmState.confirmLabel || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
};

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast precisa de <FeedbackProvider>');
  return ctx.toast;
}

export function useConfirm() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useConfirm precisa de <FeedbackProvider>');
  return ctx.confirm;
}
