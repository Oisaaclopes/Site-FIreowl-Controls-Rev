import { getSupabaseClient } from './supabaseClient';
import { ReportInstance, ReportAnswer, ReportMedia } from './types';

/* ----------------------------- reports (v2.0) ----------------------------- */

function rowToReport(r: any): ReportInstance {
  return {
    id: String(r.id),
    templateId: r.template_id ?? undefined,
    templateCodigo: r.template_codigo || '',
    numero: r.numero ?? undefined,
    tipo: (r.tipo || 'LEVANTAMENTO') as ReportInstance['tipo'],
    clienteId: r.cliente_id ?? undefined,
    osId: r.os_id ?? undefined,
    contratoId: r.contrato_id ?? undefined,
    tecnicoId: r.tecnico_id ?? undefined,
    tecnicoNome: r.tecnico_nome ?? undefined,
    titulo: r.titulo ?? undefined,
    local: r.local ?? undefined,
    status: (r.status || 'rascunho') as ReportInstance['status'],
    iniciadoEm: r.data_inicio ?? undefined,
    finalizadoEm: r.data_fim ?? undefined,
    geoInicio: r.geo_inicio ?? undefined,
    geoFim: r.geo_fim ?? undefined,
    resumoExecucao: r.resumo_execucao ?? undefined,
    observacoesGerais: r.observacoes_gerais ?? undefined,
    syncStatus: r.sync_status ?? undefined,
    clientUuid: r.client_uuid ?? undefined,
    templateVersion: r.template_version ?? undefined,
    templateSnapshot: r.template_snapshot ?? undefined,
  };
}

function reportToRow(r: ReportInstance): Record<string, unknown> {
  const row: Record<string, unknown> = {
    template_codigo: r.templateCodigo,
    tipo: r.tipo,
    cliente_id: r.clienteId ?? null,
    os_id: r.osId ?? null,
    contrato_id: r.contratoId ?? null,
    tecnico_nome: r.tecnicoNome ?? null,
    titulo: r.titulo ?? null,
    local: r.local ?? null,
    status: r.status,
    data_fim: r.finalizadoEm ?? null,
    updated_at: new Date().toISOString(),
  };
  if (r.id) row.id = r.id;
  if (r.templateId !== undefined) row.template_id = r.templateId;
  if (r.numero !== undefined) row.numero = r.numero;
  if (r.iniciadoEm !== undefined) row.data_inicio = r.iniciadoEm;
  if (r.geoInicio !== undefined) row.geo_inicio = r.geoInicio;
  if (r.geoFim !== undefined) row.geo_fim = r.geoFim;
  if (r.resumoExecucao !== undefined) row.resumo_execucao = r.resumoExecucao;
  if (r.observacoesGerais !== undefined) row.observacoes_gerais = r.observacoesGerais;
  if (r.syncStatus !== undefined) row.sync_status = r.syncStatus;
  if (r.clientUuid !== undefined) row.client_uuid = r.clientUuid;
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

/**
 * Congela a DEFINIÇÃO do formulário no relatório (CAMPO 2B). Escrito em passo
 * SEPARADO e NÃO-FATAL: se a migration 0075 ainda não foi aplicada (colunas
 * ausentes), a falha é engolida e o relatório permanece "legado" (fallback ao
 * template vigente) — nada quebra entre o deploy e a migration. Idempotente: o
 * trigger de imutabilidade (0075) só permite preencher quando NULL. Não é
 * incluído em reportToRow de propósito, para manter insert/update compatíveis.
 */
export async function attachTemplateSnapshot(
  reportId: string,
  version: number | undefined,
  snapshot: unknown
): Promise<boolean> {
  if (!reportId || snapshot == null) return false;
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase
    .from('reports')
    .update({ template_version: version ?? null, template_snapshot: snapshot })
    .eq('id', reportId);
  if (error) {
    // 42703 (undefined_column) / PGRST204 = migration 0075 pendente. Não é erro fatal.
    console.warn('Snapshot do template não persistido (0075 pendente?):', error?.message || error);
    return false;
  }
  return true;
}

export async function deleteReport(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from('reports').delete().eq('id', id);
  if (error) throw error;
}

/* --------------------------- report_answers (v2.0) --------------------------- */

function rowToAnswer(r: any): ReportAnswer {
  return {
    id: String(r.id),
    reportId: String(r.report_id),
    secao: r.secao ?? undefined,
    fieldKey: r.campo_key || '',
    valor: r.valor ?? null,
    deviceId: r.device_id ?? undefined,
    observacao: r.observacao ?? undefined,
    repeaterIdx: r.repeater_idx ?? undefined,
  };
}

function answerToRow(a: ReportAnswer): Record<string, unknown> {
  const row: Record<string, unknown> = {
    report_id: a.reportId,
    secao: a.secao ?? null,
    campo_key: a.fieldKey,
    valor: a.valor ?? null,
    device_id: a.deviceId ?? null,
    observacao: a.observacao ?? null,
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

/* ---------------------------- report_media (v2.0) ---------------------------- */

function rowToMedia(r: any): ReportMedia {
  return {
    id: String(r.id),
    reportId: String(r.report_id),
    answerId: r.answer_id ?? undefined,
    pendenciaId: r.pendencia_id ?? undefined,
    deviceId: r.device_id ?? undefined,
    tipo: (r.tipo || 'evidencia') as ReportMedia['tipo'],
    storagePathOriginal: r.storage_path_original || '',
    storagePathMarcado: r.storage_path_marcado ?? undefined,
    notaRapida: r.nota_rapida ?? undefined,
    legenda: r.legenda ?? undefined,
    geo: r.geo ?? undefined,
    ordem: r.ordem ?? undefined,
    capturadoEm: r.capturado_em ?? undefined,
  };
}

function mediaToRow(m: ReportMedia): Record<string, unknown> {
  const row: Record<string, unknown> = {
    report_id: m.reportId,
    answer_id: m.answerId ?? null,
    pendencia_id: m.pendenciaId ?? null,
    device_id: m.deviceId ?? null,
    tipo: m.tipo,
    storage_path_original: m.storagePathOriginal,
    storage_path_marcado: m.storagePathMarcado ?? null,
    nota_rapida: m.notaRapida ?? null,
    legenda: m.legenda ?? null,
    geo: m.geo ?? null,
    ordem: m.ordem ?? 0,
  };
  if (m.capturadoEm) row.capturado_em = m.capturadoEm;
  if (m.id) row.id = m.id;
  return row;
}

export async function fetchMedia(reportId: string): Promise<ReportMedia[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from('report_media')
    .select('*')
    .eq('report_id', reportId)
    .order('capturado_em', { ascending: true });
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
    .order('capturado_em', { ascending: true });
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
