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
}

const TABLE = 'punch_adjustments';

function rowToAdj(r: any): PunchAdjustment {
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
  };
}

// RLS decide a visibilidade (próprias para funcionário; todas para admin/gestor)
export async function fetchAdjustments(): Promise<PunchAdjustment[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return (data || []).map(rowToAdj);
}

export async function createAdjustment(input: {
  employeeName: string;
  refDate: string;
  type: PunchType;
  requestedTime: string;
  reason: string;
}): Promise<PunchAdjustment> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      employee_name: input.employeeName,
      ref_date: input.refDate,
      type: input.type,
      requested_time: input.requestedTime || null,
      reason: input.reason || null,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToAdj(data);
}

export async function updateAdjustmentStatus(
  id: string,
  status: AdjustmentStatus,
  reviewerNote?: string
): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase
    .from(TABLE)
    .update({ status, reviewer_note: reviewerNote || null, reviewed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
