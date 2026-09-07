/* ===================================================================
 * EXCLUSÃO SEGURA DE OS — ESPECIFICAÇÃO PURA E TESTÁVEL (§9).
 * Espelha EXATAMENTE a regra de decisão da RPC delete_contract_os_if_clean
 * (migration 0107). A RPC (SECURITY DEFINER) é a fonte de ENFORCEMENT — vê
 * evidência oculta por RLS e é transacional; estas funções são a especificação
 * executável coberta por testes. Ao mudar uma, mude a outra.
 * =================================================================== */

/** Mensagem de domínio única do bloqueio (idêntica à da RPC). */
export const OS_PRESERVE_MESSAGE = 'Esta OS possui histórico técnico e deve ser preservada.';

export type OsSafeDeleteStatus =
  | 'aberta' | 'agendada' | 'em_execucao' | 'concluida' | 'cancelada';

/** Conteúdo técnico do próprio atendimento (§4). Espelha o predicado v_att_content
 *  da RPC: qualquer sinal de execução/assinatura torna o atendimento NÃO vazio. */
export interface AttendanceContentInput {
  status: 'EM_EXECUCAO' | 'FINALIZADO';
  finishedAt?: string | null;
  result?: string | null;
  diagnosis?: string | null;
  executionNotes?: string | null;
  signatureStatus?: string | null;
  signaturePath?: string | null;
  signatureName?: string | null;
  signedAt?: string | null;
}

export function attendanceHasContent(a: AttendanceContentInput): boolean {
  const txt = (s?: string | null) => !!(s && s.trim());
  return (
    a.status === 'FINALIZADO'
    || !!a.finishedAt
    || !!a.result
    || txt(a.diagnosis)
    || txt(a.executionNotes)
    || !!a.signatureStatus
    || !!a.signaturePath
    || txt(a.signatureName)
    || !!a.signedAt
  );
}

export interface OsSafeDeleteInput {
  status: OsSafeDeleteStatus;
  /** pendencia_ids não vazio (ou pendência vinculada). */
  hasPendencias: boolean;
  /** report_id, reports.os_id (id/numero) OU reports.service_attendance_id. */
  hasReport: boolean;
  hasDeviceVerification: boolean;
  hasEvidenceItem: boolean;
  hasFieldPhoto: boolean;
  hasFieldPhotoComparison: boolean;
  hasHours: boolean;
  hasFinance: boolean;
  /** Nº de atendimentos NÃO vazios (attendanceHasContent === true). */
  attendancesWithContent: number;
}

export interface OsSafeDeleteDecision {
  canDelete: boolean;
  /** Mensagem de domínio quando bloqueado (undefined quando elegível). */
  reason?: string;
}

/**
 * Decisão pura de elegibilidade (§2/§3/§4). Só aberta/agendada e SEM nenhum
 * vínculo técnico. em_execucao/concluida/cancelada → preservar (conservador).
 */
export function osSafeDeleteDecision(i: OsSafeDeleteInput): OsSafeDeleteDecision {
  if (i.status !== 'aberta' && i.status !== 'agendada') {
    return { canDelete: false, reason: OS_PRESERVE_MESSAGE };
  }
  const temHistorico =
    i.hasPendencias
    || i.hasReport
    || i.hasDeviceVerification
    || i.hasEvidenceItem
    || i.hasFieldPhoto
    || i.hasFieldPhotoComparison
    || i.hasHours
    || i.hasFinance
    || i.attendancesWithContent > 0;
  return temHistorico ? { canDelete: false, reason: OS_PRESERVE_MESSAGE } : { canDelete: true };
}

/** Estado canônico da execução de rotina após soltar a OS (§5): os_gerada volta
 *  a 'agendado' (permite gerar nova OS); demais estados não são tocados. */
export function routineExecutionResetStatus(current: string): string {
  return current === 'os_gerada' ? 'agendado' : current;
}

/** Próxima sequência anual de OS (§10): teto do maior número VIVO ou APOSENTADO,
 *  + 1. Garante que o número de uma OS excluída nunca seja reemitido. */
export function nextOsSequence(maxVivo: number, maxAposentado: number): number {
  return Math.max(maxVivo || 0, maxAposentado || 0) + 1;
}
