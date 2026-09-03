'use client';

import React, { useState } from 'react';
import { TimePunch } from '@/lib/types';
import {
  derivePunchState,
  buildPunch,
  capturePunchPosition,
  PUNCH_LABEL,
  PUNCH_DONE,
  PUNCH_SHORT,
  PunchStatusKind,
} from '@/lib/pontoActions';
import { useToast } from '@/components/ui/Feedback';

/**
 * QuickPunchCard — card compacto de ponto orientado à PRÓXIMA ação.
 *
 * Fonte de verdade única: derivePunchState (mesma regra e mesmas batidas
 * efetivas do módulo Ponto). O registro usa o MESMO fluxo real
 * (buildPunch + onAddPunch → insertPunch), com GPS/offline/realtime intactos.
 *
 * Visibilidade: controlada por quem chama, mas o componente também se protege —
 * se usesTimeClock === false, não renderiza nada. Assim, a disponibilidade do
 * ponto rápido depende de profiles.uses_time_clock, não do cargo/role.
 */
export interface QuickPunchCardProps {
  currentUser: string;
  punches: TimePunch[];
  onAddPunch: (p: TimePunch) => void;
  /** profiles.uses_time_clock — false esconde o card. */
  usesTimeClock?: boolean;
  /** Abre o módulo Ponto completo ("Ver detalhes"). */
  onOpenPonto?: () => void;
  className?: string;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const hm = (at?: number) => (at ? `${pad2(new Date(at).getHours())}:${pad2(new Date(at).getMinutes())}` : '--');

const NEXT_TONE: Record<string, string> = {
  ENTRADA: 'bg-emerald-600 hover:bg-emerald-700',
  PAUSA: 'bg-amber-500 hover:bg-amber-600',
  RETORNO: 'bg-navy hover:bg-navy-3',
  SAIDA: 'bg-danger hover:bg-danger-hover',
};
const STATUS_CHIP: Record<PunchStatusKind, string> = {
  FORA: 'bg-blue-50 text-blue-700',
  TRABALHANDO: 'bg-emerald-50 text-emerald-700',
  ALMOCO: 'bg-amber-50 text-amber-700',
  ENCERRADA: 'bg-surface-3 text-fg-secondary',
};
const STATUS_DOT: Record<PunchStatusKind, string> = {
  FORA: 'bg-blue-500',
  TRABALHANDO: 'bg-emerald-500',
  ALMOCO: 'bg-amber-500',
  ENCERRADA: 'bg-border-strong',
};

export const QuickPunchCard: React.FC<QuickPunchCardProps> = ({
  currentUser,
  punches,
  onAddPunch,
  usesTimeClock = true,
  onOpenPonto,
  className = '',
}) => {
  const toast = useToast();
  const [punching, setPunching] = useState(false);

  if (usesTimeClock === false) return null;

  const state = derivePunchState(punches, currentUser, Date.now());
  const nextT = state.nextType;

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

  return (
    <div className={`rounded-2xl bg-surface border border-border shadow-sm p-4 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-fg-secondary">Ponto</span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_CHIP[state.statusKind]}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[state.statusKind]}`} />
          {state.statusLabel}
        </span>
      </div>

      {state.lastRelevant && state.statusKind !== 'FORA' && (
        <p className="mt-2 text-[11px] text-fg-secondary">
          {PUNCH_SHORT[state.lastRelevant.type]}{' '}
          <span className="font-data-mono font-bold text-fg">{hm(state.lastRelevant.at)}</span>
        </p>
      )}

      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">Próxima batida</p>
      <p className="text-sm font-bold text-fg">{nextT ? PUNCH_SHORT[nextT] : 'Nenhuma batida pendente'}</p>

      <button
        onClick={baterPonto}
        disabled={!nextT || punching}
        className={`mt-3 w-full min-h-[52px] rounded-xl text-white shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 ${nextT ? NEXT_TONE[nextT] : 'bg-border-strong'}`}
      >
        <span className={`material-symbols-outlined text-2xl ${punching ? 'animate-spin' : ''}`}>
          {punching ? 'progress_activity' : nextT ? 'fingerprint' : 'task_alt'}
        </span>
        <span className="text-sm font-bold uppercase tracking-wide">
          {punching ? 'Registrando…' : nextT ? PUNCH_LABEL[nextT] : 'Jornada encerrada'}
        </span>
      </button>

      {onOpenPonto && (
        <button onClick={onOpenPonto} className="mt-2 w-full text-[11px] font-semibold text-primary hover:underline uppercase">
          Ver detalhes / Meu Espelho
        </button>
      )}
    </div>
  );
};
