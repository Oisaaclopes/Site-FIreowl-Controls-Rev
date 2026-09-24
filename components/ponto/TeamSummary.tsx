'use client';

import React from 'react';
import { fmtHoursShort } from '@/lib/timecard';
import type { EmployeeMonthSummary } from '@/lib/timesheet';

/**
 * Visão Equipe — resumo da competência por funcionário, em ordem ALFABÉTICA.
 * Deliberadamente sem ranking/ordenação por saldo: saldo de horas não é
 * avaliação de desempenho. Selecionar abre a folha consolidada do funcionário.
 */
export interface TeamSummaryProps {
  /** `key` = user_id (identidade); `employee` = nome para exibição. */
  summaries: (EmployeeMonthSummary & { key: string })[];
  onOpen: (key: string) => void;
}

const h = (ms: number, signed = false) => fmtHoursShort(ms, signed);

export const TeamSummary: React.FC<TeamSummaryProps> = ({ summaries, onOpen }) => {
  const list = [...summaries].sort((a, b) => a.employee.localeCompare(b.employee, 'pt-BR'));
  if (list.length === 0) {
    return <div className="rounded-xl bg-surface py-12 text-center text-sm text-fg-muted shadow-sm">Nenhum funcionário com ponto nesta competência.</div>;
  }
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface shadow-sm md:block">
        <table className="w-full text-xs">
          <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-fg-secondary">
            <tr>
              {['Funcionário', 'Jornadas', 'Previsto', 'Trabalhado', 'Saldo', 'Pendências', ''].map((c) => (
                <th key={c} className="px-3 py-2 text-left font-bold">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.map((s) => (
              <tr key={s.key}>
                <td className="px-3 py-2 font-semibold text-fg">{s.employee}</td>
                <td className="px-3 py-2 tabular-nums">{s.journeys}</td>
                <td className="px-3 py-2 font-data-mono tabular-nums text-fg-secondary">{h(s.previstoMs)}</td>
                <td className="px-3 py-2 font-data-mono tabular-nums">{h(s.trabalhadoMs)}</td>
                <td className="px-3 py-2 font-data-mono tabular-nums text-fg-secondary">{h(s.saldoMs, true)}</td>
                <td className="px-3 py-2">
                  {s.pendencies > 0
                    ? <span className="inline-flex rounded-full border border-danger/30 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-danger">{s.pendencies}</span>
                    : <span className="text-fg-muted">0</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  <button type="button" onClick={() => onOpen(s.key)}
                    className="rounded-md border border-primary/40 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-navy hover:text-white">
                    Ver folha
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2 md:hidden">
        {list.map((s) => (
          <li key={s.key}>
            <button type="button" onClick={() => onOpen(s.key)}
              className="w-full rounded-xl border border-border bg-surface p-3 text-left shadow-sm min-h-[64px]">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-bold text-fg">{s.employee}</p>
                {s.pendencies > 0 && (
                  <span className="shrink-0 rounded-full border border-danger/30 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-danger">
                    {s.pendencies} pendência{s.pendencies > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-fg-secondary">
                {s.journeys} jornada{s.journeys === 1 ? '' : 's'} · trabalhado <span className="font-data-mono">{h(s.trabalhadoMs)}</span> de <span className="font-data-mono">{h(s.previstoMs)}</span> · saldo <span className="font-data-mono">{h(s.saldoMs, true)}</span>
              </p>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
};
