import { getSupabaseClient } from './supabaseClient';
import { ServiceAttendance, AttendanceResult, AttendanceStatus } from './types';

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

/** Inicia um atendimento de uma OS (GPS pontual opcional, sem rastreio contínuo). */
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
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: 'FINALIZADO',
      finished_at: new Date().toISOString(),
      result: input.result,
      diagnosis: input.diagnosis ?? null,
      execution_notes: input.executionNotes ?? null,
      latitude_end: input.latitude ?? null,
      longitude_end: input.longitude ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
    .select()
    .single();
  if (error) throw error;
  return rowToAttendance(data);
}

export async function deleteServiceAttendance(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
