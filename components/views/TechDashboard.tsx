'use client';

import React, { useEffect, useState } from 'react';
import { PedidoOS, TabPath } from '@/lib/types';
import { pendingCount, isOnline } from '@/lib/offline/reportSync';

interface TechDashboardProps {
  currentUser: string;
  pedidosOS: PedidoOS[];
  onNavigateToTab: (tab: TabPath) => void;
  onNewOSClick: () => void;
}

const STATUS_TONE: Record<PedidoOS['status'], string> = {
  ABERTA: 'bg-blue-100 text-blue-700',
  'EM ANDAMENTO': 'bg-indigo-100 text-indigo-700',
  CONCLUIDA: 'bg-emerald-100 text-emerald-700',
  ATRASADA: 'bg-red-100 text-red-700',
};

export const TechDashboard: React.FC<TechDashboardProps> = ({ currentUser, pedidosOS, onNavigateToTab, onNewOSClick }) => {
  const [online, setOnline] = useState(true);
  const [pend, setPend] = useState(0);

  useEffect(() => {
    setOnline(isOnline());
    pendingCount().then(setPend).catch(() => {});
    const on = () => { setOnline(true); pendingCount().then(setPend).catch(() => {}); };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  // "Minhas OS" — atribuídas ao técnico e ainda não concluídas.
  const minhas = pedidosOS.filter((o) => o.status !== 'CONCLUIDA' && (!currentUser || o.technicianName === currentUser));
  const lista = (minhas.length > 0 ? minhas : pedidosOS.filter((o) => o.status !== 'CONCLUIDA')).slice(0, 6);

  return (
    <div className="flex flex-col w-full p-4 md:p-6 gap-4 max-w-2xl mx-auto">
      {/* Saudação + status de sincronização */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-bold text-slate-900 truncate">{saudacao}, {currentUser || 'técnico'} 👋</p>
          <p className="text-[11px] text-slate-500 capitalize">{hoje}</p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
            online ? (pend > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200') : 'bg-slate-100 text-slate-500 border border-slate-200'
          }`}
          title={online ? (pend > 0 ? `${pend} relatório(s) aguardando envio` : 'Tudo sincronizado') : 'Sem conexão — dados salvos no aparelho'}
        >
          <span className="material-symbols-outlined text-sm">{online ? (pend > 0 ? 'cloud_upload' : 'cloud_done') : 'cloud_off'}</span>
          {online ? (pend > 0 ? `${pend} p/ enviar` : 'Sincronizado') : 'Offline'}
        </span>
      </div>

      {/* Ação primária gigante — Bater Ponto */}
      <button
        onClick={() => onNavigateToTab('ponto')}
        className="w-full min-h-[88px] rounded-2xl bg-[#1A1A72] hover:bg-[#12124f] text-white shadow-lg flex items-center justify-center gap-3 transition-colors"
      >
        <span className="material-symbols-outlined text-4xl">fingerprint</span>
        <span className="text-xl font-bold uppercase tracking-wide">Bater Ponto</span>
      </button>

      {/* Atalhos */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onNavigateToTab('relatorios')}
          className="min-h-[80px] rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-1 text-[#E63946] hover:border-[#E63946] transition-colors"
        >
          <span className="material-symbols-outlined text-3xl">assignment</span>
          <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Novo Relatório</span>
        </button>
        <button
          onClick={onNewOSClick}
          className="min-h-[80px] rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-1 text-[#1A1A72] hover:border-[#1A1A72] transition-colors"
        >
          <span className="material-symbols-outlined text-3xl">add_task</span>
          <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Nova OS</span>
        </button>
      </div>

      {/* Agenda / minhas OS */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Minhas ordens de serviço</p>
          <button onClick={() => onNavigateToTab('agenda')} className="text-[11px] font-semibold text-[#1A1A72] hover:underline uppercase">
            Ver agenda
          </button>
        </div>
        {lista.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-200 py-10 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300">event_available</span>
            <p className="mt-1 text-sm font-bold text-slate-500 uppercase tracking-wider">Sem OS abertas</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Nada pendente para você agora.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {lista.map((o) => (
              <button
                key={o.id}
                onClick={() => onNavigateToTab('relatorios')}
                className="text-left bg-white rounded-xl border border-slate-200 shadow-sm p-3 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-data-mono text-[11px] font-bold text-slate-500">{o.id}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {o.priority === 'CRITICA' && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-red-100 text-red-700">Crítica</span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${STATUS_TONE[o.status]}`}>{o.status}</span>
                  </div>
                </div>
                <p className="font-bold text-slate-900 text-sm truncate mt-1">{o.title}</p>
                <p className="text-[11px] text-slate-500 truncate">{o.clientName} · {o.type}{o.scheduledDate ? ` · ${o.scheduledDate}` : ''}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
