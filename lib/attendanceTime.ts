/* ===================================================================
 * TEMPO DE ATENDIMENTO — cálculo puro a partir de started_at + eventos (0108).
 * TEMPO DECORRIDO = início até agora/finalização (parede).
 * TEMPO EFETIVO   = soma só dos intervalos EM_EXECUCAO (exclui pausas).
 * Compatibilidade (§8): sem evento STARTED, started_at é a âncora inicial real
 * (não inventa timestamp). Espelha a semântica das RPCs/trigger da 0108.
 * =================================================================== */
import type { AttendanceEventType, AttendancePauseReason, ServiceAttendanceEvent } from './types';

export const ATTENDANCE_PAUSE_REASON_LABEL: Record<AttendancePauseReason, string> = {
  AGUARDANDO_MATERIAL: 'Aguardando material/peça',
  CONDICAO_CLIMATICA: 'Condição climática',
  AGUARDANDO_ACESSO: 'Aguardando acesso/liberação',
  DEPENDENCIA_TERCEIRO: 'Dependência de terceiro',
  RETORNO_SOLICITADO_CLIENTE: 'Cliente solicitou retorno',
  FIM_JORNADA: 'Fim da jornada',
  IMPEDIMENTO_TECNICO: 'Impedimento técnico',
  OUTRO: 'Outro',
};

/** Ordem canônica das opções para o seletor de pausa. */
export const ATTENDANCE_PAUSE_REASONS: AttendancePauseReason[] = [
  'AGUARDANDO_MATERIAL', 'CONDICAO_CLIMATICA', 'AGUARDANDO_ACESSO', 'DEPENDENCIA_TERCEIRO',
  'RETORNO_SOLICITADO_CLIENTE', 'FIM_JORNADA', 'IMPEDIMENTO_TECNICO', 'OUTRO',
];

const ms = (iso?: string): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

type Boundary = { at: number; type: AttendanceEventType };

/** Normaliza os eventos em fronteiras ordenadas; injeta STARTED implícito em
 *  started_at quando não há STARTED real (compatibilidade §8). */
function boundaries(startedAt: string | undefined, events: ServiceAttendanceEvent[]): Boundary[] {
  const evs = [...events]
    .map((e) => ({ at: ms(e.createdAt), type: e.type }))
    .filter((e): e is Boundary => e.at !== null)
    .sort((a, b) => a.at - b.at);
  const hasStarted = evs.some((e) => e.type === 'STARTED');
  const anchor = ms(startedAt);
  if (!hasStarted && anchor !== null) {
    return [{ at: anchor, type: 'STARTED' }, ...evs];
  }
  return evs;
}

/**
 * Tempo EFETIVO (ms): soma dos intervalos abertos por STARTED/RESUMED e fechados
 * por PAUSED/FINALIZED. Se o último intervalo estiver aberto (em execução), conta
 * até `now`. Durante PAUSADO o efetivo NÃO cresce.
 */
export function computeEffectiveMs(
  startedAt: string | undefined,
  events: ServiceAttendanceEvent[],
  now: number = Date.now()
): number {
  const bs = boundaries(startedAt, events);
  let total = 0;
  let openAt: number | null = null;
  for (const b of bs) {
    if (b.type === 'STARTED' || b.type === 'RESUMED') {
      if (openAt === null) openAt = b.at;
    } else { // PAUSED | FINALIZED
      if (openAt !== null) { total += Math.max(0, b.at - openAt); openAt = null; }
    }
  }
  if (openAt !== null) total += Math.max(0, now - openAt);
  return total;
}

/** Tempo DECORRIDO (ms): parede de started_at até finished_at (ou now). */
export function computeElapsedMs(
  startedAt: string | undefined,
  finishedAt: string | undefined,
  now: number = Date.now()
): number {
  const start = ms(startedAt);
  if (start === null) return 0;
  const end = ms(finishedAt) ?? now;
  return Math.max(0, end - start);
}

/** Info da pausa CORRENTE, quando o último evento é PAUSED (para "Pausado desde/Motivo"). */
export function currentPauseInfo(
  events: ServiceAttendanceEvent[]
): { pausedAt: string; reason?: AttendancePauseReason; note?: string } | null {
  const sorted = [...events].filter((e) => ms(e.createdAt) !== null)
    .sort((a, b) => ms(a.createdAt)! - ms(b.createdAt)!);
  const last = sorted[sorted.length - 1];
  if (!last || last.type !== 'PAUSED') return null;
  return { pausedAt: last.createdAt, reason: last.reason, note: last.note };
}

/** Formata duração curta (ex.: "2h18", "45min", "0min"). */
export function formatDurationShort(msTotal: number): string {
  const totalMin = Math.floor(msTotal / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${m}min`;
}
