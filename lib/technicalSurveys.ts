/* ===================================================================
 * ETAPA 3D — Levantamentos técnicos (technical_surveys, 0095).
 * CRUD do "cabeçalho" do levantamento (PONTUAL/PARCIAL/COMPLETO). Os ativos
 * verificados alimentam a Base Técnica (devices) INCREMENTALMENTE via lib/devices
 * + lib/deviceVerifications (§6A) — este módulo só cuida do registro do survey.
 * =================================================================== */
import { getSupabaseClient } from './supabaseClient';
import { TechnicalSurvey } from './types';

const TABLE = 'technical_surveys';

function rowToSurvey(r: any): TechnicalSurvey {
  return {
    id: String(r.id),
    clienteId: r.cliente_id || '',
    area: (r.area || 'SDAI') as TechnicalSurvey['area'],
    mode: (r.mode || 'PONTUAL') as TechnicalSurvey['mode'],
    scope: (r.scope && typeof r.scope === 'object') ? r.scope : undefined,
    status: (r.status || 'EM_ANDAMENTO') as TechnicalSurvey['status'],
    expectedCount: r.expected_count ?? undefined,
    verifiedCount: r.verified_count ?? 0,
    notes: r.notes ?? undefined,
    createdBy: r.created_by ?? undefined,
    createdAt: r.created_at ?? undefined,
    updatedAt: r.updated_at ?? undefined,
    finishedAt: r.finished_at ?? undefined,
  };
}

function surveyToRow(s: Partial<TechnicalSurvey>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (s.clienteId !== undefined) row.cliente_id = s.clienteId;
  if (s.area !== undefined) row.area = s.area;
  if (s.mode !== undefined) row.mode = s.mode;
  if (s.scope !== undefined) row.scope = s.scope || {};
  if (s.status !== undefined) row.status = s.status;
  if (s.expectedCount !== undefined) row.expected_count = s.expectedCount ?? null;
  if (s.verifiedCount !== undefined) row.verified_count = s.verifiedCount ?? 0;
  if (s.notes !== undefined) row.notes = s.notes ?? null;
  if (s.finishedAt !== undefined) row.finished_at = s.finishedAt ?? null;
  if (s.id) row.id = s.id;
  return row;
}

export async function fetchSurveys(clienteId?: string, area?: string): Promise<TechnicalSurvey[]> {
  const supabase = getSupabaseClient() as any;
  let query = supabase.from(TABLE).select('*').order('created_at', { ascending: false });
  if (clienteId) query = query.eq('cliente_id', clienteId);
  if (area) query = query.eq('area', area);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(rowToSurvey);
}

export async function upsertSurvey(s: Partial<TechnicalSurvey>): Promise<TechnicalSurvey> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).upsert(surveyToRow(s), { onConflict: 'id' }).select().single();
  if (error) throw error;
  return rowToSurvey(data);
}

/** Finaliza o levantamento (status FINALIZADO + finished_at). Não mexe na base. */
export async function finalizeSurvey(id: string, verifiedCount?: number): Promise<TechnicalSurvey> {
  const patch: Partial<TechnicalSurvey> = { id, status: 'FINALIZADO', finishedAt: new Date().toISOString() };
  if (verifiedCount !== undefined) patch.verifiedCount = verifiedCount;
  return upsertSurvey(patch);
}

export async function cancelSurvey(id: string): Promise<TechnicalSurvey> {
  return upsertSurvey({ id, status: 'CANCELADO', finishedAt: new Date().toISOString() });
}
