'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { TabPath, TimePunch, Client, OrdemServico } from '@/lib/types';
import { fetchOrdensServico } from '@/lib/ordensServico';
import { QuickFieldPhotoModal } from '@/components/field-photos/QuickFieldPhotoModal';
import { QuickPunchCard } from '@/components/ponto/QuickPunchCard';
import { SyncIndicator } from '@/components/ui/SyncIndicator';

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
  onNewAtendimento,
  usesTimeClock = true,
}) => {
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [quickPhotoOpen, setQuickPhotoOpen] = useState(false);

  useEffect(() => {
    // A RLS já restringe o TÉCNICO às OS dele; filtramos por UUID como reforço.
    fetchOrdensServico().then(setOrdens).catch(() => setOrdens([]));
  }, []);

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
  const clientName = (id?: string) => clients.find((c) => c.id === id)?.name || 'Cliente';

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
