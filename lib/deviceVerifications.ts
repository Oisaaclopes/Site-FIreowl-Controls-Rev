/* ===================================================================
 * ETAPA 3D — Verificações de condição de ativo (device_verifications, 0095).
 * Histórico append-only: cada verificação é uma NOVA linha; nunca sobrescreve o
 * passado (§8/§73/§106). Ao registrar, sincroniza a condição atual + last_verified_at
 * no ativo (devices), mas o histórico permanece imutável.
 * =================================================================== */
import { getSupabaseClient } from './supabaseClient';
import { DeviceVerification } from './types';

const TABLE = 'device_verifications';

function rowToVerification(r: any): DeviceVerification {
  return {
    id: String(r.id),
    deviceId: String(r.device_id),
    clienteId: r.cliente_id ?? undefined,
    surveyId: r.survey_id ?? undefined,
    condicao: (r.condicao || 'NAO_TESTADO') as DeviceVerification['condicao'],
    reconciliation: r.reconciliation ?? undefined,
    notes: r.notes ?? undefined,
    verifiedBy: r.verified_by ?? undefined,
    verifiedAt: r.verified_at ?? undefined,
    serviceAttendanceId: r.service_attendance_id ?? undefined,
    workOrderId: r.work_order_id ?? undefined,
    evidenceItemId: r.evidence_item_id ?? undefined,
    source: r.source ?? undefined,
  };
}

/**
 * Registra uma verificação (histórico) e atualiza a condição atual do ativo.
 * Um `id` opcional (gerado no cliente) torna o replay offline idempotente:
 * repetir a mesma verificação faz upsert na MESMA linha (sem duplicar histórico).
 */
export async function addVerification(v: Omit<DeviceVerification, 'id'> & { id?: string }): Promise<DeviceVerification> {
  const supabase = getSupabaseClient() as any;
  const row: Record<string, unknown> = {
    device_id: v.deviceId,
    cliente_id: v.clienteId ?? null,
    survey_id: v.surveyId ?? null,
    condicao: v.condicao,
    reconciliation: v.reconciliation ?? null,
    notes: v.notes ?? null,
  };
  // Contexto de atendimento (0098) — só enviado quando presente (compat. bancos sem a coluna).
  if (v.serviceAttendanceId !== undefined) row.service_attendance_id = v.serviceAttendanceId ?? null;
  if (v.workOrderId !== undefined) row.work_order_id = v.workOrderId ?? null;
  if (v.evidenceItemId !== undefined) row.evidence_item_id = v.evidenceItemId ?? null;
  if (v.source !== undefined) row.source = v.source ?? null;
  if (v.id) row.id = v.id;
  const { data, error } = v.id
    ? await supabase.from(TABLE).upsert(row, { onConflict: 'id' }).select().single()
    : await supabase.from(TABLE).insert(row).select().single();
  if (error) throw error;
  // Sincroniza a fotografia atual no ativo (histórico continua imutável nesta tabela).
  await supabase.from('devices').update({
    condicao: v.condicao,
    last_verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', v.deviceId);
  return rowToVerification(data);
}

/** Histórico de verificações de um ativo (mais recente primeiro). */
export async function fetchVerificationsForDevice(deviceId: string): Promise<DeviceVerification[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).select('*')
    .eq('device_id', deviceId).order('verified_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToVerification);
}

/** Verificações de um levantamento (para cobertura/reconciliação). */
export async function fetchVerificationsForSurvey(surveyId: string): Promise<DeviceVerification[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).select('*')
    .eq('survey_id', surveyId).order('verified_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToVerification);
}
