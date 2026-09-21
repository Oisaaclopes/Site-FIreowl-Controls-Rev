// Fonte de verdade única para consolidação do ponto (Espelho de Ponto).
//
// Este módulo NÃO altera dados: apenas consolida as batidas em registros
// diários, classificando cada dia e calculando as horas trabalhadas SOMENTE
// quando há informação suficiente e cronologicamente válida. A tela "Meu
// Espelho", a folha administrativa e o PDF consomem o MESMO resultado — nunca
// recalculam a jornada por conta própria.

import { TimePunch } from './types';

export type PunchType = TimePunch['type'];

// OK             — jornada completa e cronologicamente válida (horas calculadas).
// EM_ANDAMENTO   — entrada registrada, jornada ainda em curso (dentro da janela de
//                  segurança), mesmo que a entrada tenha sido em um dia anterior.
// ABERTA_ANOMALA — jornada aberta há mais tempo que a janela de segurança (ex.:
//                  >18h): provavelmente esquecida. NÃO inventamos saída — sinaliza
//                  para revisão administrativa.
// INCOMPLETA     — faltam batidas necessárias para fechar a jornada.
// INCONSISTENTE  — as batidas existem mas violam a ordem Entrada < Almoço <
//                  Retorno < Saída (impossível cronologicamente).
export type DayStatus = 'OK' | 'EM_ANDAMENTO' | 'ABERTA_ANOMALA' | 'INCOMPLETA' | 'INCONSISTENTE';

/** Janela de segurança padrão: uma jornada aberta por mais que isto é tratada
 *  como "possivelmente incompleta" (revisão administrativa), nunca fechada
 *  automaticamente nem com saída inventada. */
export const OPEN_JOURNEY_LIMIT_MS = 18 * 60 * 60 * 1000; // 18h

export interface DayConsolidation {
  entrada?: number; // epoch ms
  pausa?: number;
  retorno?: number;
  saida?: number;
  /** Horas trabalhadas em ms — null quando NÃO é calculável (não presumir 0). */
  workedMs: number | null;
  status: DayStatus;
  /** true quando a saída (ou o "agora", se aberta) cai em dia civil posterior à entrada. */
  crossesMidnight?: boolean;
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
    case 'ABERTA_ANOMALA':
      return 'Jornada possivelmente incompleta';
    case 'EM_ANDAMENTO':
      return 'Em andamento';
    default:
      return '';
  }
};

/** Uma JORNADA: sequência cronológica Entrada→[Almoço→Retorno]→Saída que pode
 *  atravessar a meia-noite. A competência (dia administrativo) é a data da
 *  ENTRADA; cada batida preserva o seu timestamp real. */
export interface Journey extends DayConsolidation {
  /** YYYY-MM-DD da ENTRADA (ou da 1ª batida, quando órfã) — dia de competência. */
  competenceKey: string;
  punches: TimePunch[];
}

// Núcleo de cálculo de UMA jornada já isolada. Usa timestamps completos (epoch
// ms) — nunca "hora_fim - hora_inicio" — então uma saída no dia seguinte soma
// normalmente. A DATA CIVIL não encerra a jornada.
function finalizeConsolidation(
  entrada: number | undefined, pausa: number | undefined,
  retorno: number | undefined, saida: number | undefined,
  nowMs?: number, maxOpenMs: number = OPEN_JOURNEY_LIMIT_MS,
): DayConsolidation {
  const crossesMidnight =
    entrada != null && (saida != null
      ? dateKeyOf(saida) !== dateKeyOf(entrada)
      : nowMs != null && dateKeyOf(nowMs) !== dateKeyOf(entrada));
  const base: DayConsolidation = { entrada, pausa, retorno, saida, workedMs: null, status: 'INCOMPLETA', crossesMidnight };

  // Ordem cronológica das batidas presentes (Entrada < Almoço < Retorno < Saída).
  // Fora de ordem é impossível e NÃO deve virar 00h00 silenciosamente.
  const sequence = [entrada, pausa, retorno, saida].filter((v): v is number => v != null);
  for (let i = 1; i < sequence.length; i++) {
    if (sequence[i] <= sequence[i - 1]) return { ...base, status: 'INCONSISTENTE' };
  }

  // Almoço só faz sentido em par (saída para almoço + retorno).
  const lunchBroken = (pausa != null) !== (retorno != null);

  // Jornada completa: entrada e saída presentes, com par de almoço íntegro.
  if (entrada != null && saida != null && !lunchBroken) {
    const ms = (pausa != null && retorno != null)
      ? (pausa - entrada) + (saida - retorno)
      : (saida - entrada);
    return { ...base, workedMs: Math.max(0, ms), status: 'OK' };
  }

  // Só entrada (sem saída): jornada em curso. Continua EM_ANDAMENTO enquanto
  // estiver dentro da janela de segurança, MESMO que a entrada tenha sido ontem.
  // Além da janela → possivelmente incompleta (revisão), nunca fechada nem com
  // saída inventada.
  if (entrada != null && saida == null && pausa == null && retorno == null) {
    if (nowMs != null) return { ...base, status: (nowMs - entrada) > maxOpenMs ? 'ABERTA_ANOMALA' : 'EM_ANDAMENTO' };
    return { ...base, status: 'INCOMPLETA' };
  }

  // Qualquer outra combinação (falta entrada, par de almoço quebrado) é
  // incompleta — horas não calculáveis.
  return { ...base, status: 'INCOMPLETA' };
}

// Pior status prevalece ao fundir várias jornadas de um mesmo dia de competência.
const STATUS_RANK: Record<DayStatus, number> = {
  INCONSISTENTE: 4, ABERTA_ANOMALA: 3, INCOMPLETA: 2, EM_ANDAMENTO: 1, OK: 0,
};

function mergeConsolidations(list: DayConsolidation[]): DayConsolidation {
  if (list.length === 1) return list[0];
  const worked = list.map((c) => c.workedMs).filter((v): v is number => v != null);
  return {
    entrada: list.find((c) => c.entrada != null)?.entrada,
    pausa: list.find((c) => c.pausa != null)?.pausa,
    retorno: list.find((c) => c.retorno != null)?.retorno,
    saida: [...list].reverse().find((c) => c.saida != null)?.saida,
    workedMs: worked.length ? worked.reduce((a, b) => a + b, 0) : null,
    status: list.reduce<DayStatus>((worst, c) => (STATUS_RANK[c.status] > STATUS_RANK[worst] ? c.status : worst), 'OK'),
    crossesMidnight: list.some((c) => c.crossesMidnight),
  };
}

/**
 * Constrói as JORNADAS de um funcionário a partir da sequência cronológica das
 * batidas (ordena por timestamp). Uma jornada abre na ENTRADA e fecha na SAÍDA
 * (podendo atravessar a meia-noite/mês/ano). Convenção mantida: primeira PAUSA/
 * RETORNO da jornada; a ENTRADA seguinte encerra a jornada anterior ainda aberta.
 */
export function buildJourneys(
  punches: TimePunch[],
  opts?: { nowMs?: number; maxOpenMs?: number },
): Journey[] {
  const sorted = punches.filter((p) => p.at != null).sort((a, b) => (a.at || 0) - (b.at || 0));
  const journeys: Journey[] = [];
  let cur: { entrada?: number; pausa?: number; retorno?: number; saida?: number; punches: TimePunch[]; orphan?: boolean } | null = null;

  const flush = () => {
    if (!cur) return;
    const keyAt = cur.entrada ?? cur.punches[0]?.at ?? undefined;
    let cons = finalizeConsolidation(cur.entrada, cur.pausa, cur.retorno, cur.saida, opts?.nowMs, opts?.maxOpenMs);
    // Almoço/retorno sem entrada aberta é cronologicamente impossível (ex.: um
    // RETORNO registrado após a SAÍDA da jornada) → inconsistente, não 00h00.
    if (cur.orphan) cons = { ...cons, workedMs: null, status: 'INCONSISTENTE' };
    journeys.push({ ...cons, competenceKey: keyAt != null ? dateKeyOf(keyAt) : '', punches: cur.punches });
    cur = null;
  };

  for (const p of sorted) {
    if (p.type === 'ENTRADA') {
      if (cur) flush();               // entrada nova encerra a jornada anterior (aberta/órfã)
      cur = { entrada: p.at!, punches: [p] };
    } else if (p.type === 'SAIDA') {
      if (!cur) cur = { punches: [] }; // saída órfã → jornada só-saída (incompleta)
      cur.saida = p.at!;
      cur.punches.push(p);
      flush();                        // a saída encerra a jornada
    } else {                          // PAUSA | RETORNO
      if (!cur || cur.entrada == null) {
        if (!cur) cur = { punches: [] };
        cur.orphan = true;            // pausa/retorno sem entrada aberta → impossível
      }
      if (p.type === 'PAUSA' && cur.pausa == null) cur.pausa = p.at!;
      if (p.type === 'RETORNO' && cur.retorno == null) cur.retorno = p.at!;
      cur.punches.push(p);
    }
  }
  flush();
  return journeys;
}

/**
 * Consolida as batidas de UMA jornada/dia (mesmo funcionário). Baseado em
 * jornada cronológica: uma saída no dia seguinte fecha a entrada do dia anterior
 * e as horas somam com timestamps completos. Convenção mantida: primeira PAUSA/
 * RETORNO, última SAÍDA.
 *
 * @param nowMs quando informado, uma jornada só-com-entrada é EM_ANDAMENTO
 *   (dentro da janela de segurança) ou ABERTA_ANOMALA (além dela) — nunca fecha.
 */
export function consolidateDay(dayPunches: TimePunch[], nowMs?: number): DayConsolidation {
  const journeys = buildJourneys(dayPunches, { nowMs });
  if (journeys.length === 0) return { workedMs: null, status: 'INCOMPLETA' };
  return mergeConsolidations(journeys.map(({ competenceKey, punches, ...cons }) => cons));
}

/**
 * Agrupa as batidas de UM funcionário por JORNADA (não por dia civil) e consolida
 * cada uma, indexando pela data de competência (dia da ENTRADA). Uma jornada que
 * atravessa a meia-noite/mês fica inteira no dia em que começou — contada uma
 * única vez. Aceita chaves extras (feriados/ocorrências) para incluir dias sem
 * batida e `monthKey` (YYYY-MM) para recortar por competência sem partir jornadas.
 */
export function buildDailyTimeRecords(
  punches: TimePunch[],
  opts?: { extraDateKeys?: Iterable<string>; nowMs?: number; monthKey?: string; maxOpenMs?: number }
): DailyTimeRecord[] {
  const journeys = buildJourneys(punches, { nowMs: opts?.nowMs, maxOpenMs: opts?.maxOpenMs });
  const scoped = opts?.monthKey ? journeys.filter((j) => j.competenceKey.startsWith(opts.monthKey!)) : journeys;

  const byDay = new Map<string, Journey[]>();
  for (const j of scoped) {
    if (!j.competenceKey) continue;
    const bucket = byDay.get(j.competenceKey);
    if (bucket) bucket.push(j);
    else byDay.set(j.competenceKey, [j]);
  }
  for (const dk of opts?.extraDateKeys ?? []) {
    if (!byDay.has(dk)) byDay.set(dk, []);
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, list]) => {
      const punchesOfDay = list.flatMap((j) => j.punches).sort((a, b) => (a.at || 0) - (b.at || 0));
      const cons = list.length
        ? mergeConsolidations(list.map(({ competenceKey, punches, ...c }) => c))
        : { workedMs: null, status: 'INCOMPLETA' as DayStatus };
      return { dateKey, punches: punchesOfDay, ...cons };
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
