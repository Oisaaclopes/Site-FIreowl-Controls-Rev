// Fonte de verdade única para consolidação do ponto (Espelho de Ponto).
//
// Este módulo NÃO altera dados: apenas consolida as batidas em registros
// diários, classificando cada dia e calculando as horas trabalhadas SOMENTE
// quando há informação suficiente e cronologicamente válida. A tela "Meu
// Espelho", a folha administrativa e o PDF consomem o MESMO resultado — nunca
// recalculam a jornada por conta própria.

import { TimePunch } from './types';

export type PunchType = TimePunch['type'];

// OK            — jornada completa e cronologicamente válida (horas calculadas).
// EM_ANDAMENTO  — entrada registrada, jornada do dia ainda em curso (hoje).
// INCOMPLETA    — faltam batidas necessárias para fechar a jornada.
// INCONSISTENTE — as batidas existem mas violam a ordem Entrada < Almoço <
//                 Retorno < Saída (impossível cronologicamente).
export type DayStatus = 'OK' | 'EM_ANDAMENTO' | 'INCOMPLETA' | 'INCONSISTENTE';

export interface DayConsolidation {
  entrada?: number; // epoch ms
  pausa?: number;
  retorno?: number;
  saida?: number;
  /** Horas trabalhadas em ms — null quando NÃO é calculável (não presumir 0). */
  workedMs: number | null;
  status: DayStatus;
}

export interface DailyTimeRecord extends DayConsolidation {
  dateKey: string; // YYYY-MM-DD
  punches: TimePunch[];
}

const pad2 = (n: number) => n.toString().padStart(2, '0');

export const dateKeyOf = (at: number): string => {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

export const dateKeyToBr = (dk: string): string => dk.split('-').reverse().join('/');

export const hhmm = (at?: number): string =>
  at != null ? new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';

/** Rótulo de ocorrência derivado do status (para a coluna Ocorrência). */
export const dayStatusLabel = (status: DayStatus): string => {
  switch (status) {
    case 'INCOMPLETA':
      return 'Jornada incompleta';
    case 'INCONSISTENTE':
      return 'Jornada inconsistente';
    case 'EM_ANDAMENTO':
      return 'Em andamento';
    default:
      return '';
  }
};

/**
 * Consolida as batidas de UM dia (mesmo funcionário) em Entrada/Almoço/Retorno/
 * Saída + status. Convenção mantida do sistema: primeira ENTRADA/PAUSA/RETORNO,
 * última SAÍDA.
 *
 * @param nowMs quando informado, um dia só-com-entrada é tratado como
 *   EM_ANDAMENTO (jornada de hoje ainda em curso) em vez de INCOMPLETA.
 */
export function consolidateDay(dayPunches: TimePunch[], nowMs?: number): DayConsolidation {
  const first = (t: PunchType) => dayPunches.find((p) => p.type === t)?.at ?? undefined;
  const last = (t: PunchType) => [...dayPunches].reverse().find((p) => p.type === t)?.at ?? undefined;

  const entrada = first('ENTRADA');
  const pausa = first('PAUSA');
  const retorno = first('RETORNO');
  const saida = last('SAIDA');

  const base: DayConsolidation = { entrada, pausa, retorno, saida, workedMs: null, status: 'INCOMPLETA' };

  // Verifica a ordem cronológica das batidas presentes (Entrada < Almoço <
  // Retorno < Saída). Uma sequência fora de ordem é impossível e NÃO deve
  // virar 00h00 silenciosamente.
  const sequence = [entrada, pausa, retorno, saida].filter((v): v is number => v != null);
  for (let i = 1; i < sequence.length; i++) {
    if (sequence[i] <= sequence[i - 1]) {
      return { ...base, status: 'INCONSISTENTE' };
    }
  }

  // Almoço só faz sentido em par (saída para almoço + retorno). Um sem o outro
  // é uma jornada incompleta, não um erro de ordem.
  const lunchBroken = (pausa != null) !== (retorno != null);

  // Jornada completa: entrada e saída presentes, com par de almoço íntegro.
  if (entrada != null && saida != null && !lunchBroken) {
    let ms = 0;
    if (pausa != null && retorno != null) {
      ms = (pausa - entrada) + (saida - retorno);
    } else {
      ms = saida - entrada;
    }
    return { ...base, workedMs: Math.max(0, ms), status: 'OK' };
  }

  // Só entrada (sem saída): jornada de hoje ainda em curso vs. dia passado
  // sem fechamento.
  if (entrada != null && saida == null && pausa == null && retorno == null) {
    if (nowMs != null && dateKeyOf(entrada) === dateKeyOf(nowMs)) {
      return { ...base, status: 'EM_ANDAMENTO' };
    }
    return { ...base, status: 'INCOMPLETA' };
  }

  // Qualquer outra combinação (falta entrada, falta saída, par de almoço
  // quebrado) é incompleta — horas não calculáveis.
  return { ...base, status: 'INCOMPLETA' };
}

/**
 * Agrupa as batidas de UM funcionário por dia e consolida cada dia. Aceita
 * chaves extras (feriados/ocorrências) para incluir dias sem batida.
 */
export function buildDailyTimeRecords(
  punches: TimePunch[],
  opts?: { extraDateKeys?: Iterable<string>; nowMs?: number }
): DailyTimeRecord[] {
  const byDay = new Map<string, TimePunch[]>();
  punches
    .filter((p) => p.at != null)
    .forEach((p) => {
      const dk = dateKeyOf(p.at!);
      if (!byDay.has(dk)) byDay.set(dk, []);
      byDay.get(dk)!.push(p);
    });
  for (const dk of opts?.extraDateKeys ?? []) {
    if (!byDay.has(dk)) byDay.set(dk, []);
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, list]) => {
      const sorted = [...list].sort((a, b) => (a.at || 0) - (b.at || 0));
      const cons = sorted.length ? consolidateDay(sorted, opts?.nowMs) : { workedMs: null, status: 'INCOMPLETA' as DayStatus };
      return { dateKey, punches: sorted, ...cons };
    });
}

export interface PeriodSummary {
  previstoMs: number;
  trabalhadoMs: number;
  saldoMs: number; // trabalhado - previsto, apenas sobre dias trabalhados
}

/**
 * Resumo do período: horas previstas × trabalhadas × saldo. As horas previstas
 * vêm de um resolvedor externo (escala + feriados + atestados), preservando a
 * regra de jornada já existente no sistema.
 */
export function computePeriodSummary(
  records: DailyTimeRecord[],
  expectedMsForDate: (dk: string) => number
): PeriodSummary {
  let previstoMs = 0;
  let trabalhadoMs = 0;
  let saldoMs = 0;
  for (const r of records) {
    const exp = expectedMsForDate(r.dateKey);
    previstoMs += exp;
    if (r.workedMs != null && r.workedMs > 0) {
      trabalhadoMs += r.workedMs;
      saldoMs += r.workedMs - exp;
    }
  }
  return { previstoMs, trabalhadoMs, saldoMs };
}

/** Formata ms como "8h30" (com sinal opcional). */
export const fmtHoursShort = (ms: number, signed = false): string => {
  const sign = ms < 0 ? '-' : signed ? '+' : '';
  const totalMin = Math.round(Math.abs(ms) / 60000);
  return `${sign}${Math.floor(totalMin / 60)}h${pad2(totalMin % 60)}`;
};

/** Formata ms como "08h30min" (ou "—" quando não calculável). */
export const fmtDurationOrDash = (ms: number | null): string => {
  if (ms == null) return '—';
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  return `${pad2(Math.floor(totalMin / 60))}h${pad2(totalMin % 60)}min`;
};
