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
    <div aria-live="polite" className="fixed bottom-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 pointer-events-none">{toasts.map(t => <div key={t.id} role={t.variant === 'error' ? 'alert' : 'status'} className={`pointer-events-auto flex items-center gap-2 rounded-lg border border-slate-200 border-l-4 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-lg ${t.variant === 'error' ? 'border-l-[#E63946]' : t.variant === 'success' ? 'border-l-emerald-500' : 'border-l-[#1A1A72]'}`}><span className="flex-1">{t.message}</span><button aria-label="Fechar notificação" onClick={() => setToasts(p => p.filter(x => x.id !== t.id))}>×</button></div>)}</div>
    {dialog && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#101036]/65 p-4 backdrop-blur-sm" onMouseDown={e => { if (e.target === e.currentTarget && !busy) close(null); }}><div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={dialog.message ? descId : undefined} className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="px-6 pb-5 pt-6"><h2 id={titleId} className="font-display text-lg font-bold text-slate-900">{dialog.title}</h2>{dialog.message && <p id={descId} className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{dialog.message}</p>}{dialog.kind === 'prompt' && <label className="mt-4 block text-xs font-semibold text-slate-700">{dialog.label || 'Texto'}<input ref={field} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void accept(); } }} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-[#1A1A72] focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/15" /></label>}</div><div className="flex justify-end gap-2 border-t bg-slate-50 px-6 py-3"><button ref={cancel} disabled={busy} onClick={() => close(null)} className="rounded-lg px-4 py-2 text-xs font-semibold uppercase text-slate-600 hover:bg-slate-200">Cancelar</button><button disabled={busy || (dialog.kind === 'prompt' && !input.trim())} onClick={() => void accept()} className={`min-w-28 rounded-lg px-5 py-2 text-xs font-semibold uppercase text-white disabled:opacity-60 ${dialog.kind === 'confirm' && dialog.danger ? 'bg-[#E63946] hover:bg-[#b62330]' : 'bg-[#1A1A72] hover:bg-[#12124f]'}`}>{busy ? 'Processando…' : dialog.kind === 'confirm' ? dialog.confirmLabel || 'Confirmar' : dialog.confirmLabel || 'Continuar'}</button></div></div></div>}
  </Ctx.Provider>;
}
export function useToast() { const c = useContext(Ctx); if (!c) throw new Error('useToast precisa de <FeedbackProvider>'); return c.toast; }
export function useConfirm() { const c = useContext(Ctx); if (!c) throw new Error('useConfirm precisa de <FeedbackProvider>'); return c.confirm; }
export function usePrompt() { const c = useContext(Ctx); if (!c) throw new Error('usePrompt precisa de <FeedbackProvider>'); return c.prompt; }
