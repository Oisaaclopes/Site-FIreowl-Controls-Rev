'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { TabPath, TimePunch, Client, OrdemServico } from '@/lib/types';
import { flushOutbox, pendingCount, isOnline } from '@/lib/offline/reportSync';
import { pendingFieldPhotoJobs } from '@/lib/offline/fieldPhotoSync';
import { fetchOrdensServico } from '@/lib/ordensServico';
import { nextPunchType, buildPunch, capturePunchPosition, PUNCH_LABEL, PUNCH_DONE } from '@/lib/pontoActions';
import { useToast } from '@/components/ui/Feedback';
import { QuickFieldPhotoModal } from '@/components/field-photos/QuickFieldPhotoModal';

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
  RETORNO: 'bg-navy hover:bg-navy-3',
  SAIDA: 'bg-danger hover:bg-danger-hover',
};
const OS_TONE: Record<OrdemServico['status'], string> = {
  aberta: 'bg-surface-3 text-fg-secondary',
  agendada: 'bg-indigo-100 text-indigo-700',
  em_execucao: 'bg-amber-100 text-amber-700',
  concluida: 'bg-emerald-100 text-emerald-700',
  cancelada: 'bg-surface-3 text-fg-muted',
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
  const [quickPhotoOpen, setQuickPhotoOpen] = useState(false);

  const refreshPending = React.useCallback(() => {
    void Promise.all([pendingCount(), pendingFieldPhotoJobs()]).then(([reports, photos]) => setPend(reports + photos)).catch(() => {});
  }, []);

  useEffect(() => {
    setOnline(isOnline());
    refreshPending();
    const on = () => { setOnline(true); void flushOutbox().finally(refreshPending); };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [refreshPending]);

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
          <p className="text-lg font-bold text-fg truncate">{saudacao}, {currentUser || 'técnico'} 👋</p>
          <p className="text-[11px] text-fg-secondary capitalize">{hoje}</p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
            online ? (pend > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200') : 'bg-surface-3 text-fg-secondary border border-border'
          }`}
          title={online ? (pend > 0 ? `${pend} relatório(s) aguardando envio` : 'Tudo sincronizado') : 'Sem conexão — dados salvos no aparelho'}
        >
          <span className="material-symbols-outlined text-sm">{online ? (pend > 0 ? 'cloud_upload' : 'cloud_done') : 'cloud_off'}</span>
          {online ? (pend > 0 ? `${pend} p/ enviar` : 'Sincronizado') : 'Offline'}
        </span>
      </div>

      {/* Bater ponto INLINE — registra no próprio Dashboard (mesmo motor do Ponto) */}
      <div className="rounded-2xl bg-surface border border-border shadow-sm p-4">
        <div className="grid grid-cols-4 gap-2 mb-3">
          {(['ENTRADA', 'PAUSA', 'RETORNO', 'SAIDA'] as const).map((t, i) => (
            <div key={t} className="text-center">
              <p className="text-[9px] uppercase tracking-wider text-fg-muted">{['Entrada', 'Almoço', 'Retorno', 'Saída'][i]}</p>
              <p className={`font-data-mono text-sm font-bold mt-0.5 ${marco(t) ? 'text-fg' : 'text-fg-muted'}`}>{hm(marco(t))}</p>
            </div>
          ))}
        </div>
        <button
          onClick={baterPonto}
          disabled={!nextT || punching}
          className={`w-full min-h-[72px] rounded-xl text-white shadow-md flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-60 ${nextT ? NEXT_TONE[nextT] : 'bg-border-strong'}`}
        >
          <span className={`material-symbols-outlined text-3xl ${punching ? 'animate-spin' : ''}`}>{punching ? 'progress_activity' : nextT ? 'fingerprint' : 'task_alt'}</span>
          <span className="text-base font-bold uppercase tracking-wide">{punching ? 'Registrando…' : nextT ? PUNCH_LABEL[nextT] : 'Jornada encerrada'}</span>
        </button>
        <button onClick={() => onNavigateToTab('ponto')} className="mt-2 w-full text-[11px] font-semibold text-primary hover:underline uppercase">
          Abrir Ponto completo / Meu Espelho
        </button>
      </div>

      {/* Atalhos operacionais */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onNewAtendimento}
          className="min-h-[80px] rounded-xl bg-surface border border-border shadow-sm flex flex-col items-center justify-center gap-1 text-danger hover:border-danger transition-colors"
        >
          <span className="material-symbols-outlined text-3xl">assignment</span>
          <span className="text-xs font-bold uppercase tracking-wide text-fg-secondary">Novo Atendimento</span>
        </button>
        <button
          onClick={onNewOSClick}
          className="min-h-[80px] rounded-xl bg-surface border border-border shadow-sm flex flex-col items-center justify-center gap-1 text-primary hover:border-primary transition-colors"
        >
          <span className="material-symbols-outlined text-3xl">add_task</span>
          <span className="text-xs font-bold uppercase tracking-wide text-fg-secondary">Nova OS</span>
        </button>
        <button
          onClick={() => setQuickPhotoOpen(true)}
          className="min-h-[80px] rounded-xl bg-surface border border-border shadow-sm flex flex-col items-center justify-center gap-1 text-primary hover:border-primary transition-colors"
        >
          <span className="material-symbols-outlined text-3xl">photo_camera</span>
          <span className="text-xs font-bold uppercase tracking-wide text-fg-secondary">Registro Rápido</span>
        </button>
      </div>

      {/* Mini-agenda — minhas próximas OS (por UUID, RLS já restringe) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-wider text-fg-secondary">Minhas próximas OS</p>
          <button onClick={() => onNavigateToTab('agenda')} className="text-[11px] font-semibold text-primary hover:underline uppercase">
            Ver agenda completa
          </button>
        </div>
        {minhasOS.length === 0 ? (
          <div className="bg-surface rounded-xl border border-dashed border-border py-10 text-center">
            <span className="material-symbols-outlined text-4xl text-fg-muted">event_available</span>
            <p className="mt-1 text-sm font-bold text-fg-secondary uppercase tracking-wider">Sem OS atribuídas</p>
            <p className="text-[11px] text-fg-muted mt-0.5">Nada pendente para você agora.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {minhasOS.map((os) => (
              <button
                key={os.id}
                onClick={() => onNavigateToTab('pedidos')}
                className="text-left bg-surface rounded-xl border border-border shadow-sm p-3 hover:border-border-strong transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-data-mono text-[11px] font-bold text-fg-secondary">{os.numero || os.id.slice(0, 8)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${OS_TONE[os.status]}`}>{os.status.replace('_', ' ')}</span>
                </div>
                <p className="font-bold text-fg text-sm truncate mt-1">{clientName(os.clienteId)}</p>
                <p className="text-[11px] text-fg-secondary truncate">
                  {os.tipo}{os.dataPrevista ? ` · ${new Date(os.dataPrevista).toLocaleDateString('pt-BR')}` : ''}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
      <QuickFieldPhotoModal
        isOpen={quickPhotoOpen}
        onClose={() => setQuickPhotoOpen(false)}
        clients={clients}
        technicianId={currentUserId}
        technicianName={currentUser}
      />
    </div>
  );
};
