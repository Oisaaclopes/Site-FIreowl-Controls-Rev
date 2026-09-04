import { getSupabaseClient } from './supabaseClient';
import { ServiceAttendance, AttendanceResult, AttendanceStatus, AttendanceSignatureStatus } from './types';

/* ===================================================================
 * ETAPA 3A — ATENDIMENTO: execução/visita real de UMA OS. Uma OS pode
 * ter 0..N atendimentos (nunca 1 OS == 1 atendimento obrigatório).
 * O resultado do atendimento (RESOLVIDO/PARCIAL/NÃO) NÃO define o status
 * da OS — um atendimento parcial pode conviver com uma OS ainda aberta.
 * =================================================================== */

const TABLE = 'service_attendances';

/** Status considerado atendimento ATIVO (em curso) para a derivação do painel. */
export const ATTENDANCE_ACTIVE: AttendanceStatus = 'EM_EXECUCAO';

function rowToAttendance(r: any): ServiceAttendance {
  return {
    id: String(r.id),
    workOrderId: String(r.work_order_id),
    technicianId: r.technician_id ?? undefined,
    startedAt: r.started_at ?? undefined,
    finishedAt: r.finished_at ?? undefined,
    status: (r.status || 'EM_EXECUCAO') as AttendanceStatus,
    result: (r.result ?? undefined) as AttendanceResult | undefined,
    diagnosis: r.diagnosis ?? undefined,
    executionNotes: r.execution_notes ?? undefined,
    latitudeStart: r.latitude_start ?? undefined,
    longitudeStart: r.longitude_start ?? undefined,
    latitudeEnd: r.latitude_end ?? undefined,
    longitudeEnd: r.longitude_end ?? undefined,
    centralConditionInitial: r.central_condition_initial ?? undefined,
    centralConditionFinal: r.central_condition_final ?? undefined,
    centralNotApplicable: r.central_not_applicable ?? undefined,
    centralNaReason: r.central_na_reason ?? undefined,
    clientSignatureName: r.client_signature_name ?? undefined,
    clientSignatureRole: r.client_signature_role ?? undefined,
    clientSignaturePath: r.client_signature_path ?? undefined,
    clientSignatureStatus: (r.client_signature_status ?? undefined) as AttendanceSignatureStatus | undefined,
    clientSignatureNote: r.client_signature_note ?? undefined,
    clientSignedAt: r.client_signed_at ?? undefined,
    createdAt: r.created_at ?? undefined,
    updatedAt: r.updated_at ?? undefined,
  };
}

export async function fetchServiceAttendances(filter?: {
  workOrderId?: string;
  technicianId?: string;
  status?: AttendanceStatus;
}): Promise<ServiceAttendance[]> {
  const supabase = getSupabaseClient() as any;
  let query = supabase.from(TABLE).select('*').order('started_at', { ascending: false });
  if (filter?.workOrderId) query = query.eq('work_order_id', filter.workOrderId);
  if (filter?.technicianId) query = query.eq('technician_id', filter.technicianId);
  if (filter?.status) query = query.eq('status', filter.status);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(rowToAttendance);
}

/** Atendimento ATIVO (EM_EXECUCAO) do técnico, se houver. A 0083 garante no
 *  máximo um por técnico (índice único parcial); aqui pegamos o mais recente
 *  como reforço defensivo. Retorna null quando o técnico está livre. */
export async function fetchActiveAttendanceForTechnician(
  technicianId: string
): Promise<ServiceAttendance | null> {
  if (!technicianId) return null;
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('technician_id', technicianId)
    .eq('status', 'EM_EXECUCAO')
    .order('started_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data && data[0] ? rowToAttendance(data[0]) : null;
}

/** Erro tipado: o técnico já tem um atendimento EM_EXECUCAO (viola o índice
 *  único da 0083). Carrega o atendimento existente para a UI oferecer "Continuar"
 *  em vez de tentar contornar a proteção do banco (§7/§34). */
export class ActiveAttendanceExistsError extends Error {
  existing: ServiceAttendance | null;
  constructor(existing: ServiceAttendance | null) {
    super('Você já possui um atendimento em andamento.');
    this.name = 'ActiveAttendanceExistsError';
    this.existing = existing;
  }
}

/**
 * Inicia um atendimento de uma OS (GPS pontual opcional, sem rastreio contínuo).
 * IDEMPOTENTE em relação ao índice único da 0083: se o técnico já tiver um
 * atendimento EM_EXECUCAO, o banco rejeita (23505) e devolvemos o atendimento
 * atual dentro de ActiveAttendanceExistsError — nunca criamos um segundo (§7/§34).
 */
export async function startServiceAttendance(input: {
  workOrderId: string;
  technicianId: string;
  latitude?: number;
  longitude?: number;
}): Promise<ServiceAttendance> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      work_order_id: input.workOrderId,
      technician_id: input.technicianId,
      status: 'EM_EXECUCAO',
      latitude_start: input.latitude ?? null,
      longitude_start: input.longitude ?? null,
    })
    .select()
    .single();
  if (error) {
    // 23505 = unique_violation do índice service_attendances_one_active_per_tech.
    if (error.code === '23505') {
      const existing = await fetchActiveAttendanceForTechnician(input.technicianId).catch(() => null);
      throw new ActiveAttendanceExistsError(existing);
    }
    throw error;
  }
  return rowToAttendance(data);
}

/** Salvamento incremental durante o atendimento (§12): diagnóstico/execução,
 *  sem tocar em status/resultado/horários. Base do autosave da tela de campo. */
export async function saveAttendanceProgress(input: {
  id: string;
  diagnosis?: string;
  executionNotes?: string;
}): Promise<ServiceAttendance> {
  const supabase = getSupabaseClient() as any;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.diagnosis !== undefined) patch.diagnosis = input.diagnosis || null;
  if (input.executionNotes !== undefined) patch.execution_notes = input.executionNotes || null;
  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('id', input.id)
    .eq('status', 'EM_EXECUCAO') // nunca reabre um atendimento finalizado
    .select()
    .single();
  if (error) throw error;
  return rowToAttendance(data);
}

/** Salva a condição da central SDAI (§18–§26) durante o atendimento. Só campos
 *  informados são tocados; não altera status/resultado/horários. */
export async function saveAttendanceCentral(input: {
  id: string;
  conditionInitial?: string;
  conditionFinal?: string;
  notApplicable?: boolean;
  naReason?: string;
}): Promise<ServiceAttendance> {
  const supabase = getSupabaseClient() as any;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.conditionInitial !== undefined) patch.central_condition_initial = input.conditionInitial || null;
  if (input.conditionFinal !== undefined) patch.central_condition_final = input.conditionFinal || null;
  if (input.notApplicable !== undefined) patch.central_not_applicable = input.notApplicable;
  if (input.naReason !== undefined) patch.central_na_reason = input.naReason || null;
  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('id', input.id)
    .eq('status', 'EM_EXECUCAO')
    .select()
    .single();
  if (error) throw error;
  return rowToAttendance(data);
}

/** Finaliza um atendimento com resultado (não altera o status da OS aqui). */
export async function finishServiceAttendance(input: {
  id: string;
  result: AttendanceResult;
  diagnosis?: string;
  executionNotes?: string;
  latitude?: number;
  longitude?: number;
}): Promise<ServiceAttendance> {
  const supabase = getSupabaseClient() as any;
  // Só sobrescreve diagnóstico/execução quando o caller informa: preserva o que
  // já foi autosalvo durante o atendimento (§12) se a finalização não os reenviar.
  const patch: Record<string, unknown> = {
    status: 'FINALIZADO',
    finished_at: new Date().toISOString(),
    result: input.result,
    latitude_end: input.latitude ?? null,
    longitude_end: input.longitude ?? null,
    updated_at: new Date().toISOString(),
  };
  if (input.diagnosis !== undefined) patch.diagnosis = input.diagnosis || null;
  if (input.executionNotes !== undefined) patch.execution_notes = input.executionNotes || null;
  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('id', input.id)
    .select()
    .single();
  if (error) throw error;
  return rowToAttendance(data);
}

/**
 * Salva a assinatura do responsável no atendimento (0091). Para SIGNED, sobe o
 * PNG ao bucket privado report-media e grava o caminho + nome/cargo/timestamp.
 * Para UNAVAILABLE/REFUSED, grava o status + motivo (sem PNG). Não bloqueia a
 * finalização; apenas registra a evidência do aceite (ou da exceção).
 */
export async function saveAttendanceSignature(input: {
  id: string;
  status: AttendanceSignatureStatus;
  name?: string;
  role?: string;
  note?: string;
  /** PNG da assinatura desenhada (obrigatório quando status = SIGNED). */
  signaturePng?: Blob;
}): Promise<ServiceAttendance> {
  const supabase = getSupabaseClient() as any;
  const patch: Record<string, unknown> = {
    client_signature_status: input.status,
    client_signature_name: input.name?.trim() || null,
    client_signature_role: input.role?.trim() || null,
    client_signature_note: input.note?.trim() || null,
    client_signed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (input.status === 'SIGNED' && input.signaturePng) {
    const path = `attendance-signatures/${input.id}.png`;
    const { error: upErr } = await supabase.storage.from('report-media').upload(path, input.signaturePng, { upsert: true, contentType: 'image/png' });
    if (upErr) throw upErr;
    patch.client_signature_path = path;
  } else {
    patch.client_signature_path = null;
  }
  const { data, error } = await supabase.from(TABLE).update(patch).eq('id', input.id).select().single();
  if (error) throw error;
  return rowToAttendance(data);
}

export async function deleteServiceAttendance(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
