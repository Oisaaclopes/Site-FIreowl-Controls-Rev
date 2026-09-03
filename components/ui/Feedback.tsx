'use client';
import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';

type Variant = 'success' | 'error' | 'info';
export type ConfirmOptions = { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean; action?: () => void | Promise<void> };
export type PromptOptions = { title: string; message?: string; initialValue?: string; label?: string; confirmLabel?: string };
type Dialog = (ConfirmOptions & { kind: 'confirm'; resolve: (v: boolean) => void }) | (PromptOptions & { kind: 'prompt'; resolve: (v: string | null) => void });
type Context = { toast: Record<Variant, (m: string) => void>; confirm: (o: ConfirmOptions) => Promise<boolean>; prompt: (o: PromptOptions) => Promise<string | null> };
const Ctx = createContext<Context | null>(null);
let toastHandler: ((m: string, v: Variant) => void) | null = null;
let confirmHandler: Context['confirm'] | null = null;
let promptHandler: Context['prompt'] | null = null;

export function showToast(message: string, variant?: Variant) {
  const inferred = variant || (/não foi|falha|erro|inválid|não pôde|não possui/i.test(message) ? 'error' : /sucesso|concluíd|salv[oa]|cadastrad[oa]|criad[oa]|aplicad[oa]/i.test(message) ? 'success' : 'info');
  toastHandler?.(message, inferred);
}
export function requestConfirm(options: ConfirmOptions | string) {
  if (!confirmHandler) return Promise.resolve(false);
  if (typeof options !== 'string') return confirmHandler(options);
  const text = options.replace(/\n+/g, ' ').trim();
  const danger = /excluir|remover|apagar|cancelar|descartar/i.test(text);
  const title = text.match(/^(.+?[?!.])(?:\s|$)/)?.[1] || (danger ? 'Confirmar ação destrutiva?' : 'Continuar com esta ação?');
  return confirmHandler({ title, message: text === title ? undefined : text.slice(title.length).trim(), danger, confirmLabel: danger ? (/remover/i.test(title) ? 'Remover' : /cancelar/i.test(title) ? 'Cancelar fornecimento' : 'Excluir') : 'Continuar' });
}
export function requestText(options: PromptOptions | string, initialValue = '') {
  if (!promptHandler) return Promise.resolve(null);
  return promptHandler(typeof options === 'string' ? { title: options.replace(/:$/, ''), initialValue, label: 'Texto' } : options);
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Array<{ id: number; variant: Variant; message: string }>>([]);
  const [dialog, setDialog] = useState<Dialog | null>(null); const [input, setInput] = useState(''); const [busy, setBusy] = useState(false);
  const seq = useRef(0), panel = useRef<HTMLDivElement>(null), cancel = useRef<HTMLButtonElement>(null), field = useRef<HTMLInputElement>(null), opener = useRef<HTMLElement | null>(null);
  const titleId = useId(), descId = useId();
  const push = useCallback((message: string, variant: Variant) => { const id = ++seq.current; setToasts(p => [...p, { id, variant, message }]); window.setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3600); }, []);
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>(resolve => { opener.current = document.activeElement as HTMLElement; setDialog({ ...o, kind: 'confirm', resolve }); }), []);
  const prompt = useCallback((o: PromptOptions) => new Promise<string | null>(resolve => { opener.current = document.activeElement as HTMLElement; setInput(o.initialValue || ''); setDialog({ ...o, kind: 'prompt', resolve }); }), []);
  const close = useCallback((value: boolean | string | null) => { if (!dialog || busy) return; dialog.kind === 'confirm' ? dialog.resolve(Boolean(value)) : dialog.resolve(typeof value === 'string' ? value : null); setDialog(null); requestAnimationFrame(() => opener.current?.focus()); }, [busy, dialog]);
  const accept = async () => { if (!dialog || busy) return; if (dialog.kind === 'prompt') return close(input.trim() || null); if (!dialog.action) return close(true); setBusy(true); try { await dialog.action(); dialog.resolve(true); setDialog(null); requestAnimationFrame(() => opener.current?.focus()); } finally { setBusy(false); } };
  useEffect(() => { toastHandler = push; confirmHandler = confirm; promptHandler = prompt; return () => { toastHandler = null; confirmHandler = null; promptHandler = null; }; }, [confirm, prompt, push]);
  useEffect(() => { if (!dialog) return; (dialog.kind === 'prompt' ? field.current : cancel.current)?.focus(); const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) { e.preventDefault(); close(null); } if (e.key === 'Enter' && dialog.kind === 'confirm') e.preventDefault(); if (e.key !== 'Tab' || !panel.current) return; const n = [...panel.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled])')]; if (e.shiftKey && document.activeElement === n[0]) { e.preventDefault(); n.at(-1)?.focus(); } else if (!e.shiftKey && document.activeElement === n.at(-1)) { e.preventDefault(); n[0]?.focus(); } }; document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key); }, [busy, close, dialog]);
  const toast = useMemo(() => ({ success: (m: string) => push(m, 'success'), error: (m: string) => push(m, 'error'), info: (m: string) => push(m, 'info') }), [push]);
  const value = useMemo(() => ({ toast, confirm, prompt }), [confirm, prompt, toast]);
  return <Ctx.Provider value={value}>{children}
    <div aria-live="polite" className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-3 left-3 sm:left-auto sm:right-4 z-[100] flex sm:w-[calc(100vw-2rem)] sm:max-w-sm flex-col gap-2 pointer-events-none">{toasts.map(t => <div key={t.id} role={t.variant === 'error' ? 'alert' : 'status'} className={`pointer-events-auto flex items-center gap-2 rounded-xl border border-border border-l-4 bg-surface px-4 py-3 text-sm font-semibold text-fg shadow-pop ${t.variant === 'error' ? 'border-l-danger' : t.variant === 'success' ? 'border-l-success' : 'border-l-primary'}`}><span className="flex-1 min-w-0 break-words">{t.message}</span><button aria-label="Fechar notificação" className="shrink-0 text-fg-muted hover:text-fg text-lg leading-none" onClick={() => setToasts(p => p.filter(x => x.id !== t.id))}>×</button></div>)}</div>
    {dialog && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-navy/70 p-4 backdrop-blur-sm" onMouseDown={e => { if (e.target === e.currentTarget && !busy) close(null); }}><div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={dialog.message ? descId : undefined} className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-pop"><div className="overflow-y-auto px-5 pb-5 pt-6 sm:px-6"><h2 id={titleId} className="font-display text-lg font-bold text-fg">{dialog.title}</h2>{dialog.message && <p id={descId} className="mt-2 whitespace-pre-line text-sm leading-relaxed text-fg-secondary">{dialog.message}</p>}{dialog.kind === 'prompt' && <label className="mt-4 block text-xs font-semibold text-fg-secondary">{dialog.label || 'Texto'}<input ref={field} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void accept(); } }} className="mt-1.5 w-full rounded-lg border border-border bg-surface text-fg px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" /></label>}</div><div className="flex flex-col-reverse gap-2 border-t border-border bg-surface-2 px-5 py-3 sm:flex-row sm:justify-end sm:px-6"><button ref={cancel} disabled={busy} onClick={() => close(null)} className="rounded-lg px-4 py-2.5 text-xs font-semibold uppercase text-fg-secondary hover:bg-surface-3 sm:py-2">Cancelar</button><button disabled={busy || (dialog.kind === 'prompt' && !input.trim())} onClick={() => void accept()} className={`min-w-28 rounded-lg px-5 py-2.5 text-xs font-semibold uppercase text-white transition-colors disabled:opacity-60 sm:py-2 ${dialog.kind === 'confirm' && dialog.danger ? 'bg-danger hover:bg-danger-hover' : 'bg-primary hover:bg-primary-hover'}`}>{busy ? 'Processando…' : dialog.kind === 'confirm' ? dialog.confirmLabel || 'Confirmar' : dialog.confirmLabel || 'Continuar'}</button></div></div></div>}
  </Ctx.Provider>;
}
export function useToast() { const c = useContext(Ctx); if (!c) throw new Error('useToast precisa de <FeedbackProvider>'); return c.toast; }
export function useConfirm() { const c = useContext(Ctx); if (!c) throw new Error('useConfirm precisa de <FeedbackProvider>'); return c.confirm; }
export function usePrompt() { const c = useContext(Ctx); if (!c) throw new Error('usePrompt precisa de <FeedbackProvider>'); return c.prompt; }
