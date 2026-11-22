// Motor compartilhado de registro de ponto — a MESMA regra usada no PontoView,
// extraída para reuso (Dashboard do técnico). NÃO é um segundo motor: o
// PontoView e o TechDashboard consomem estas funções; a persistência continua
// sendo o onAddPunch (handleAddPunch no CrmApp → insertPunch).

import { TimePunch } from './types';
import { buildJourneys, dateKeyOf, isJourneyStale, Journey, OPEN_JOURNEY_LIMIT_MS } from './timecard';

export type PunchType = TimePunch['type'];

/** Resultado do registro de uma batida (handleAddPunch no CrmApp):
 *  'saved'  = confirmada no servidor;
 *  'queued' = sem conexão — guardada no aparelho e reenviada automaticamente;
 *  'busy'   = já havia uma batida sendo registrada (toque duplo ignorado). */
export type PunchSaveResult = 'saved' | 'queued' | 'busy' | 'stale';

/** Intervalo mínimo esperado entre duas batidas da mesma jornada. */
export const QUICK_REPUNCH_MS = 2 * 60 * 1000;

/**
 * Batida logo após a anterior (ex.: Almoço e Retorno com 15s de diferença)
 * quase sempre é toque repetido ou botão errado. Retorna a mensagem de
 * confirmação, ou null quando não há motivo para perguntar.
 */
export function quickRepunchWarning(state: Pick<PunchDayState, 'todays' | 'nextType'>, nowMs: number): string | null {
  if (!state.nextType) return null;
  const last = state.todays.reduce<TimePunch | undefined>((m, p) => (p.at != null && (!m || p.at > (m.at || 0)) ? p : m), undefined);
  if (!last?.at || nowMs - last.at >= QUICK_REPUNCH_MS || nowMs < last.at) return null;
  const secs = Math.max(1, Math.round((nowMs - last.at) / 1000));
  const ago = secs < 60 ? `${secs}s` : `${Math.round(secs / 60)} min`;
  return `Sua última batida (${PUNCH_SHORT[last.type]}) foi há ${ago}.\n\nRegistrar agora "${PUNCH_SHORT[state.nextType]}"?`;
}
export type AddPunchHandler = (p: TimePunch) => Promise<PunchSaveResult> | void;

/** GPS da batida: alta precisão, aceita posição de até 30s (evita espera longa
 *  em ambiente fechado) e desiste em 10s — a batida segue sem localização. */
export const PUNCH_GPS_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 };

const pad2 = (n: number) => n.toString().padStart(2, '0');
const fmtClock = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

export const PUNCH_LABEL: Record<PunchType, string> = {
  ENTRADA: 'Registrar Entrada',
  PAUSA: 'Registrar Saída para Almoço',
  RETORNO: 'Registrar Retorno',
  SAIDA: 'Registrar Saída',
};

export const PUNCH_DONE: Record<PunchType, string> = {
  ENTRADA: 'Entrada registrada',
  PAUSA: 'Saída para almoço registrada',
  RETORNO: 'Retorno registrado',
  SAIDA: 'Saída registrada',
};

interface OperationalJourneys {
  /** Jornada ABERTA operante: a última, com entrada, sem saída e DENTRO da
   *  janela de segurança (18h) — mesmo iniciada ontem. */
  open?: Journey;
  /** Jornada exibida no card: a aberta ou, na ausência, a encerrada cuja
   *  competência (dia da entrada) é hoje. */
  current?: Journey;
  /** Jornadas com entrada e sem saída que NÃO são a operante (esquecidas,
   *  além de 18h, ou encerradas por uma nova entrada) — pendências para
   *  regularização. Nunca fechadas nem com saída inventada. */
  pending: Journey[];
  /** Jornadas (ou batidas soltas) com competência HOJE. */
  todays: Journey[];
}

/**
 * Dono das batidas. `userId` é a identidade canônica; o nome é só apresentação
 * (snapshot textual gravado na batida) e serve apenas de fallback para batidas
 * sem user_id (reserva local offline). Uma string é tratada como nome (legado).
 */
export type PunchOwner = string | { userId?: string; name: string };

export function isPunchOf(p: TimePunch, who: PunchOwner): boolean {
  if (typeof who === 'string') return p.employeeName === who;
  if (who.userId) return p.userId ? p.userId === who.userId : p.employeeName === who.name;
  return p.employeeName === who.name;
}

/**
 * Regra ÚNICA da máquina de estados operacional. Uma jornada aberta há mais
 * de 18h (ABERTA_ANOMALA) NÃO sequestra o estado: vira pendência e o
 * funcionário pode abrir uma nova Entrada. A data civil não altera a sequência.
 */
function resolveOperationalJourneys(
  punches: TimePunch[], who: PunchOwner, nowMs: number, maxOpenMs: number,
): OperationalJourneys {
  const mine = punches.filter((p) => isPunchOf(p, who) && p.at);
  const journeys = buildJourneys(mine, { nowMs, maxOpenMs });
  const last = journeys[journeys.length - 1];
  const open = last && last.entrada != null && last.saida == null && !isJourneyStale(last.entrada, nowMs, maxOpenMs)
    ? last
    : undefined;
  const closedToday = last && last.entrada != null && last.saida != null && last.competenceKey === dateKeyOf(nowMs)
    ? last
    : undefined;
  const pending = journeys.filter((j) => j !== open && j.entrada != null && j.saida == null);
  const today = dateKeyOf(nowMs);
  return { open, current: open ?? closedToday, pending, todays: journeys.filter((j) => j.competenceKey === today) };
}

/**
 * Abrir uma NOVA jornada exige pergunta + motivo quando o funcionário já tem
 * jornada (ou qualquer batida) com competência HOJE e nenhuma jornada aberta.
 * Evita jornadas abertas sem querer (toque repetido, tela desatualizada —
 * caso 13/11). Uma entrada esquecida de outro dia não exige motivo.
 */
export function needsNewJourneyReason(
  punches: TimePunch[], who: PunchOwner, nowMs: number, maxOpenMs: number = OPEN_JOURNEY_LIMIT_MS,
): boolean {
  const { open, todays } = resolveOperationalJourneys(punches, who, nowMs, maxOpenMs);
  return !open && todays.length > 0;
}

/** Resumo das jornadas de hoje para a pergunta ("08:18–17:02"). */
function summarizeTodayJourneys(todays: Journey[]): string {
  const hm = (at?: number) => (at != null ? fmtClock(new Date(at)).slice(0, 5) : '--:--');
  return todays.map((j) => `${hm(j.entrada ?? j.punches[0]?.at)}–${j.saida != null ? hm(j.saida) : 'sem saída'}`).join(', ');
}

/** Mínimo de caracteres do motivo de nova jornada (o banco exige 3). */
export const NEW_JOURNEY_REASON_MIN = 5;

/**
 * Próxima batida da sequência ENTRADA→PAUSA→RETORNO→SAIDA, seguindo a JORNADA
 * ABERTA (não "batidas de hoje"). Se existe uma entrada aberta há ≤18h — mesmo
 * que de ontem — a próxima ação respeita essa jornada; a meia-noite não reabre
 * a sequência. Entrada aberta há >18h é pendência e não bloqueia nova Entrada.
 */
export function nextPunchType(
  punches: TimePunch[], who: PunchOwner, nowMs: number, maxOpenMs: number = OPEN_JOURNEY_LIMIT_MS,
): PunchType | null {
  const { open, current } = resolveOperationalJourneys(punches, who, nowMs, maxOpenMs);
  if (open) {
    if (open.pausa == null && open.retorno == null) return 'PAUSA';
    if (open.retorno == null) return 'RETORNO';
    return 'SAIDA';
  }
  // Sem jornada aberta: se a jornada de HOJE (competência) já fechou, está
  // encerrada (null); caso contrário, a próxima ação é abrir uma nova Entrada.
  return current ? null : 'ENTRADA';
}

/** Rótulo curto do TIPO da próxima batida (para o texto "Próxima batida"). */
export const PUNCH_SHORT: Record<PunchType, string> = {
  ENTRADA: 'Entrada',
  PAUSA: 'Saída para almoço',
  RETORNO: 'Retorno do almoço',
  SAIDA: 'Saída',
};

export type PunchStatusKind = 'FORA' | 'TRABALHANDO' | 'ALMOCO' | 'ENCERRADA';

export interface PunchDayState {
  /** Batidas da JORNADA corrente (a aberta, mesmo iniciada ontem, ou a encerrada
   *  hoje), ordenadas por horário — batidas efetivas. */
  todays: TimePunch[];
  /** Marcas do dia (batidas efetivas — ajustes aprovados já vêm aplicados na fonte). */
  entrada?: TimePunch;
  almoco?: TimePunch;
  retorno?: TimePunch;
  saida?: TimePunch;
  /** Próxima batida esperada (null = jornada encerrada). */
  nextType: PunchType | null;
  statusKind: PunchStatusKind;
  statusLabel: string;
  /** Última marca relevante do dia (para exibição compacta). */
  lastRelevant?: TimePunch;
  /** Jornadas com entrada sem saída que não são a operante (ex.: entrada
   *  esquecida há >18h) — pendência administrativa, não bloqueiam a jornada atual. */
  pendingOpen: Journey[];
  /** true = registrar uma Entrada agora abriria uma 2ª jornada hoje → exige
   *  pergunta + motivo (needsNewJourneyReason). */
  newJourneyNeedsReason: boolean;
  /** Jornadas de hoje resumidas ("08:18–17:02") para a pergunta. */
  todayJourneysLabel: string;
}

const STATUS_LABEL: Record<PunchStatusKind, string> = {
  FORA: 'Fora do expediente',
  TRABALHANDO: 'Em jornada',
  ALMOCO: 'Em almoço',
  ENCERRADA: 'Jornada encerrada',
};

/**
 * Estado canônico da jornada de HOJE — fonte única consumida por PontoView e
 * pelo Painel do Técnico. NÃO recalcula ponto nem regras de jornada: apenas
 * deriva o estado da sequência a partir das batidas efetivas recebidas.
 */
export function derivePunchState(
  punches: TimePunch[], who: PunchOwner, nowMs: number, maxOpenMs: number = OPEN_JOURNEY_LIMIT_MS,
): PunchDayState {
  // Jornada corrente: a aberta (≤18h, mesmo iniciada ontem) ou, na ausência
  // dela, a encerrada com competência HOJE. Fora disso, fora do expediente —
  // uma entrada esquecida (>18h) aparece só como pendência.
  const { open, current, pending, todays: todayJourneys } = resolveOperationalJourneys(punches, who, nowMs, maxOpenMs);
  const cp = [...(current?.punches ?? [])].sort((a, b) => (a.at || 0) - (b.at || 0));
  const byType = (t: PunchType) => cp.find((p) => p.type === t);
  const entrada = byType('ENTRADA');
  const almoco = byType('PAUSA');
  const retorno = byType('RETORNO');
  const saida = byType('SAIDA');
  const nextType = nextPunchType(punches, who, nowMs, maxOpenMs);
  const statusKind: PunchStatusKind = !entrada
    ? 'FORA'
    : saida
    ? 'ENCERRADA'
    : almoco && !retorno
    ? 'ALMOCO'
    : 'TRABALHANDO';
  return {
    todays: cp,
    entrada,
    almoco,
    retorno,
    saida,
    nextType,
    statusKind,
    statusLabel: STATUS_LABEL[statusKind],
    lastRelevant: saida || retorno || almoco || entrada,
    pendingOpen: pending,
    newJourneyNeedsReason: !open && todayJourneys.length > 0,
    todayJourneysLabel: summarizeTodayJourneys(todayJourneys),
  };
}

/** Constrói a batida (mesma estrutura do PontoView). Não inventa localização. */
export function buildPunch(
  type: PunchType,
  employeeName: string,
  coords?: { lat: number; lng: number; accuracy?: number },
  journeyReason?: string,
): TimePunch {
  const d = new Date();
  const hasGps = !!coords;
  return {
    ...(type === 'ENTRADA' && journeyReason?.trim() ? { journeyReason: journeyReason.trim() } : {}),
    id: `p_${Date.now()}`,
    employeeName,
    timestamp: `${d.getDate()} ${d.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()} ${d.getFullYear()} | ${fmtClock(d)}`,
    type,
    locationStr: hasGps ? `${coords!.lat.toFixed(6)}, ${coords!.lng.toFixed(6)}` : 'Sem localização (GPS indisponível)',
    lat: hasGps ? coords!.lat : 0,
    lng: hasGps ? coords!.lng : 0,
    status: 'APROVADO',
    at: d.getTime(),
    accuracy: hasGps && coords!.accuracy ? Math.round(coords!.accuracy) : undefined,
  };
}

/**
 * Captura a posição (mesma config do PontoView: alta precisão, 15s). A permissão
 * de GPS é pedida SOMENTE aqui (no clique de bater ponto). Resolve null se
 * indisponível/negado — o chamador registra sem localização (não inventa).
 */
export function capturePunchPosition(): Promise<{ lat: number; lng: number; accuracy?: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      PUNCH_GPS_OPTIONS
    );
  });
}
