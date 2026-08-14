'use client';

import React, { useMemo, useState } from 'react';
import { Client, Pendencia, PendenciaStatus, UserRole } from '@/lib/types';
import { updatePendenciaStatus } from '@/lib/pendencias';

interface PendenciasBoardProps {
  pendencias: Pendencia[];
  clients: Client[];
  userRole: UserRole;
  onChanged: () => void;
}

const STATUS_ORDER: PendenciaStatus[] = ['aberta', 'orcada', 'aprovada', 'em_execucao', 'corrigida', 'cancelada', 'recusada_cliente'];
const STATUS_LABEL: Record<PendenciaStatus, string> = {
  aberta: 'Aberta',
  orcada: 'Orçada',
  aprovada: 'Aprovada',
  em_execucao: 'Em execução',
  corrigida: 'Corrigida',
  cancelada: 'Cancelada',
  recusada_cliente: 'Recusada',
};
const STATUS_COLOR: Record<PendenciaStatus, string> = {
  aberta: 'bg-red-100 text-red-700',
  orcada: 'bg-amber-100 text-amber-800',
  aprovada: 'bg-blue-100 text-blue-800',
  em_execucao: 'bg-indigo-100 text-indigo-800',
  corrigida: 'bg-emerald-100 text-emerald-800',
  cancelada: 'bg-slate-100 text-slate-600',
  recusada_cliente: 'bg-slate-100 text-slate-600',
};
const TERMINAIS: PendenciaStatus[] = ['corrigida', 'cancelada', 'recusada_cliente'];

export const PendenciasBoard: React.FC<PendenciasBoardProps> = ({ pendencias, clients, userRole, onChanged }) => {
  const podeEditar = userRole === 'ADMINISTRATIVO' || userRole === 'GESTOR';
  const [fStatus, setFStatus] = useState<string>('TODOS');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const clientName = (id?: string) => clients.find((c) => c.id === id)?.name || '—';

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return pendencias
      .filter((p) => (fStatus === 'TODOS' ? true : p.status === fStatus))
      .filter((p) => {
        if (!s) return true;
        return (
          (p.descricao || '').toLowerCase().includes(s) ||
          (p.grupo || '').toLowerCase().includes(s) ||
          clientName(p.clienteId).toLowerCase().includes(s)
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendencias, fStatus, search, clients]);

  const changeStatus = async (p: Pendencia, novo: PendenciaStatus) => {
    if (!podeEditar || novo === p.status) return;
    setBusyId(p.id);
    try {
      await updatePendenciaStatus(p.id, novo, TERMINAIS.includes(novo) ? { resolvidaEm: new Date().toISOString() } : undefined);
      onChanged();
    } catch (err) {
      console.error('Falha ao mudar status da pendência:', err);
      alert('Não foi possível alterar o status.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-72">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
          <input
            type="text"
            placeholder="Buscar por descrição, grupo ou cliente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {['TODOS', ...STATUS_ORDER].map((st) => (
            <button
              key={st}
              onClick={() => setFStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase whitespace-nowrap transition-colors ${
                fStatus === st ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'TODOS' ? 'Todas' : STATUS_LABEL[st as PendenciaStatus]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm py-16 text-center text-slate-400">
          <span className="material-symbols-outlined text-4xl text-slate-300">assignment_turned_in</span>
          <p className="mt-2 text-sm font-bold text-slate-500 uppercase tracking-wider">Nenhuma pendência</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 flex flex-col md:flex-row md:items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {p.grupo && <span className="text-[10px] font-bold text-[#E63946] uppercase">{p.grupo}</span>}
                  <span className="text-xs font-semibold text-slate-900 uppercase">{clientName(p.clienteId)}</span>
                  {podeEditar && p.criticidadeOperacional && (
                    <span className="text-[9px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded" title="Criticidade operacional (interno)">
                      C{p.criticidadeOperacional}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-700 truncate">{p.descricao}</p>
                <p className="text-[10px] text-slate-400">
                  {p.local ? `${p.local} · ` : ''}
                  {p.acaoRecomendada ? `${p.acaoRecomendada} · ` : ''}
                  {p.quantidade ? `${p.quantidade} ${p.unidade || ''}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_COLOR[p.status]}`}>
                  {STATUS_LABEL[p.status]}
                </span>
                {podeEditar && (
                  <select
                    value={p.status}
                    disabled={busyId === p.id}
                    onChange={(e) => changeStatus(p, e.target.value as PendenciaStatus)}
                    className="text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 bg-white disabled:opacity-50"
                    title="Alterar status"
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ))}
          <p className="text-xs text-slate-500 px-1 pt-1">{filtered.length} pendência(s)</p>
        </div>
      )}
    </div>
  );
};
