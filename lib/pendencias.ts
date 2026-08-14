import { getSupabaseClient } from './supabaseClient';
import { Pendencia, PendenciaStatus, UserRole } from './types';

const TABLE = 'pendencias';

// Colunas seguras para o perfil Técnico: tudo, MENOS criticidade_operacional.
// (RLS do Postgres é por linha; a ocultação da coluna é feita aqui.)
const TECNICO_COLUMNS =
  'id,cliente_id,device_id,report_origem_id,grupo,descricao,acao_recomendada,' +
  'norma_referencia,local,quantidade,unidade,item_catalogo_id,item_texto_livre,' +
  'precisa_cadastro_catalogo,status,proposta_id,report_execucao_id,criada_em,resolvida_em';

function rowToPendencia(r: any): Pendencia {
  return {
    id: String(r.id),
    clienteId: r.cliente_id ?? undefined,
    deviceId: r.device_id ?? undefined,
    reportOrigemId: r.report_origem_id ?? undefined,
    grupo: r.grupo ?? undefined,
    descricao: r.descricao ?? undefined,
    acaoRecomendada: r.acao_recomendada ?? undefined,
    normaReferencia: r.norma_referencia ?? undefined,
    local: r.local ?? undefined,
    quantidade: r.quantidade ?? undefined,
    unidade: r.unidade ?? undefined,
    itemCatalogoId: r.item_catalogo_id ?? undefined,
    itemTextoLivre: r.item_texto_livre ?? undefined,
    precisaCadastroCatalogo: r.precisa_cadastro_catalogo ?? false,
    // Presente apenas quando a coluna foi selecionada (admin/gestor).
    criticidadeOperacional: r.criticidade_operacional ?? undefined,
    status: (r.status || 'aberta') as PendenciaStatus,
    propostaId: r.proposta_id ?? undefined,
    reportExecucaoId: r.report_execucao_id ?? undefined,
    criadaEm: r.criada_em ?? undefined,
    resolvidaEm: r.resolvida_em ?? undefined,
  };
}

function pendenciaToRow(p: Pendencia): Record<string, unknown> {
  const row: Record<string, unknown> = {
    cliente_id: p.clienteId ?? null,
    device_id: p.deviceId ?? null,
    report_origem_id: p.reportOrigemId ?? null,
    grupo: p.grupo ?? null,
    descricao: p.descricao ?? null,
    acao_recomendada: p.acaoRecomendada ?? null,
    norma_referencia: p.normaReferencia ?? null,
    local: p.local ?? null,
    quantidade: p.quantidade ?? 1,
    unidade: p.unidade ?? null,
    item_catalogo_id: p.itemCatalogoId ?? null,
    item_texto_livre: p.itemTextoLivre ?? null,
    precisa_cadastro_catalogo: p.precisaCadastroCatalogo ?? false,
    status: p.status ?? 'aberta',
    proposta_id: p.propostaId ?? null,
    report_execucao_id: p.reportExecucaoId ?? null,
    resolvida_em: p.resolvidaEm ?? null,
  };
  // criticidade só é gravada por admin/gestor (a RLS de update também bloqueia
  // técnico); só enviamos quando definida.
  if (p.criticidadeOperacional !== undefined) row.criticidade_operacional = p.criticidadeOperacional;
  if (p.id) row.id = p.id;
  return row;
}

/**
 * Lê pendências. Para o perfil TÉCNICO, seleciona apenas as colunas seguras
 * (sem criticidade_operacional). Para os demais, seleciona tudo.
 */
export async function fetchPendencias(
  role: UserRole,
  filter?: { clienteId?: string; status?: PendenciaStatus; reportOrigemId?: string }
): Promise<Pendencia[]> {
  const supabase = getSupabaseClient() as any;
  const cols = role === 'TECNICO' ? TECNICO_COLUMNS : '*';
  let query = supabase.from(TABLE).select(cols).order('criada_em', { ascending: false });
  if (filter?.clienteId) query = query.eq('cliente_id', filter.clienteId);
  if (filter?.status) query = query.eq('status', filter.status);
  if (filter?.reportOrigemId) query = query.eq('report_origem_id', filter.reportOrigemId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(rowToPendencia);
}

export async function insertPendencia(p: Pendencia): Promise<Pendencia> {
  const supabase = getSupabaseClient() as any;
  const { id, ...rest } = pendenciaToRow(p); // banco gera o uuid
  void id;
  const { data, error } = await supabase.from(TABLE).insert(rest).select().single();
  if (error) throw error;
  return rowToPendencia(data);
}

/** Atualiza a pendência (status, criticidade, vínculo à proposta...). Admin/Gestor. */
export async function updatePendencia(p: Pendencia): Promise<Pendencia> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).update(pendenciaToRow(p)).eq('id', p.id).select().single();
  if (error) throw error;
  return rowToPendencia(data);
}

export async function updatePendenciaStatus(
  id: string,
  status: PendenciaStatus,
  extra?: { propostaId?: string; reportExecucaoId?: string; resolvidaEm?: string }
): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const patch: Record<string, unknown> = { status };
  if (extra?.propostaId !== undefined) patch.proposta_id = extra.propostaId;
  if (extra?.reportExecucaoId !== undefined) patch.report_execucao_id = extra.reportExecucaoId;
  if (extra?.resolvidaEm !== undefined) patch.resolvida_em = extra.resolvidaEm;
  const { error } = await supabase.from(TABLE).update(patch).eq('id', id);
  if (error) throw error;
}

export async function deletePendencia(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
