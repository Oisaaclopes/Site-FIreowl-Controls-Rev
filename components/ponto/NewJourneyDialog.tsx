'use client';

import React, { useState } from 'react';
import { NEW_JOURNEY_REASON_MIN } from '@/lib/pontoActions';

/**
 * Pergunta explícita antes de abrir uma NOVA jornada no mesmo dia. O
 * funcionário precisa confirmar e informar o motivo (gravado na Entrada —
 * time_punches.journey_reason). Evita jornadas abertas sem querer.
 */
export interface NewJourneyDialogProps {
  /** Jornadas de hoje já registradas ("08:18–17:02"). */
  todayLabel: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

const SUGGESTIONS = ['Segundo turno', 'Chamado de emergência', 'Retorno ao serviço após liberação'];

export const NewJourneyDialog: React.FC<NewJourneyDialogProps> = ({ todayLabel, onConfirm, onCancel }) => {
  const [reason, setReason] = useState('');
  const valid = reason.trim().length >= NEW_JOURNEY_REASON_MIN;

  return (
    <div className="fixed inset-0 z-[60] bg-navy/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Abrir nova jornada">
      <div className="bg-surface w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border border-border shadow-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 shrink-0 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
            <span className="material-symbols-outlined">warning</span>
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-fg">Abrir uma NOVA jornada hoje?</h3>
            <p className="mt-1 text-xs text-fg-secondary">
              Você já tem jornada registrada hoje: <span className="font-data-mono font-semibold text-fg">{todayLabel || '—'}</span>.
              Se estava voltando do almoço ou encerrando o dia, <strong>cancele</strong> — esta ação abre outra jornada.
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="nj-reason" className="block text-fg-secondary mb-1 font-semibold uppercase text-[11px]">Motivo da nova jornada *</label>
          <textarea
            id="nj-reason" rows={3} value={reason} maxLength={500} autoFocus
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: segundo turno, chamado de emergência…"
            className="w-full border border-border rounded-lg p-2.5 text-sm text-fg bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => setReason(s)}
                className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-fg-secondary hover:border-primary hover:text-primary">
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onCancel}
            className="min-h-[48px] flex-1 rounded-lg border border-border text-sm font-semibold text-fg-secondary">
            Cancelar
          </button>
          <button type="button" disabled={!valid} onClick={() => onConfirm(reason.trim())}
            className="min-h-[48px] flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-sm font-semibold text-white disabled:opacity-50">
            Abrir nova jornada
          </button>
        </div>
      </div>
    </div>
  );
};
