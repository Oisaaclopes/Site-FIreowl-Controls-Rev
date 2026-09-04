'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TabPath, TimePunch, Client, OrdemServico, FieldOperation } from '@/lib/types';
import { getClientOperationalName } from '@/lib/utils';
import { fetchOrdensServico } from '@/lib/ordensServico';
import { fetchFieldOperations } from '@/lib/fieldOperationsDomain';
import { useDomainRefresh } from '@/lib/realtime/RealtimeProvider';
import { QuickFieldPhotoModal } from '@/components/field-photos/QuickFieldPhotoModal';
import { QuickPunchCard } from '@/components/ponto/QuickPunchCard';
import { SyncIndicator } from '@/components/ui/SyncIndicator';
import { ActiveAttendanceCard } from '@/components/operacoes/ServiceAttendanceFlow';

interface TechDashboardProps {
  currentUser: string;
  /** UUID autenticado — usado para "Minhas OS" (nunca por nome/email). */
  currentUserId?: string;
  punches: TimePunch[];
  onAddPunch: (p: TimePunch) => void;
  clients: Client[];
  onNavigateToTab: (tab: TabPath) => void;
  onNewOSClick: () => void;
  /** Abre o wizard de relatório técnico (fluxo de Relatórios; não confundir com
   *  o ATENDIMENTO operacional da OS — ver ETAPA 3B, §31). */
  onNewReport: () => void;
  /** profiles.uses_time_clock — quando false, o card de Ponto não aparece. */
  usesTimeClock?: boolean;
}

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
  onNewReport,
  usesTimeClock = true,
}) => {
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [operacoes, setOperacoes] = useState<FieldOperation[]>([]);
  const [quickPhotoOpen, setQuickPhotoOpen] = useState(false);

  useEffect(() => {
    // A RLS já restringe o TÉCNICO às OS dele; filtramos por UUID como reforço.
    fetchOrdensServico().then(setOrdens).catch(() => setOrdens([]));
  }, []);

  // Operações de campo ATIVAS do técnico (a RLS só retorna as em que está alocado).
  const refreshOperacoes = useCallback(() => {
    fetchFieldOperations({ status: 'ATIVA' }).then(setOperacoes).catch(() => setOperacoes([]));
  }, []);
  useEffect(() => { refreshOperacoes(); }, [refreshOperacoes]);
  useDomainRefresh('fieldOps', refreshOperacoes);

  const now = new Date();
  const hora = now.getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const hoje = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

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
  // Interface operacional: nome fantasia com fallback à razão (§8/§9).
  const clientName = (id?: string) => getClientOperationalName(clients.find((c) => c.id === id), 'Cliente');

  return (
    <div className="flex flex-col w-full p-4 md:p-6 gap-4 max-w-2xl mx-auto">
      {/* Saudação + status de sincronização (só aparece em exceções, §4/§5) */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-bold text-fg truncate">{saudacao}, {currentUser || 'técnico'} 👋</p>
          <p className="text-[11px] text-fg-secondary capitalize">{hoje}</p>
        </div>
        <SyncIndicator />
      </div>

      {/* Card de Ponto compacto — componente compartilhado (mesmo motor do
          módulo Ponto). Só aparece para quem usa controle de ponto. */}
      <QuickPunchCard
        currentUser={currentUser}
        punches={punches}
        onAddPunch={onAddPunch}
        usesTimeClock={usesTimeClock}
        onOpenPonto={() => onNavigateToTab('ponto')}
      />

      {/* ATENDIMENTO ATUAL — prioridade visual acima da operação (§23). Só
          aparece quando há um service_attendance EM_EXECUCAO do técnico. */}
      <ActiveAttendanceCard technicianId={currentUserId} technicianName={currentUser} clients={clients} orders={ordens} />

      {/* OPERAÇÃO DE HOJE — operação de campo recorrente do técnico (§17). Não é
          OS: é a atividade contínua (ex.: Auditoria SDAI no Catuaí). */}
      {operacoes.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-fg-secondary mb-2">Operação de hoje</p>
          <div className="flex flex-col gap-2">
            {operacoes.map((op) => (
              <div key={op.id} className="bg-surface rounded-xl border border-border shadow-sm p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-fg text-sm truncate">{clientName(op.clientId)}</p>
                    <p className="text-[11px] text-fg-secondary truncate">{op.name}</p>
                  </div>
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold bg-indigo-50 text-indigo-700 uppercase">
                    {op.operationType.replace('_', ' ')}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => onNavigateToTab('agenda')}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-fg-secondary hover:border-border-strong transition-colors uppercase tracking-wide"
                  >
                    Abrir operação
                  </button>
                  {/* Link externo opcional (§18/§19): só aparece se configurado
                      administrativamente na operação. NUNCA hardcoded aqui. */}
                  {op.externalSystemUrl && (
                    <a
                      href={op.externalSystemUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors uppercase tracking-wide flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                      Abrir auditoria
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Atalhos operacionais */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onNewReport}
          className="min-h-[80px] rounded-xl bg-surface border border-border shadow-sm flex flex-col items-center justify-center gap-1 text-danger hover:border-danger transition-colors"
        >
          <span className="material-symbols-outlined text-3xl">assignment</span>
          <span className="text-xs font-bold uppercase tracking-wide text-fg-secondary">Novo Relatório</span>
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
