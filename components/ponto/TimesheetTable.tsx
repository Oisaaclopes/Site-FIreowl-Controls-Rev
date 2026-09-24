'use client';

import React, { useState } from 'react';
import { TimePunch } from '@/lib/types';
import type { PunchAdjustment } from '@/lib/adjustments';
import { dateKeyOf, fmtHoursShort } from '@/lib/timecard';
import {
  FILTER_LABEL, PUNCH_TYPES, PunchType, SITUATION_LABEL, SITUATION_TONE, TimesheetFilter, TimesheetRow,
  filterTimesheetRows,
} from '@/lib/timesheet';

/**
 * Folha consolidada — uma linha por JORNADA (motor canônico em lib/timesheet).
 * Desktop: tabela de 10 colunas. Celular: um card compacto por jornada.
 * Localização/endereço ficam no "Ver mais", nunca na linha principal.
 */
export interface TimesheetTableProps {
  rows: TimesheetRow[];
  /** Ajustes do funcionário (qualquer status) — trilha de auditoria no "Ver mais". */
  adjustments: PunchAdjustment[];
  /** Mostra a ação "Corrigir" (ADMINISTRATIVO/GESTOR). */
  canCorrect: boolean;
  onCorrect?: (row: TimesheetRow) => void;
  filter: TimesheetFilter;
  onFilterChange: (f: TimesheetFilter) => void;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const hm = (at?: number) => (at != null ? `${pad2(new Date(at).getHours())}:${pad2(new Date(at).getMinutes())}` : '—');
const dayMonth = (dk: string) => { const [, m, d] = dk.split('-'); return `${d}/${m}`; };
const weekday = (dk: string) => {
  const [y, m, d] = dk.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
};
const dur = (ms: number | null) => (ms == null ? '—' : fmtHoursShort(ms));
const signed = (ms: number | null) => (ms == null ? '—' : fmtHoursShort(ms, true));

const TYPE_LABEL: Record<PunchType, string> = {
  ENTRADA: 'Entrada', PAUSA: 'Saída almoço', RETORNO: 'Retorno', SAIDA: 'Saída',
};
const ACTION_LABEL: Record<string, string> = {
  AJUSTE: 'Horário corrigido', INCLUSAO: 'Batida incluída', DESCONSIDERAR: 'Batida desconsiderada',
};
const STATUS_LABEL: Record<string, string> = {
  PENDENTE: 'Aguardando aprovação', APROVADO: 'Vigente', REJEITADO: 'Rejeitado', SUBSTITUIDO: 'Substituído',
};

const TONE_CLS: Record<'ok' | 'warn' | 'bad' | 'info', string> = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
  bad: 'bg-red-50 text-danger border-danger/30',
  info: 'bg-surface-3 text-fg-secondary border-border',
};

/** Horário efetivo de uma batida, com "(+1)" quando cai após o dia de competência. */
function cell(p: TimePunch | undefined, competenceKey: string) {
  if (!p?.at) return <span className="text-fg-muted">—</span>;
  const nextDay = dateKeyOf(p.at) !== competenceKey;
  return (
    <span className={p.effectiveSource === 'adjusted' ? 'text-primary font-semibold' : undefined}
      title={p.effectiveSource === 'adjusted' ? 'Horário efetivo (ajustado)' : undefined}>
      {hm(p.at)}{nextDay && <sup className="ml-0.5 text-[9px] text-fg-muted">+1</sup>}
    </span>
  );
}

const SituationChip: React.FC<{ row: TimesheetRow }> = ({ row }) => (
  <span className="inline-flex flex-wrap items-center gap-1">
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TONE_CLS[SITUATION_TONE[row.situation]]}`}>
      {row.situation === 'OCORRENCIA' && row.occurrence ? row.occurrence : SITUATION_LABEL[row.situation]}
    </span>
    {row.situation !== 'OCORRENCIA' && row.occurrence && (
      <span className="text-[10px] text-fg-secondary" title={row.occurrence}>{row.occurrence}</span>
    )}
    {row.adjusted && (
      <span className="inline-flex items-center rounded-full border border-primary/30 bg-navy/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
        Ajustada
      </span>
    )}
    {row.awaitingCorrection && (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
        Aguardando correção
      </span>
    )}
  </span>
);

const hasGps = (p: TimePunch) => !!(p.lat || p.lng);
const mapsUrl = (p: TimePunch) => `https://www.google.com/maps?q=${p.lat},${p.lng}`;
const locationText = (p: TimePunch) =>
  p.locationAddress || (hasGps(p) ? p.locationStr || 'Localização registrada' : p.locationStr || 'Localização não informada');

/** Detalhe da jornada: cada batida (original × efetiva) + trilha de ajustes. */
const JourneyDetail: React.FC<{ row: TimesheetRow; adjustments: PunchAdjustment[] }> = ({ row, adjustments }) => {
  const punches = [
    ...PUNCH_TYPES.map((t) => row.slots[t]).filter((p): p is TimePunch => !!p),
    ...row.extras,
  ].sort((a, b) => (a.at || 0) - (b.at || 0));
  const ids = new Set(row.journey?.punches.map((p) => p.id) ?? []);
  const adjIds = new Set(punches.map((p) => p.adjustmentId).filter(Boolean));
  const dates = new Set([row.competenceKey, ...punches.filter((p) => p.at).map((p) => dateKeyOf(p.at!))]);
  const trail = adjustments
    .filter((a) => adjIds.has(a.id) || (a.originalPunchId && ids.has(a.originalPunchId)) || dates.has(a.refDate))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

  return (
    <div className="space-y-3 text-xs">
      {punches.length === 0 && <p className="text-fg-muted">Sem batidas nesta data.</p>}
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {punches.map((p) => {
          const included = p.adjustmentAction === 'INCLUSAO';
          return (
            <li key={p.id} className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-fg">
                  {TYPE_LABEL[p.type]} — <span className="font-data-mono">{hm(p.at)}</span>
                  {p.at != null && dateKeyOf(p.at) !== row.competenceKey && <span className="ml-1 text-fg-muted">({dayMonth(dateKeyOf(p.at))})</span>}
                </p>
                <p className="text-[11px] text-fg-secondary">
                  {included
                    ? `Batida incluída ${p.adjustmentOrigin === 'ADMINISTRATIVO' ? 'pela administração' : 'por solicitação aprovada'} — não há registro original.`
                    : p.effectiveSource === 'adjusted'
                    ? <>Registro original: <span className="font-data-mono">{hm(p.originalAt)}</span> · horário corrigido {p.adjustmentOrigin === 'ADMINISTRATIVO' ? 'pela administração' : 'por solicitação aprovada'}</>
                    : 'Registro original'}
                </p>
                {p.effectiveSource === 'adjusted' && (
                  <p className="text-[11px] text-fg-muted">
                    {p.adjustmentApprovedBy ? `Por ${p.adjustmentApprovedBy}` : ''}
                    {p.adjustmentApprovedAt ? ` em ${new Date(p.adjustmentApprovedAt).toLocaleString('pt-BR')}` : ''}
                    {p.adjustmentReason ? ` · Motivo: ${p.adjustmentReason}` : ''}
                  </p>
                )}
                {!included && <p className="text-[11px] text-fg-secondary truncate">{locationText(p)}</p>}
              </div>
              {!included && hasGps(p) && (
                <a href={mapsUrl(p)} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline min-h-[32px]">
                  <span className="material-symbols-outlined text-sm">map</span> Ver no mapa
                </a>
              )}
            </li>
          );
        })}
      </ul>
      {trail.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-fg-secondary">Histórico de ajustes</p>
          <ul className="space-y-1">
            {trail.map((a) => (
              <li key={a.id} className="rounded-lg border border-border bg-surface px-3 py-2 text-[11px] text-fg-secondary">
                <span className="font-semibold text-fg">{ACTION_LABEL[a.action || 'AJUSTE']} · {TYPE_LABEL[a.type]}</span>
                {a.originalAt && <> · original <span className="font-data-mono">{hm(new Date(a.originalAt).getTime())}</span></>}
                {a.requestedTime && a.action !== 'DESCONSIDERAR' && <> → <span className="font-data-mono">{a.requestedTime.slice(0, 5)}</span> ({dayMonth(a.refDate)})</>}
                {' · '}{STATUS_LABEL[a.status] || a.status}
                {' · '}{a.origin === 'ADMINISTRATIVO' ? `Correção de ${a.createdByName || a.reviewerName || 'gestor'}` : `Solicitado por ${a.employeeName}`}
                {a.createdAt && ` em ${new Date(a.createdAt).toLocaleString('pt-BR')}`}
                {a.reason && <span className="block text-fg-muted">Motivo: {a.reason}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export const TimesheetTable: React.FC<TimesheetTableProps> = ({
  rows, adjustments, canCorrect, onCorrect, filter, onFilterChange,
}) => {
  const [open, setOpen] = useState<string | null>(null);
  const visible = filterTimesheetRows(rows, filter);
  const toggle = (k: string) => setOpen((cur) => (cur === k ? null : k));
  const canAct = canCorrect && !!onCorrect;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtro da folha">
        {(Object.keys(FILTER_LABEL) as TimesheetFilter[]).map((f) => {
          const count = filterTimesheetRows(rows, f).length;
          return (
            <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => onFilterChange(f)}
              className={`min-h-[36px] rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === f ? 'border-primary bg-navy text-white' : 'border-border bg-surface text-fg-secondary hover:border-primary hover:text-primary'
              }`}>
              {FILTER_LABEL[f]}{f !== 'TODOS' && <span className="ml-1 opacity-80">({count})</span>}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl bg-surface py-12 text-center text-sm text-fg-muted shadow-sm">
          Nenhuma jornada {filter === 'TODOS' ? 'nesta competência' : 'neste filtro'}.
        </div>
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface shadow-sm md:block">
            <table className="w-full text-xs">
              <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-fg-secondary">
                <tr>
                  {['Data', 'Entrada', 'Saída almoço', 'Retorno', 'Saída', 'Trabalhado', 'Previsto', 'Saldo', 'Situação', 'Ações'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((r) => (
                  <React.Fragment key={r.key}>
                    <tr className="align-middle">
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-fg">
                        {dayMonth(r.competenceKey)} <span className="font-normal text-fg-muted">{weekday(r.competenceKey)}</span>
                      </td>
                      {PUNCH_TYPES.map((t) => (
                        <td key={t} className="whitespace-nowrap px-3 py-2 font-data-mono tabular-nums">{cell(r.slots[t], r.competenceKey)}</td>
                      ))}
                      <td className="whitespace-nowrap px-3 py-2 font-data-mono tabular-nums text-fg">{dur(r.workedMs)}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-data-mono tabular-nums text-fg-secondary">{dur(r.expectedMs)}</td>
                      <td className={`whitespace-nowrap px-3 py-2 font-data-mono tabular-nums ${r.balanceMs != null && r.balanceMs < 0 ? 'text-danger' : r.balanceMs ? 'text-amber-700' : 'text-fg-secondary'}`}>
                        {signed(r.balanceMs)}
                      </td>
                      <td className="px-3 py-2"><SituationChip row={r} /></td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <div className="flex items-center gap-2">
                          {r.journey && (
                            <button type="button" onClick={() => toggle(r.key)} aria-expanded={open === r.key}
                              className="text-[11px] font-semibold text-primary hover:underline">
                              {open === r.key ? 'Fechar' : 'Ver mais'}
                            </button>
                          )}
                          {canAct && (
                            <button type="button" onClick={() => onCorrect!(r)}
                              className="rounded-md border border-primary/40 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-navy hover:text-white">
                              Corrigir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {open === r.key && (
                      <tr><td colSpan={10} className="bg-surface-2 px-4 py-3"><JourneyDetail row={r} adjustments={adjustments} /></td></tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Celular: cards */}
          <ul className="space-y-2 md:hidden">
            {visible.map((r) => (
              <li key={r.key} className="rounded-xl border border-border bg-surface p-3 shadow-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-bold text-fg">
                    {dayMonth(r.competenceKey)} <span className="text-xs font-normal text-fg-muted">{weekday(r.competenceKey)}</span>
                  </p>
                  <p className="font-data-mono text-sm font-bold tabular-nums text-fg">{dur(r.workedMs)}</p>
                </div>
                {r.journey && (
                  <p className="mt-1 font-data-mono text-xs tabular-nums text-fg-secondary">
                    {cell(r.slots.ENTRADA, r.competenceKey)} → {cell(r.slots.PAUSA, r.competenceKey)}
                    <span className="mx-1.5 text-fg-muted">|</span>
                    {cell(r.slots.RETORNO, r.competenceKey)} → {cell(r.slots.SAIDA, r.competenceKey)}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-fg-secondary">
                  <span>Saldo <span className="font-data-mono">{signed(r.balanceMs)}</span></span>
                  <span aria-hidden>·</span>
                  <SituationChip row={r} />
                </div>
                {(r.journey || canAct) && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {r.journey && (
                      <button type="button" onClick={() => toggle(r.key)} aria-expanded={open === r.key}
                        className="min-h-[44px] rounded-lg border border-border text-xs font-semibold text-primary">
                        {open === r.key ? 'Fechar' : 'Ver mais'}
                      </button>
                    )}
                    {canAct && (
                      <button type="button" onClick={() => onCorrect!(r)}
                        className="min-h-[44px] rounded-lg bg-navy text-xs font-semibold text-white hover:bg-navy-3">
                        Corrigir
                      </button>
                    )}
                  </div>
                )}
                {open === r.key && <div className="mt-3"><JourneyDetail row={r} adjustments={adjustments} /></div>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};
