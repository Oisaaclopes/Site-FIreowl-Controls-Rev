'use client';

import React, { useState } from 'react';
import { TimePunch } from '@/lib/types';
import { adminCorrectPunch, AdjustmentAction, validateAdminCorrection } from '@/lib/adjustments';
import { dateKeyOf, dateKeyToBr } from '@/lib/timecard';
import { PUNCH_TYPES, PunchType, TimesheetRow } from '@/lib/timesheet';

/**
 * Correção ADMINISTRATIVA de uma jornada (ADMINISTRATIVO/GESTOR). Nunca altera
 * time_punches: cada ação vira um ajuste auditado com efeito imediato
 * (RPC punch_admin_correct) — corrigir horário, incluir batida ausente ou
 * desconsiderar uma batida incorreta. Motivo obrigatório.
 */
export interface PunchCorrectionModalProps {
  row: TimesheetRow;
  employeeName: string;
  /** profiles.id do funcionário — dono das batidas. */
  employeeUserId?: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const hm = (at?: number) => (at != null ? `${pad2(new Date(at).getHours())}:${pad2(new Date(at).getMinutes())}` : '');
const TYPE_LABEL: Record<PunchType, string> = {
  ENTRADA: 'Entrada', PAUSA: 'Saída para almoço', RETORNO: 'Retorno', SAIDA: 'Saída',
};
const ACTION_TITLE: Record<AdjustmentAction, string> = {
  AJUSTE: 'Corrigir horário', INCLUSAO: 'Adicionar batida faltante', DESCONSIDERAR: 'Desconsiderar batida',
};
const inputCls = 'w-full border border-border rounded-lg p-2.5 text-sm text-fg bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20';
const labelCls = 'block text-fg-secondary mb-1 font-semibold uppercase text-[11px]';

interface Draft {
  action: AdjustmentAction;
  type: PunchType;
  punch?: TimePunch;
  refDate: string;
  time: string;
  reason: string;
}

/** Alvo da correção: batida original (id real) ou inclusão anterior (virtual). */
const targetOf = (p?: TimePunch) => {
  if (!p) return {};
  return p.id.startsWith('adjustment:') ? { replacesAdjustmentId: p.id.slice('adjustment:'.length) } : { originalPunchId: p.id };
};

export const PunchCorrectionModal: React.FC<PunchCorrectionModalProps> = ({
  row, employeeName, employeeUserId, onClose, onSaved,
}) => {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = (action: AdjustmentAction, type: PunchType, punch?: TimePunch) => {
    setError(null);
    setDraft({
      action, type, punch,
      refDate: punch?.at != null ? dateKeyOf(punch.at) : row.competenceKey,
      time: action === 'AJUSTE' ? hm(punch?.at) : '',
      reason: '',
    });
  };

  const save = async () => {
    if (!draft || saving) return;
    const input = {
      userId: employeeUserId || '',
      action: draft.action,
      type: draft.type,
      refDate: draft.refDate,
      requestedTime: draft.time,
      reason: draft.reason,
      ...targetOf(draft.punch),
    };
    const invalid = validateAdminCorrection(input);
    if (invalid) { setError(invalid); return; }
    setSaving(true);
    setError(null);
    try {
      await adminCorrectPunch(input);
      await onSaved();
      onClose();
    } catch (err: any) {
      console.error('Falha na correção administrativa do ponto:', err);
      setError(err?.message?.includes('punch_admin_correct')
        ? 'A correção administrativa ainda não está disponível no banco (migration 0113).'
        : err?.message || 'Não foi possível salvar a correção.');
    } finally {
      setSaving(false);
    }
  };

  const extras = row.extras;

  return (
    <div className="fixed inset-0 z-50 bg-navy/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Corrigir jornada">
      <div className="bg-surface w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-xl border border-border shadow-2xl">
        <div className="sticky top-0 bg-surface flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <h3 className="font-display text-base font-bold text-primary uppercase tracking-wide">Corrigir jornada</h3>
            <p className="text-[11px] text-fg-secondary truncate">{employeeName} · competência {dateKeyToBr(row.competenceKey)}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="min-w-[44px] min-h-[44px] text-fg-muted hover:text-fg-secondary font-bold text-xl">✕</button>
        </div>

        {!employeeUserId && (
          <p className="mx-5 mt-4 rounded-lg border border-danger/30 bg-red-50 px-3 py-2 text-xs text-danger">
            Não foi possível identificar o cadastro deste funcionário para registrar a correção.
          </p>
        )}

        {!draft ? (
          <div className="px-5 py-4 space-y-2 text-sm">
            <p className="text-[11px] text-fg-secondary">
              O registro original nunca é alterado: a correção fica registrada com seu nome, data/hora e motivo, e passa a valer imediatamente na folha.
            </p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {PUNCH_TYPES.map((t) => {
                const p = row.slots[t];
                return (
                  <li key={t} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="font-semibold text-fg">{TYPE_LABEL[t]}</p>
                      <p className="font-data-mono text-xs text-fg-secondary">
                        {p?.at != null ? (
                          <>
                            {hm(p.at)}
                            {dateKeyOf(p.at) !== row.competenceKey && ` (${dateKeyToBr(dateKeyOf(p.at))})`}
                            {p.effectiveSource === 'adjusted' && (p.adjustmentAction === 'INCLUSAO' ? ' · incluída' : ` · original ${hm(p.originalAt)}`)}
                          </>
                        ) : <span className="text-danger">faltando</span>}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {p ? (
                        <>
                          <button type="button" onClick={() => start('AJUSTE', t, p)} disabled={!employeeUserId}
                            className="min-h-[40px] rounded-lg border border-primary/40 px-3 text-xs font-semibold text-primary hover:bg-navy hover:text-white disabled:opacity-50">
                            Corrigir horário
                          </button>
                          <button type="button" onClick={() => start('DESCONSIDERAR', t, p)} disabled={!employeeUserId}
                            className="min-h-[40px] rounded-lg border border-border px-3 text-xs font-semibold text-fg-secondary hover:border-danger hover:text-danger disabled:opacity-50">
                            Desconsiderar
                          </button>
                        </>
                      ) : (
                        <button type="button" onClick={() => start('INCLUSAO', t)} disabled={!employeeUserId}
                          className="min-h-[40px] rounded-lg bg-navy px-3 text-xs font-semibold text-white hover:bg-navy-3 disabled:opacity-50">
                          Adicionar batida
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {extras.length > 0 && (
              <div>
                <p className="mt-3 mb-1 text-[11px] font-bold uppercase tracking-wider text-fg-secondary">Outras batidas desta jornada</p>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {extras.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                      <p className="text-xs text-fg"><span className="font-semibold">{TYPE_LABEL[p.type]}</span> · <span className="font-data-mono">{hm(p.at)}</span>{p.at != null && ` (${dateKeyToBr(dateKeyOf(p.at))})`}</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => start('AJUSTE', p.type, p)} disabled={!employeeUserId}
                          className="min-h-[40px] rounded-lg border border-primary/40 px-3 text-xs font-semibold text-primary disabled:opacity-50">Corrigir horário</button>
                        <button type="button" onClick={() => start('DESCONSIDERAR', p.type, p)} disabled={!employeeUserId}
                          className="min-h-[40px] rounded-lg border border-border px-3 text-xs font-semibold text-fg-secondary hover:text-danger disabled:opacity-50">Desconsiderar</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <p className="mt-3 mb-1 text-[11px] font-bold uppercase tracking-wider text-fg-secondary">Batida a mais</p>
              <div className="flex flex-wrap gap-2">
                {PUNCH_TYPES.filter((t) => row.slots[t]).map((t) => (
                  <button key={t} type="button" onClick={() => start('INCLUSAO', t)} disabled={!employeeUserId}
                    className="min-h-[36px] rounded-lg border border-border px-3 text-[11px] font-semibold text-fg-secondary hover:border-primary hover:text-primary disabled:opacity-50">
                    + {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-fg">{ACTION_TITLE[draft.action]} · {TYPE_LABEL[draft.type]}</p>
              <button type="button" onClick={() => setDraft(null)} className="text-[11px] font-semibold text-primary hover:underline">Voltar</button>
            </div>
            {draft.punch?.at != null && (
              <p className="rounded-lg bg-surface-2 px-3 py-2 text-fg-secondary">
                Horário atual: <span className="font-data-mono font-semibold text-fg">{hm(draft.punch.at)}</span> em {dateKeyToBr(dateKeyOf(draft.punch.at))}
                {draft.punch.effectiveSource === 'adjusted' && draft.punch.originalAt != null && draft.punch.adjustmentAction !== 'INCLUSAO' && (
                  <> · registro original <span className="font-data-mono">{hm(draft.punch.originalAt)}</span></>
                )}
              </p>
            )}
            {draft.action === 'DESCONSIDERAR' ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                A batida deixa de contar na folha, mas continua guardada no sistema com a indicação de que foi desconsiderada.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls} htmlFor="corr-date">Data</label>
                  <input id="corr-date" type="date" value={draft.refDate} onChange={(e) => setDraft({ ...draft, refDate: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="corr-time">{draft.action === 'AJUSTE' ? 'Horário correto *' : 'Horário *'}</label>
                  <input id="corr-time" type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} className={`${inputCls} font-data-mono`} />
                </div>
                <p className="col-span-2 text-[11px] text-fg-muted">
                  Jornada noturna: use a data real do horário (ex.: saída às 02:15 do dia seguinte).
                </p>
              </div>
            )}
            <div>
              <label className={labelCls} htmlFor="corr-reason">Motivo *</label>
              <textarea id="corr-reason" rows={3} value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                placeholder="Ex.: funcionário esqueceu de registrar o retorno" className={inputCls} />
            </div>
            {error && <p className="rounded-lg border border-danger/30 bg-red-50 px-3 py-2 text-danger">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setDraft(null)} className="min-h-[44px] flex-1 rounded-lg border border-border text-sm font-semibold text-fg-secondary">Cancelar</button>
              <button type="button" onClick={save} disabled={saving}
                className={`min-h-[44px] flex-1 rounded-lg text-sm font-semibold text-white disabled:opacity-60 ${draft.action === 'DESCONSIDERAR' ? 'bg-danger hover:bg-danger-hover' : 'bg-navy hover:bg-navy-3'}`}>
                {saving ? 'Salvando…' : 'Salvar correção'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
