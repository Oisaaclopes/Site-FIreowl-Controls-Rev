import { AttendanceResult, ServiceAttendance, TimePunch } from './types';
import { hasOpenJourney } from './fieldOperations';

/* ===================================================================
 * ETAPA 3B — Regras PURAS do fluxo operacional de atendimento. Sem I/O,
 * determinísticas e testáveis. A camada de dados (serviceAttendances.ts) e a
 * UI consomem estas funções; nada aqui conhece Supabase.
 * =================================================================== */

/** Rótulos pt-BR do resultado do atendimento (§15). */
export const ATTENDANCE_RESULT_LABEL: Record<AttendanceResult, string> = {
  RESOLVIDO: 'Resolvido',
  PARCIALMENTE_RESOLVIDO: 'Parcialmente resolvido',
  NAO_RESOLVIDO: 'Não resolvido',
};

/** Tom visual (design system) por resultado — verde/âmbar/vermelho (§36). */
export const ATTENDANCE_RESULT_TONE: Record<AttendanceResult, string> = {
  RESOLVIDO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PARCIALMENTE_RESOLVIDO: 'bg-amber-50 text-amber-700 border-amber-200',
  NAO_RESOLVIDO: 'bg-red-50 text-red-700 border-red-200',
};

/**
 * Aviso de jornada (§6): mostra o alerta "sem entrada no Ponto" apenas quando o
 * técnico USA controle de ponto e NÃO há jornada aberta. Não é bloqueio rígido —
 * só sinaliza. Para quem não usa ponto (uses_time_clock=false) nunca avisa.
 */
export function shouldWarnNoJourney(
  usesTimeClock: boolean,
  punches: TimePunch[],
  now = Date.now()
): boolean {
  if (!usesTimeClock) return false;
  return !hasOpenJourney(punches, now);
}

/** Só RESOLVIDO habilita concluir a OS; PARCIAL/NÃO mantêm a OS aberta (§16/§17). */
export function canConcludeOsFromResult(result?: AttendanceResult): boolean {
  return result === 'RESOLVIDO';
}

/** PARCIAL e NÃO RESOLVIDO exigem/incentivam observação do que ficou pendente
 *  (§18/§19). Usado para orientar (não travar) o técnico. */
export function resultNeedsObservation(result?: AttendanceResult): boolean {
  return result === 'PARCIALMENTE_RESOLVIDO' || result === 'NAO_RESOLVIDO';
}

/** Atendimento ATIVO (em execução) do técnico numa lista já carregada. Puro. */
export function findActiveAttendance(
  attendances: ServiceAttendance[],
  technicianId: string
): ServiceAttendance | undefined {
  return attendances.find(
    (a) => a.status === 'EM_EXECUCAO' && a.technicianId === technicianId
  );
}

/**
 * Duração legível do atendimento a partir de started_at → agora (§22). Nunca
 * persiste contador; é sempre derivado. Tolera datas ausentes/inválidas.
 */
export function formatAttendanceElapsed(
  startedAt?: string | number,
  now = Date.now()
): string {
  if (startedAt == null) return '';
  const start = typeof startedAt === 'number' ? startedAt : new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return '';
  const ms = Math.max(0, now - start);
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (h <= 0) return `${min}min`;
  return `${h}h ${String(min).padStart(2, '0')}min`;
}

/** "Iniciado 09:42" a partir de started_at (§8/§22). */
export function formatStartedAt(startedAt?: string | number): string {
  if (startedAt == null) return '';
  const d = new Date(startedAt);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
