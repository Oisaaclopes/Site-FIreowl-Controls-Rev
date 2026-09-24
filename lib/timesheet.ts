// Folha consolidada do Ponto — UMA LINHA POR JORNADA (não por batida), mais a
// grade da competência (dias previstos sem registro e dias de ocorrência).
//
// Camada de apresentação sobre o motor canônico (lib/timecard.ts): as jornadas,
// o status e as horas trabalhadas vêm de buildJourneys; a jornada prevista vem
// do resolvedor de escala/feriados/ocorrências de quem chama. Aqui só se
// classifica a situação, monta a grade e localiza cada batida para detalhe e
// correção — nenhum cálculo de jornada é refeito.

import type { PunchAdjustment } from './adjustments';
import { buildJourneys, dateKeyOf, fmtHoursShort, Journey, PeriodSummary } from './timecard';
import { computeNightWork, computeOvertime, DEFAULT_WORK_TIME_RULES, WorkInterval, WorkTimeRules } from './workRules';
import { TimePunch } from './types';

export type PunchType = TimePunch['type'];
export const PUNCH_TYPES: PunchType[] = ['ENTRADA', 'PAUSA', 'RETORNO', 'SAIDA'];

export type JourneySituation =
  // Jornada completa comparada ao previsto (saldo OBJETIVO). "Acima do previsto"
  // NÃO é hora extra: sem política canônica o excedente pode ser banco de horas.
  | 'NORMAL' | 'ACIMA_PREVISTO' | 'CARGA_INFERIOR'
  | 'EM_ANDAMENTO' | 'INCOMPLETA' | 'INCONSISTENTE' | 'ANOMALA'
  // Dia com jornada PREVISTA (escala, sem feriado/folga/atestado) já passado e
  // sem nenhuma batida. Estado objetivo — NÃO é "Falta": distinguir falta,
  // atestado, afastamento etc. é papel da futura camada de Ocorrências.
  | 'SEM_REGISTRO'
  // Dia sem jornada prevista e sem batida, mas com ocorrência (feriado,
  // atestado/folga lançados, observação) — nunca gera horas negativas.
  | 'OCORRENCIA';

export const SITUATION_LABEL: Record<JourneySituation, string> = {
  NORMAL: 'Normal',
  ACIMA_PREVISTO: 'Acima do previsto',
  CARGA_INFERIOR: 'Carga inferior',
  EM_ANDAMENTO: 'Em andamento',
  INCOMPLETA: 'Jornada incompleta',
  INCONSISTENTE: 'Jornada inconsistente',
  ANOMALA: 'Jornada anômala',
  SEM_REGISTRO: 'Sem registro',
  OCORRENCIA: 'Ocorrência',
};

/** Tom visual: ok = neutro/verde · warn = âmbar · bad = vermelho · info = neutro. */
export const SITUATION_TONE: Record<JourneySituation, 'ok' | 'warn' | 'bad' | 'info'> = {
  NORMAL: 'ok',
  ACIMA_PREVISTO: 'warn',
  CARGA_INFERIOR: 'bad',
  EM_ANDAMENTO: 'info',
  INCOMPLETA: 'bad',
  INCONSISTENTE: 'bad',
  ANOMALA: 'bad',
  SEM_REGISTRO: 'bad',
  OCORRENCIA: 'info',
};

// Exigem atenção/regularização. "Sem registro" entra: o dia previsto precisa
// ser tratado (batida incluída ou, no futuro, ocorrência lançada).
const PENDING_SITUATIONS: JourneySituation[] = ['INCOMPLETA', 'INCONSISTENTE', 'ANOMALA', 'SEM_REGISTRO'];
const WORKED_SITUATIONS: JourneySituation[] = ['NORMAL', 'ACIMA_PREVISTO', 'CARGA_INFERIOR'];

export interface TimesheetRow {
  /** Chave estável (competência + 1ª batida). */
  key: string;
  /** YYYY-MM-DD da ENTRADA (competência) — jornada noturna fica no dia em que começou. */
  competenceKey: string;
  journey?: Journey;
  /** Batida efetiva de cada marco (a mesma que o motor usou). */
  slots: Record<PunchType, TimePunch | undefined>;
  /** Batidas da jornada que não ocupam um marco (ex.: 2ª pausa) — só detalhe/correção. */
  extras: TimePunch[];
  workedMs: number | null;
  /** Previsto do dia de competência (atribuído à 1ª jornada do dia). */
  expectedMs: number;
  /** trabalhado − previsto, apenas quando as horas são calculáveis. */
  balanceMs: number | null;
  situation: JourneySituation;
  /** Alguma batida efetiva veio de ajuste aprovado/correção administrativa. */
  adjusted: boolean;
  /** Há solicitação de ajuste PENDENTE do funcionário sobre esta jornada. */
  awaitingCorrection: boolean;
  crossesMidnight: boolean;
  occurrence?: string;
  /** Tempo REAL trabalhado na janela noturna (pausas descontadas). null = não
   *  calculável (jornada sem horas apuráveis). */
  nightWorkedMs: number | null;
  /** Horas noturnas COMPUTADAS pela hora reduzida. null = não calculável. */
  nightComputedMs: number | null;
  /** Hora extraordinária segundo a política. null = NÃO APURÁVEL (sem política
   *  canônica) — o excedente fica só como saldo positivo. */
  overtimeMs: number | null;
  /** Marcadores independentes (não exclusivos) exibidos junto da situação. */
  badges: RowBadge[];
}

/** Badges coexistem: uma jornada pode ser ao mesmo tempo noturna, com hora
 *  extra (quando apurável), ajustada e aguardando correção. */
export type RowBadge = 'ADICIONAL_NOTURNO' | 'HORA_EXTRA' | 'AJUSTADA' | 'AGUARDANDO_CORRECAO';

export const BADGE_LABEL: Record<RowBadge, string> = {
  ADICIONAL_NOTURNO: 'Adicional noturno',
  HORA_EXTRA: 'Hora extra',
  AJUSTADA: 'Ajustada',
  AGUARDANDO_CORRECAO: 'Aguardando correção',
};

export type TimesheetFilter = 'TODOS' | 'PENDENCIA' | 'HORA_EXTRA' | 'NOTURNO' | 'CARGA_INFERIOR' | 'AJUSTADOS';

export const FILTER_LABEL: Record<TimesheetFilter, string> = {
  TODOS: 'Todos',
  PENDENCIA: 'Com pendência',
  HORA_EXTRA: 'Hora extra',
  NOTURNO: 'Adicional noturno',
  CARGA_INFERIOR: 'Carga inferior',
  AJUSTADOS: 'Ajustados',
};

/**
 * Filtros oferecidos. "Hora extra" só existe quando há política canônica de
 * hora extra — sem ela, saldo positivo NÃO é transformado em hora extra só
 * para preencher o filtro.
 */
export function availableFilters(rules: WorkTimeRules = DEFAULT_WORK_TIME_RULES): TimesheetFilter[] {
  const all: TimesheetFilter[] = ['TODOS', 'PENDENCIA', 'HORA_EXTRA', 'NOTURNO', 'CARGA_INFERIOR', 'AJUSTADOS'];
  return rules.overtime ? all : all.filter((f) => f !== 'HORA_EXTRA');
}

export const rowHasPendency = (r: TimesheetRow): boolean =>
  PENDING_SITUATIONS.includes(r.situation) || r.awaitingCorrection;

export function filterTimesheetRows(rows: TimesheetRow[], filter: TimesheetFilter): TimesheetRow[] {
  switch (filter) {
    case 'PENDENCIA': return rows.filter(rowHasPendency);
    case 'HORA_EXTRA': return rows.filter((r) => (r.overtimeMs ?? 0) > 0);
    case 'NOTURNO': return rows.filter((r) => (r.nightWorkedMs ?? 0) > 0);
    case 'CARGA_INFERIOR': return rows.filter((r) => r.situation === 'CARGA_INFERIOR');
    case 'AJUSTADOS': return rows.filter((r) => r.adjusted);
    default: return rows;
  }
}

/** Intervalos EFETIVOS de trabalho de uma jornada completa (pausa excluída). */
function workIntervals(j: Journey): WorkInterval[] | null {
  if (j.status !== 'OK' || j.entrada == null || j.saida == null) return null;
  return j.pausa != null && j.retorno != null
    ? [{ start: j.entrada, end: j.pausa }, { start: j.retorno, end: j.saida }]
    : [{ start: j.entrada, end: j.saida }];
}

function badgesOf(r: Pick<TimesheetRow, 'nightWorkedMs' | 'overtimeMs' | 'adjusted' | 'awaitingCorrection'>): RowBadge[] {
  const b: RowBadge[] = [];
  if ((r.nightWorkedMs ?? 0) > 0) b.push('ADICIONAL_NOTURNO');
  if ((r.overtimeMs ?? 0) > 0) b.push('HORA_EXTRA');
  if (r.adjusted) b.push('AJUSTADA');
  if (r.awaitingCorrection) b.push('AGUARDANDO_CORRECAO');
  return b;
}

// Comparação OBJETIVA com o previsto, em minutos inteiros (a mesma precisão
// exibida) — o sistema não tem regra de tolerância configurada.
// FUTURO: haverá uma configuração CANÔNICA de tolerância de jornada (fonte
// única, persistida). Ela entra aqui como parâmetro — nunca um 5/10/15 min fixo.
const toMin = (ms: number) => Math.floor(ms / 60000);

function classify(status: Journey['status'], dayWorkedMs: number | null, dayExpectedMs: number): JourneySituation {
  switch (status) {
    case 'ABERTA_ANOMALA': return 'ANOMALA';
    case 'INCONSISTENTE': return 'INCONSISTENTE';
    case 'INCOMPLETA': return 'INCOMPLETA';
    case 'EM_ANDAMENTO': return 'EM_ANDAMENTO';
    default: {
      const worked = toMin(dayWorkedMs ?? 0);
      const expected = Math.round(dayExpectedMs / 60000);
      return worked > expected ? 'ACIMA_PREVISTO' : worked < expected ? 'CARGA_INFERIOR' : 'NORMAL';
    }
  }
}

function locateSlots(j: Journey): { slots: TimesheetRow['slots']; extras: TimePunch[] } {
  const marks: Record<PunchType, number | undefined> = {
    ENTRADA: j.entrada, PAUSA: j.pausa, RETORNO: j.retorno, SAIDA: j.saida,
  };
  const slots = { ENTRADA: undefined, PAUSA: undefined, RETORNO: undefined, SAIDA: undefined } as TimesheetRow['slots'];
  const extras: TimePunch[] = [];
  for (const p of [...j.punches].sort((a, b) => (a.at || 0) - (b.at || 0))) {
    if (!slots[p.type] && marks[p.type] != null && p.at === marks[p.type]) slots[p.type] = p;
    else extras.push(p);
  }
  return { slots, extras };
}

const journeyDates = (j: Journey): Set<string> =>
  new Set([j.competenceKey, ...j.punches.filter((p) => p.at != null).map((p) => dateKeyOf(p.at!))]);

function awaiting(j: Journey, pending: PunchAdjustment[]): boolean {
  if (!pending.length) return false;
  const ids = new Set(j.punches.map((p) => p.id));
  const dates = journeyDates(j);
  return pending.some((a) => (a.originalPunchId && ids.has(a.originalPunchId)) || dates.has(a.refDate));
}

export interface TimesheetOptions {
  /** YYYY-MM — recorte por competência (dia da ENTRADA). */
  monthKey: string;
  nowMs: number;
  expectedMsForDate: (dateKey: string) => number;
  /** Ocorrências do mês (feriado/atestado/folga/obs.) por YYYY-MM-DD. */
  occurrences?: Record<string, string>;
  /** Ajustes do funcionário — só os PENDENTES marcam "aguardando correção". */
  adjustments?: PunchAdjustment[];
  /**
   * Início da apuração (YYYY-MM-DD): dias previstos ANTES dele nunca viram
   * "Sem registro" (o funcionário ainda não usava o ponto). Ausente = início
   * desconhecido → nenhum dia é presumido "Sem registro". Ver
   * resolveTrackingStartKey.
   */
  trackingStartKey?: string;
  maxOpenMs?: number;
  /** Regras de apuração (noturno/hora extra). Ausente = padrão central. */
  rules?: WorkTimeRules;
}

/**
 * Início da apuração enquanto não existe um campo canônico no cadastro: a data
 * da PRIMEIRA batida original do funcionário no servidor (evidência real de
 * uso), ou a batida efetiva mais antiga conhecida se for anterior (ex.:
 * inclusão administrativa). Sem nenhuma batida → indefinido (conservador).
 */
export function resolveTrackingStartKey(firstOriginalAtMs: number | undefined, knownPunches: TimePunch[]): string | undefined {
  const known = knownPunches.reduce<number | undefined>((min, p) => (p.at != null && (min == null || p.at < min) ? p.at : min), undefined);
  const candidates = [firstOriginalAtMs, known].filter((v): v is number => v != null);
  return candidates.length ? dateKeyOf(Math.min(...candidates)) : undefined;
}

/** Linhas da folha de UM funcionário (batidas efetivas dele). */
export function buildTimesheetRows(punches: TimePunch[], opts: TimesheetOptions): TimesheetRow[] {
  const journeys = buildJourneys(punches, { nowMs: opts.nowMs, maxOpenMs: opts.maxOpenMs })
    .filter((j) => j.competenceKey.startsWith(opts.monthKey));
  const pending = (opts.adjustments || []).filter((a) => a.status === 'PENDENTE');
  const occurrences = opts.occurrences || {};
  const rules = opts.rules || DEFAULT_WORK_TIME_RULES;
  // Sem política canônica de hora extra, a apuração é "não apurável" (null).
  const noOvertime = rules.overtime ? 0 : null;

  const byDay = new Map<string, Journey[]>();
  for (const j of journeys) byDay.set(j.competenceKey, [...(byDay.get(j.competenceKey) || []), j]);

  const rows: TimesheetRow[] = [];
  for (const [dk, list] of byDay) {
    const expected = opts.expectedMsForDate(dk);
    const okWorked = list.filter((j) => j.status === 'OK').map((j) => j.workedMs ?? 0);
    const dayWorked = okWorked.length ? okWorked.reduce((a, b) => a + b, 0) : null;
    list.forEach((j, i) => {
      const allocated = i === 0 ? expected : 0;
      const { slots, extras } = locateSlots(j);
      const balanceMs = j.workedMs != null ? j.workedMs - allocated : null;
      // Trabalho noturno pelas batidas EFETIVAS (ajustes já aplicados), com a
      // pausa excluída; só em jornada com horas apuráveis.
      const intervals = workIntervals(j);
      const night = intervals ? computeNightWork(intervals, rules.night) : null;
      const row = {
        key: `${dk}|${j.punches[0]?.id ?? i}`,
        competenceKey: dk,
        journey: j,
        slots,
        extras,
        workedMs: j.workedMs,
        expectedMs: allocated,
        balanceMs,
        situation: classify(j.status, dayWorked, expected),
        adjusted: j.punches.some((p) => p.effectiveSource === 'adjusted'),
        awaitingCorrection: awaiting(j, pending),
        crossesMidnight: !!j.crossesMidnight,
        occurrence: i === 0 ? occurrences[dk] : undefined,
        nightWorkedMs: night ? night.realMs : null,
        nightComputedMs: night ? night.computedMs : null,
        overtimeMs: intervals ? computeOvertime(balanceMs, rules.overtime) : noOvertime,
      };
      rows.push({ ...row, badges: badgesOf(row) });
    });
  }
  // Grade da competência: dias SEM jornada. A jornada prevista vem do mesmo
  // resolvedor da folha (escala do funcionário − feriado − folga/atestado
  // lançados). Só dias já passados E a partir do início da apuração geram
  // "Sem registro"; hoje e o futuro não (a jornada ainda pode acontecer), nem
  // o período anterior ao uso do ponto. Folga de escala sem ocorrência não
  // gera linha — e nunca horas negativas.
  const todayKey = dateKeyOf(opts.nowMs);
  const tracked = (dk: string) => opts.trackingStartKey != null && dk >= opts.trackingStartKey && dk < todayKey;
  for (const dk of monthDateKeys(opts.monthKey)) {
    if (byDay.has(dk)) continue;
    const text = occurrences[dk];
    const expected = opts.expectedMsForDate(dk);
    const base = {
      competenceKey: dk,
      slots: { ENTRADA: undefined, PAUSA: undefined, RETORNO: undefined, SAIDA: undefined },
      extras: [],
      adjusted: false,
      awaitingCorrection: pending.some((a) => a.refDate === dk),
      crossesMidnight: false,
      occurrence: text,
      nightWorkedMs: null,
      nightComputedMs: null,
      overtimeMs: noOvertime,
      badges: pending.some((a) => a.refDate === dk) ? ['AGUARDANDO_CORRECAO' as const] : [],
    };
    if (expected > 0 && tracked(dk)) {
      rows.push({ ...base, key: `${dk}|sem-registro`, workedMs: 0, expectedMs: expected, balanceMs: -expected, situation: 'SEM_REGISTRO' });
    } else if (text) {
      // Ocorrência sem jornada prevista (feriado/folga/atestado) ou ainda por vir:
      // não entra no previsto nem no saldo.
      rows.push({ ...base, key: `${dk}|ocorrencia`, workedMs: null, expectedMs: 0, balanceMs: null, situation: 'OCORRENCIA' });
    }
  }
  return rows.sort((a, b) => a.competenceKey.localeCompare(b.competenceKey)
    || (a.journey?.entrada ?? a.journey?.punches[0]?.at ?? 0) - (b.journey?.entrada ?? b.journey?.punches[0]?.at ?? 0));
}

/** Todas as datas YYYY-MM-DD de uma competência YYYY-MM. */
export function monthDateKeys(monthKey: string): string[] {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return [];
  const last = new Date(y, m, 0).getDate();
  return Array.from({ length: last }, (_, i) => `${monthKey}-${String(i + 1).padStart(2, '0')}`);
}

/**
 * Totais da folha a partir das PRÓPRIAS linhas (grade completa):
 *   previsto   = Σ previsto de cada linha (jornadas + dias "Sem registro");
 *   trabalhado = Σ horas das jornadas calculáveis;
 *   saldo      = Σ saldo das linhas calculáveis (jornadas completas e dias
 *                "Sem registro" = −previsto). Jornada incompleta/anômala/em
 *                andamento não entra no saldo (horas não calculáveis) e fica
 *                como pendência. Ocorrência/folga/feriado: zero.
 */
export interface TimesheetSummary extends PeriodSummary {
  /** Hora extra do período; null = NÃO APURÁVEL (sem política canônica). */
  overtimeMs: number | null;
  /** Tempo REAL de trabalho noturno do período. */
  nightWorkedMs: number;
  /** Horas noturnas COMPUTADAS (hora reduzida) do período. */
  nightComputedMs: number;
  /** Linhas que exigem atenção. */
  pendencies: number;
}

/**
 * Totais da folha a partir das PRÓPRIAS linhas — a mesma fonte da tela, do
 * PDF e do Excel. Noturno soma as jornadas apuráveis; hora extra só existe
 * quando as linhas foram apuradas com política (senão null).
 */
export function summarizeTimesheetRows(rows: TimesheetRow[]): TimesheetSummary {
  let previstoMs = 0;
  let trabalhadoMs = 0;
  let saldoMs = 0;
  let nightWorkedMs = 0;
  let nightComputedMs = 0;
  let overtimeMs: number | null = null;
  let pendencies = 0;
  for (const r of rows) {
    previstoMs += r.expectedMs;
    if (WORKED_SITUATIONS.includes(r.situation) && r.workedMs != null) trabalhadoMs += r.workedMs;
    if (r.balanceMs != null) saldoMs += r.balanceMs;
    nightWorkedMs += r.nightWorkedMs ?? 0;
    nightComputedMs += r.nightComputedMs ?? 0;
    if (r.overtimeMs != null) overtimeMs = (overtimeMs ?? 0) + r.overtimeMs;
    if (rowHasPendency(r)) pendencies++;
  }
  return { previstoMs, trabalhadoMs, saldoMs, overtimeMs, nightWorkedMs, nightComputedMs, pendencies };
}

export interface EmployeeMonthSummary extends TimesheetSummary {
  employee: string;
  journeys: number;
}

/**
 * Resumo do mês de UM funcionário (visão Equipe e cabeçalho da Folha) — os
 * MESMOS totais das linhas exibidas; pendências = linhas que exigem atenção.
 */
export function summarizeEmployeeMonth(employee: string, punches: TimePunch[], opts: TimesheetOptions): EmployeeMonthSummary {
  const rows = buildTimesheetRows(punches, opts);
  return {
    employee,
    ...summarizeTimesheetRows(rows),
    journeys: rows.filter((r) => r.journey).length,
  };
}

/** Linha de documento (PDF/Excel) — derivada 1:1 das MESMAS linhas da Folha. */
export interface TimesheetDocLine {
  dateKey: string;
  entrada?: number;
  pausa?: number;
  retorno?: number;
  saida?: number;
  /** Saída em dia civil posterior à competência (jornada noturna) → "(+1)". */
  saidaNextDay: boolean;
  workedMs: number | null;
  expectedMs: number;
  balanceMs: number | null;
  situation: JourneySituation;
  /** Trabalho noturno real / computado (hora reduzida); null = não calculável. */
  nightWorkedMs: number | null;
  nightComputedMs: number | null;
  /** Hora extra; null = não apurável (sem política). */
  overtimeMs: number | null;
  /** Texto da coluna Ocorrência (situação + ocorrência + noturno + ajuste). */
  label: string;
  tone: 'none' | 'warn' | 'info';
}

/**
 * Converte as linhas da Folha para os documentos exportados. Nada é recalculado:
 * horários, horas, previsto, saldo e situação são exatamente os da tela.
 */
export function toDocumentLines(rows: TimesheetRow[]): TimesheetDocLine[] {
  return rows.map((r) => {
    const tone = SITUATION_TONE[r.situation];
    const situationText = r.situation === 'NORMAL' ? ''
      : r.situation === 'OCORRENCIA' ? (r.occurrence || SITUATION_LABEL.OCORRENCIA)
      : SITUATION_LABEL[r.situation];
    const label = [
      situationText,
      r.situation !== 'OCORRENCIA' ? r.occurrence : undefined,
      (r.nightWorkedMs ?? 0) > 0 ? `Trabalho noturno ${fmtHoursShort(r.nightWorkedMs!)}` : undefined,
      (r.overtimeMs ?? 0) > 0 ? `Hora extra ${fmtHoursShort(r.overtimeMs!)}` : undefined,
      r.adjusted ? 'Ajuste aprovado' : undefined,
      r.awaitingCorrection ? 'Aguardando correção' : undefined,
    ].filter(Boolean).join(' · ');
    const saida = r.slots.SAIDA?.at;
    return {
      dateKey: r.competenceKey,
      entrada: r.slots.ENTRADA?.at,
      pausa: r.slots.PAUSA?.at,
      retorno: r.slots.RETORNO?.at,
      saida,
      saidaNextDay: saida != null && dateKeyOf(saida) !== r.competenceKey,
      workedMs: r.workedMs,
      expectedMs: r.expectedMs,
      balanceMs: r.balanceMs,
      situation: r.situation,
      nightWorkedMs: r.nightWorkedMs,
      nightComputedMs: r.nightComputedMs,
      overtimeMs: r.overtimeMs,
      label,
      tone: tone === 'bad' ? 'warn' : tone === 'ok' ? (r.badges.length ? 'info' : 'none') : 'info',
    };
  });
}
