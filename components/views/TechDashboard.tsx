'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { TabPath, TimePunch, Client, OrdemServico } from '@/lib/types';
import { pendingCount, isOnline } from '@/lib/offline/reportSync';
import { fetchOrdensServico } from '@/lib/ordensServico';
import { nextPunchType, buildPunch, capturePunchPosition, PUNCH_LABEL, PUNCH_DONE } from '@/lib/pontoActions';
import { useToast } from '@/components/ui/Feedback';

interface TechDashboardProps {
  currentUser: string;
  /** UUID autenticado — usado para "Minhas OS" (nunca por nome/email). */
  currentUserId?: string;
  punches: TimePunch[];
  onAddPunch: (p: TimePunch) => void;
  clients: Client[];
  onNavigateToTab: (tab: TabPath) => void;
  onNewOSClick: () => void;
  /** Abre o wizard de Novo Atendimento (mesmo fluxo existente). */
  onNewAtendimento: () => void;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const hm = (at?: number) => (at ? `${pad2(new Date(at).getHours())}:${pad2(new Date(at).getMinutes())}` : '--');
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();
const NEXT_TONE: Record<string, string> = {
  ENTRADA: 'bg-emerald-600 hover:bg-emerald-700',
  PAUSA: 'bg-amber-500 hover:bg-amber-600',
  RETORNO: 'bg-[#1A1A72] hover:bg-[#12124f]',
  SAIDA: 'bg-[#E63946] hover:bg-[#a51515]',
};
const OS_TONE: Record<OrdemServico['status'], string> = {
  aberta: 'bg-slate-100 text-slate-700',
  agendada: 'bg-indigo-100 text-indigo-700',
  em_execucao: 'bg-amber-100 text-amber-700',
  concluida: 'bg-emerald-100 text-emerald-700',
  cancelada: 'bg-slate-100 text-slate-400',
};

export const TechDashboard: React.FC<TechDashboardProps> = ({
  currentUser,
  currentUserId,
  punches,
  onAddPunch,
  clients,
  onNavigateToTab,
  onNewOSClick,
  onNewAtendimento,
}) => {
  const toast = useToast();
  const [online, setOnline] = useState(true);
  const [pend, setPend] = useState(0);
  const [punching, setPunching] = useState(false);
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);

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

  useEffect(() => {
    // A RLS já restringe o TÉCNICO às OS dele; filtramos por UUID como reforço.
    fetchOrdensServico().then(setOrdens).catch(() => setOrdens([]));
  }, []);

  const now = new Date();
  const nowMs = now.getTime();
  const hora = now.getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const hoje = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  // Batidas de HOJE (para os marcos e a próxima ação).
  const todays = useMemo(
    () => punches.filter((p) => p.employeeName === currentUser && p.at && sameDay(p.at!, nowMs)),
    [punches, currentUser, nowMs]
  );
  const marco = (t: TimePunch['type']) => todays.find((p) => p.type === t)?.at;
  const nextT = nextPunchType(punches, currentUser, nowMs);

  const baterPonto = async () => {
    if (!nextT || punching) return;
    setPunching(true);
    try {
      const pos = await capturePunchPosition();
      onAddPunch(buildPunch(nextT, currentUser, pos || undefined));
      toast.success(`${PUNCH_DONE[nextT]}${pos ? '' : ' (sem GPS)'}`);
    } catch {
      toast.error('Não foi possível registrar o ponto.');
    } finally {
      setPunching(false);
    }
  };

  // Minhas OS — por UUID (tecnico_responsavel_id), abertas, próximas primeiro.
  const minhasOS = useMemo(
    () =>
      ordens
        .filter(
          (os) =>
            ['aberta', 'agendada', 'em_execucao'].includes(os.status) &&
            (!currentUserId || os.tecnicoResponsavelId === currentUserId)
        )
        .sort((a, b) => (a.dataPrevista || '').localeCompare(b.dataPrevista || ''))
        .slice(0, 5),
    [ordens, currentUserId]
  );
  const clientName = (id?: string) => clients.find((c) => c.id === id)?.name || 'Cliente';

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

      {/* Bater ponto INLINE — registra no próprio Dashboard (mesmo motor do Ponto) */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
        <div className="grid grid-cols-4 gap-2 mb-3">
          {(['ENTRADA', 'PAUSA', 'RETORNO', 'SAIDA'] as const).map((t, i) => (
            <div key={t} className="text-center">
              <p className="text-[9px] uppercase tracking-wider text-slate-400">{['Entrada', 'Almoço', 'Retorno', 'Saída'][i]}</p>
              <p className={`font-data-mono text-sm font-bold mt-0.5 ${marco(t) ? 'text-slate-900' : 'text-slate-300'}`}>{hm(marco(t))}</p>
            </div>
          ))}
        </div>
        <button
          onClick={baterPonto}
          disabled={!nextT || punching}
          className={`w-full min-h-[72px] rounded-xl text-white shadow-md flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-60 ${nextT ? NEXT_TONE[nextT] : 'bg-slate-400'}`}
        >
          <span className={`material-symbols-outlined text-3xl ${punching ? 'animate-spin' : ''}`}>{punching ? 'progress_activity' : nextT ? 'fingerprint' : 'task_alt'}</span>
          <span className="text-base font-bold uppercase tracking-wide">{punching ? 'Registrando…' : nextT ? PUNCH_LABEL[nextT] : 'Jornada encerrada'}</span>
        </button>
        <button onClick={() => onNavigateToTab('ponto')} className="mt-2 w-full text-[11px] font-semibold text-[#1A1A72] hover:underline uppercase">
          Abrir Ponto completo / Meu Espelho
        </button>
      </div>

      {/* Atalhos operacionais */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onNewAtendimento}
          className="min-h-[80px] rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-1 text-[#E63946] hover:border-[#E63946] transition-colors"
        >
          <span className="material-symbols-outlined text-3xl">assignment</span>
          <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Novo Atendimento</span>
        </button>
        <button
          onClick={onNewOSClick}
          className="min-h-[80px] rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-1 text-[#1A1A72] hover:border-[#1A1A72] transition-colors"
        >
          <span className="material-symbols-outlined text-3xl">add_task</span>
          <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Nova OS</span>
        </button>
      </div>

      {/* Mini-agenda — minhas próximas OS (por UUID, RLS já restringe) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Minhas próximas OS</p>
          <button onClick={() => onNavigateToTab('agenda')} className="text-[11px] font-semibold text-[#1A1A72] hover:underline uppercase">
            Ver agenda completa
          </button>
        </div>
        {minhasOS.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-200 py-10 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300">event_available</span>
            <p className="mt-1 text-sm font-bold text-slate-500 uppercase tracking-wider">Sem OS atribuídas</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Nada pendente para você agora.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {minhasOS.map((os) => (
              <button
                key={os.id}
                onClick={() => onNavigateToTab('pedidos')}
                className="text-left bg-white rounded-xl border border-slate-200 shadow-sm p-3 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-data-mono text-[11px] font-bold text-slate-500">{os.numero || os.id.slice(0, 8)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${OS_TONE[os.status]}`}>{os.status.replace('_', ' ')}</span>
                </div>
                <p className="font-bold text-slate-900 text-sm truncate mt-1">{clientName(os.clienteId)}</p>
                <p className="text-[11px] text-slate-500 truncate">
                  {os.tipo}{os.dataPrevista ? ` · ${new Date(os.dataPrevista).toLocaleDateString('pt-BR')}` : ''}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
