import { getSupabaseClient } from './supabaseClient';

// SUBSTITUIDO: um ajuste aprovado posterior (correção) tomou o lugar deste — a
// linha é preservada para auditoria, nunca editada nem apagada (0113).
export type AdjustmentStatus = 'PENDENTE' | 'APROVADO' | 'REJEITADO' | 'SUBSTITUIDO';
export type PunchType = 'ENTRADA' | 'PAUSA' | 'RETORNO' | 'SAIDA';
// AJUSTE = corrige horário · INCLUSAO = batida ausente · DESCONSIDERAR = retira
// uma batida do cálculo (a original continua em time_punches).
export type AdjustmentAction = 'AJUSTE' | 'INCLUSAO' | 'DESCONSIDERAR';
// SOLICITACAO = pedida pelo funcionário (passa por aprovação) · ADMINISTRATIVO =
// correção direta de gestor/administrativo (efeito imediato, auditada).
export type AdjustmentOrigin = 'SOLICITACAO' | 'ADMINISTRATIVO';

export interface PunchAdjustment {
  id: string;
  userId?: string; // dono da solicitação (funcionário) — usado ao materializar a batida
  employeeName: string;
  refDate: string; // YYYY-MM-DD
  type: PunchType;
  requestedTime: string;
  reason: string;
  status: AdjustmentStatus;
  reviewerNote?: string;
  createdAt?: string;
  originalPunchId?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewerName?: string;
  /** Ausente = AJUSTE (linhas anteriores à 0113). */
  action?: AdjustmentAction;
  /** Ausente = SOLICITACAO (linhas anteriores à 0113). */
  origin?: AdjustmentOrigin;
  createdBy?: string;
  createdByName?: string;
  /** Horário da batida original no momento do ajuste (copiado pelo banco). */
  originalAt?: string;
  replacesAdjustmentId?: string;
  supersededAt?: string;
}

const TABLE = 'punch_adjustments';

/**
 * Regra única: toda solicitação/aprovação de ajuste de horário exige o novo
 * horário. Sem ele o ajuste não pode ser enviado nem aprovado, e nunca deve
 * existir APROVADO com requested_time NULL para correções de batida.
 */
export const hasRequestedTime = (requestedTime?: string | null): boolean =>
  typeof requestedTime === 'string' && requestedTime.trim().length > 0;

export function rowToAdjustment(r: any): PunchAdjustment {
  return {
    id: String(r.id),
    userId: r.user_id ?? undefined,
    employeeName: r.employee_name || '',
    refDate: r.ref_date || '',
    type: r.type,
    requestedTime: r.requested_time || '',
    reason: r.reason || '',
    status: (r.status || 'PENDENTE') as AdjustmentStatus,
    reviewerNote: r.reviewer_note ?? undefined,
    createdAt: r.created_at ?? undefined,
    originalPunchId: r.original_punch_id ?? undefined,
    reviewedAt: r.reviewed_at ?? undefined,
    reviewedBy: r.reviewed_by ?? undefined,
    reviewerName: r.reviewer_name ?? undefined,
    // Tolerante a linhas anteriores à 0113 (sem as colunas novas).
    action: (r.action || 'AJUSTE') as AdjustmentAction,
    origin: (r.origin || 'SOLICITACAO') as AdjustmentOrigin,
    createdBy: r.created_by ?? undefined,
    createdByName: r.created_by_name ?? undefined,
    originalAt: r.original_at ?? undefined,
    replacesAdjustmentId: r.replaces_adjustment_id ?? undefined,
    supersededAt: r.superseded_at ?? undefined,
  };
}

// RLS decide a visibilidade (próprias para funcionário; todas para admin/gestor)
export async function fetchAdjustments(): Promise<PunchAdjustment[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return (data || []).map(rowToAdjustment);
}

export interface AdminCorrectionInput {
  /** Funcionário dono da batida (profiles.id / time_punches.user_id). */
  userId: string;
  action: AdjustmentAction;
  type: PunchType;
  /** YYYY-MM-DD — data real (civil) do horário corrigido/incluído. */
  refDate: string;
  /** HH:MM — obrigatório exceto em DESCONSIDERAR. */
  requestedTime?: string;
  reason: string;
  originalPunchId?: string;
  /** Ajuste aprovado vigente que esta correção substitui (ex.: batida incluída). */
  replacesAdjustmentId?: string;
}

/** Valida no cliente as mesmas regras que a RPC impõe no banco. */
export function validateAdminCorrection(input: AdminCorrectionInput): string | null {
  if (!input.userId) return 'Funcionário não identificado.';
  if (!input.reason.trim()) return 'Informe o motivo da correção.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.refDate)) return 'Informe a data.';
  if (input.action !== 'DESCONSIDERAR' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.requestedTime || '')) {
    return 'Informe o horário (HH:MM).';
  }
  if (input.action === 'INCLUSAO' && (input.originalPunchId || input.replacesAdjustmentId)) {
    return 'Inclusão não referencia batida existente.';
  }
  if (input.action !== 'INCLUSAO' && !input.originalPunchId && !input.replacesAdjustmentId) {
    return 'Selecione a batida a corrigir.';
  }
  return null;
}

/**
 * Correção ADMINISTRATIVA com efeito imediato (RPC punch_admin_correct, 0113):
 * o banco valida o papel (ADMINISTRATIVO/GESTOR), registra autor/momento/
 * motivo/horário original e substitui — sem apagar — o ajuste vigente sobre o
 * mesmo alvo. time_punches nunca é alterado.
 */
export async function adminCorrectPunch(input: AdminCorrectionInput): Promise<PunchAdjustment> {
  const invalid = validateAdminCorrection(input);
  if (invalid) throw new Error(invalid);
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.rpc('punch_admin_correct', {
    p_user_id: input.userId,
    p_action: input.action,
    p_type: input.type,
    p_ref_date: input.refDate,
    p_requested_time: input.action === 'DESCONSIDERAR' ? null : input.requestedTime,
    p_reason: input.reason.trim(),
    p_original_punch_id: input.originalPunchId || null,
    p_replaces_adjustment_id: input.replacesAdjustmentId || null,
  });
  if (error) throw error;
  return rowToAdjustment(Array.isArray(data) ? data[0] : data);
}

export async function createAdjustment(input: {
  employeeName: string;
  refDate: string;
  type: PunchType;
  requestedTime: string;
  reason: string;
  originalPunchId?: string;
  userId?: string;
}): Promise<PunchAdjustment> {
  const supabase = getSupabaseClient() as any;
  // user_id tem default auth.uid() no banco, mas enviamos explicitamente quando
  // conhecido para que a solicitação materialize corretamente a batida (o
  // resolvedor efetivo cruza userId × data × tipo).
  const { data: authData } = await supabase.auth.getUser();
  const userId = input.userId || authData?.user?.id || undefined;
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      ...(userId ? { user_id: userId } : {}),
      employee_name: input.employeeName,
      ref_date: input.refDate,
      type: input.type,
      requested_time: input.requestedTime || null,
      reason: input.reason || null,
      original_punch_id: input.originalPunchId || null,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToAdjustment(data);
}

export async function updateAdjustmentStatus(
  id: string,
  status: AdjustmentStatus,
  reviewerNote?: string,
  audit?: { originalPunchId?: string; reviewerName?: string }
): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { data: authData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from(TABLE)
    .update({
      status,
      reviewer_note: reviewerNote || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: authData?.user?.id || null,
      reviewer_name: audit?.reviewerName || null,
      ...(audit?.originalPunchId ? { original_punch_id: audit.originalPunchId } : {}),
    })
    .eq('id', id);
  if (error) throw error;
}
