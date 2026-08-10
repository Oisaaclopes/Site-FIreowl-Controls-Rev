import { getSupabaseClient } from './supabaseClient';
import { ReportInstance, ReportAnswer, ReportMedia } from './types';

/* ----------------------------- reports ----------------------------- */

function rowToReport(r: any): ReportInstance {
  return {
    id: String(r.id),
    templateCodigo: r.template_codigo || '',
    tipo: (r.tipo || 'LEVANTAMENTO') as ReportInstance['tipo'],
    clienteId: r.cliente_id ?? undefined,
    contratoId: r.contrato_id ?? undefined,
    osId: r.os_id ?? undefined,
    tecnicoNome: r.tecnico_nome ?? undefined,
    titulo: r.titulo ?? undefined,
    local: r.local ?? undefined,
    status: (r.status || 'rascunho') as ReportInstance['status'],
    iniciadoEm: r.iniciado_em ?? undefined,
    finalizadoEm: r.finalizado_em ?? undefined,
  };
}

function reportToRow(r: ReportInstance): Record<string, unknown> {
  const row: Record<string, unknown> = {
    template_codigo: r.templateCodigo,
    tipo: r.tipo,
    cliente_id: r.clienteId ?? null,
    contrato_id: r.contratoId ?? null,
    os_id: r.osId ?? null,
    tecnico_nome: r.tecnicoNome ?? null,
    titulo: r.titulo ?? null,
    local: r.local ?? null,
    status: r.status,
    finalizado_em: r.finalizadoEm ?? null,
    updated_at: new Date().toISOString(),
  };
  if (r.id) row.id = r.id;
  return row;
}

export async function fetchReports(filter?: { clienteId?: string; status?: string }): Promise<ReportInstance[]> {
  const supabase = getSupabaseClient() as any;
  let query = supabase.from('reports').select('*').order('created_at', { ascending: false });
  if (filter?.clienteId) query = query.eq('cliente_id', filter.clienteId);
  if (filter?.status) query = query.eq('status', filter.status);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(rowToReport);
}

export async function createReport(r: ReportInstance): Promise<ReportInstance> {
  const supabase = getSupabaseClient() as any;
  const { id, ...rest } = reportToRow(r); // deixa o banco gerar o uuid
  void id;
  const { data, error } = await supabase.from('reports').insert(rest).select().single();
  if (error) throw error;
  return rowToReport(data);
}

export async function updateReport(r: ReportInstance): Promise<ReportInstance> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from('reports').update(reportToRow(r)).eq('id', r.id).select().single();
  if (error) throw error;
  return rowToReport(data);
}

export async function deleteReport(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from('reports').delete().eq('id', id);
  if (error) throw error;
}

/* --------------------------- report_answers --------------------------- */

function rowToAnswer(r: any): ReportAnswer {
  return {
    id: String(r.id),
    reportId: String(r.report_id),
    secao: r.secao ?? undefined,
    fieldKey: r.field_key || '',
    valor: r.valor ?? null,
    repeaterIdx: r.repeater_idx ?? undefined,
  };
}

function answerToRow(a: ReportAnswer): Record<string, unknown> {
  const row: Record<string, unknown> = {
    report_id: a.reportId,
    secao: a.secao ?? null,
    field_key: a.fieldKey,
    valor: a.valor ?? null,
    repeater_idx: a.repeaterIdx ?? null,
  };
  if (a.id) row.id = a.id;
  return row;
}

export async function fetchAnswers(reportId: string): Promise<ReportAnswer[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from('report_answers').select('*').eq('report_id', reportId);
  if (error) throw error;
  return (data || []).map(rowToAnswer);
}

export async function upsertAnswer(a: ReportAnswer): Promise<ReportAnswer> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from('report_answers').upsert(answerToRow(a), { onConflict: 'id' }).select().single();
  if (error) throw error;
  return rowToAnswer(data);
}

export async function deleteAnswer(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from('report_answers').delete().eq('id', id);
  if (error) throw error;
}

/* ---------------------------- report_media ---------------------------- */

function rowToMedia(r: any): ReportMedia {
  return {
    id: String(r.id),
    reportId: String(r.report_id),
    answerId: r.answer_id ?? undefined,
    pendenciaId: r.pendencia_id ?? undefined,
    deviceId: r.device_id ?? undefined,
    storagePath: r.storage_path || '',
    rotulo: r.rotulo ?? undefined,
    notaRapida: r.nota_rapida ?? undefined,
    grupo: r.grupo ?? undefined,
    lat: r.lat ?? undefined,
    lng: r.lng ?? undefined,
    accuracy: r.accuracy ?? undefined,
    capturedAt: r.captured_at ?? undefined,
  };
}

function mediaToRow(m: ReportMedia): Record<string, unknown> {
  const row: Record<string, unknown> = {
    report_id: m.reportId,
    answer_id: m.answerId ?? null,
    pendencia_id: m.pendenciaId ?? null,
    device_id: m.deviceId ?? null,
    storage_path: m.storagePath,
    rotulo: m.rotulo ?? null,
    nota_rapida: m.notaRapida ?? null,
    grupo: m.grupo ?? null,
    lat: m.lat ?? null,
    lng: m.lng ?? null,
    accuracy: m.accuracy ?? null,
  };
  if (m.capturedAt) row.captured_at = m.capturedAt;
  if (m.id) row.id = m.id;
  return row;
}

export async function fetchMedia(reportId: string): Promise<ReportMedia[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from('report_media')
    .select('*')
    .eq('report_id', reportId)
    .order('captured_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToMedia);
}

/** Bandeja de não classificadas: mídia com answer_id nulo. */
export async function fetchBandeja(reportId: string): Promise<ReportMedia[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from('report_media')
    .select('*')
    .eq('report_id', reportId)
    .is('answer_id', null)
    .order('captured_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToMedia);
}

export async function insertMedia(m: ReportMedia): Promise<ReportMedia> {
  const supabase = getSupabaseClient() as any;
  const { id, ...rest } = mediaToRow(m);
  void id;
  const { data, error } = await supabase.from('report_media').insert(rest).select().single();
  if (error) throw error;
  return rowToMedia(data);
}

/** Classificar/reatribuir uma mídia (vincula a apontamento/pendência/device). */
export async function updateMedia(m: ReportMedia): Promise<ReportMedia> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from('report_media').update(mediaToRow(m)).eq('id', m.id).select().single();
  if (error) throw error;
  return rowToMedia(data);
}

export async function deleteMedia(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from('report_media').delete().eq('id', id);
  if (error) throw error;
}
