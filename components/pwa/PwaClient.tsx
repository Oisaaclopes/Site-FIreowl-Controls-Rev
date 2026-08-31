'use client';

import { useEffect, useState } from 'react';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;

/** Registro, instalação e atualização: nunca faz reload automático de formulário em andamento. */
export function PwaClient() {
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [updateWorker, setUpdateWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/service-worker.js').then((registration) => {
      const inspect = () => { if (registration.waiting && navigator.serviceWorker.controller) setUpdateWorker(registration.waiting); };
      inspect();
      registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', inspect));
    }).catch(() => {});
    const onPrompt = (event: Event) => { event.preventDefault(); if (!isStandalone() && !sessionStorage.getItem('fireowl-install-dismissed')) setInstallPrompt(event as InstallPrompt); };
    const onInstalled = () => { setInstallPrompt(null); setShowHelp(false); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  if (typeof window === 'undefined' || !location.pathname.startsWith('/funcionarios')) return null;
  const dismiss = () => { sessionStorage.setItem('fireowl-install-dismissed', '1'); setInstallPrompt(null); setShowHelp(false); };
  const install = async () => { if (!installPrompt) return; await installPrompt.prompt(); const choice = await installPrompt.userChoice; if (choice.outcome !== 'accepted') dismiss(); else setInstallPrompt(null); };
  const refresh = () => { updateWorker?.postMessage({ type: 'SKIP_WAITING' }); navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true }); };

  return <>
    {updateWorker && <div className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[100] mx-auto max-w-md rounded-xl border border-[#1A1A72]/20 bg-white p-3 shadow-xl"><p className="text-sm font-bold text-slate-900">Nova versão do Fireowl disponível</p><p className="mt-0.5 text-xs text-slate-500">Atualize quando não estiver preenchendo um formulário.</p><button onClick={refresh} className="mt-3 min-h-10 rounded-lg bg-[#1A1A72] px-4 text-xs font-bold uppercase text-white">Atualizar</button></div>}
    {installPrompt && <div className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[90] mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-3 shadow-xl"><p className="text-sm font-bold text-slate-900">Instale o Fireowl Guardian</p><p className="mt-0.5 text-xs text-slate-500">Acesse mais rápido e use recursos preparados para campo.</p><div className="mt-3 flex gap-2"><button onClick={install} className="min-h-10 rounded-lg bg-[#1A1A72] px-4 text-xs font-bold uppercase text-white">Instalar</button><button onClick={dismiss} className="min-h-10 rounded-lg px-3 text-xs font-bold uppercase text-slate-500">Agora não</button></div></div>}
    {!installPrompt && isIos() && !isStandalone() && !sessionStorage.getItem('fireowl-install-dismissed') && <button onClick={() => setShowHelp(true)} className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-3 z-[90] rounded-full bg-[#1A1A72] px-4 py-3 text-xs font-bold text-white shadow-lg">Instalar app</button>}
    {showHelp && <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/50 p-4"><div className="max-w-sm rounded-2xl bg-white p-5 shadow-xl"><h2 className="font-bold text-slate-900">Instalar no iPhone/iPad</h2><p className="mt-2 text-sm text-slate-600">No Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”.</p><button onClick={dismiss} className="mt-4 min-h-10 rounded-lg bg-[#1A1A72] px-4 text-xs font-bold uppercase text-white">Entendi</button></div></div>}
  </>;
}
