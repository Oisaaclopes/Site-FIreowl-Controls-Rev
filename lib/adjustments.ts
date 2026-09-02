import { getSupabaseClient } from './supabaseClient';

export type AdjustmentStatus = 'PENDENTE' | 'APROVADO' | 'REJEITADO';
export type PunchType = 'ENTRADA' | 'PAUSA' | 'RETORNO' | 'SAIDA';

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
  };
}

// RLS decide a visibilidade (próprias para funcionário; todas para admin/gestor)
export async function fetchAdjustments(): Promise<PunchAdjustment[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return (data || []).map(rowToAdjustment);
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
