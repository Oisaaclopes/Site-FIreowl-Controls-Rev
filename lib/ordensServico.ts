import { getSupabaseClient } from './supabaseClient';
import { OrdemServico, OrdemServicoStatus } from './types';

const TABLE = 'ordens_servico';

function rowToOS(r: any): OrdemServico {
  return {
    id: String(r.id),
    numero: r.numero ?? undefined,
    clienteId: r.cliente_id ?? undefined,
    contratoId: r.contrato_id ?? undefined,
    tipo: (r.tipo || 'corretiva') as OrdemServico['tipo'],
    titulo: r.titulo ?? undefined,
    descricao: r.descricao ?? undefined,
    status: (r.status || 'aberta') as OrdemServicoStatus,
    prioridade: (r.prioridade || 'media') as OrdemServico['prioridade'],
    pendenciaIds: Array.isArray(r.pendencia_ids) ? r.pendencia_ids.map(String) : [],
    reportId: r.report_id ?? undefined,
    dataAbertura: r.data_abertura ?? undefined,
    dataPrevista: r.data_prevista ?? undefined,
    dataConclusao: r.data_conclusao ?? undefined,
    criadoPor: r.criado_por ?? undefined,
  };
}

function osToRow(o: OrdemServico): Record<string, unknown> {
  const row: Record<string, unknown> = {
    numero: o.numero ?? null,
    cliente_id: o.clienteId ?? null,
    contrato_id: o.contratoId ?? null,
    tipo: o.tipo ?? 'corretiva',
    titulo: o.titulo ?? null,
    descricao: o.descricao ?? null,
    status: o.status ?? 'aberta',
    prioridade: o.prioridade ?? 'media',
    pendencia_ids: o.pendenciaIds ?? [],
    report_id: o.reportId ?? null,
    data_prevista: o.dataPrevista ?? null,
    data_conclusao: o.dataConclusao ?? null,
  };
  if (o.dataAbertura) row.data_abertura = o.dataAbertura;
  if (o.id) row.id = o.id;
  return row;
}

export async function fetchOrdensServico(filter?: {
  clienteId?: string;
  status?: OrdemServicoStatus | OrdemServicoStatus[];
}): Promise<OrdemServico[]> {
  const supabase = getSupabaseClient() as any;
  let query = supabase.from(TABLE).select('*').order('data_abertura', { ascending: false });
  if (filter?.clienteId) query = query.eq('cliente_id', filter.clienteId);
  if (filter?.status) {
    query = Array.isArray(filter.status)
      ? query.in('status', filter.status)
      : query.eq('status', filter.status);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(rowToOS);
}

/** Gera o próximo número OS-AAAA-NNNN a partir das OS existentes do ano. */
export async function nextOsNumero(): Promise<string> {
  const ano = new Date().getFullYear();
  const supabase = getSupabaseClient() as any;
  const { data } = await supabase
    .from(TABLE)
    .select('numero')
    .like('numero', `OS-${ano}-%`);
  const maior = (data || []).reduce((max: number, r: any) => {
    const n = Number(String(r.numero || '').split('-')[2] || 0);
    return n > max ? n : max;
  }, 0);
  return `OS-${ano}-${String(maior + 1).padStart(4, '0')}`;
}

export async function createOrdemServico(o: OrdemServico): Promise<OrdemServico> {
  const supabase = getSupabaseClient() as any;
  const { id, ...rest } = osToRow(o);
  void id;
  const { data, error } = await supabase.from(TABLE).insert(rest).select().single();
  if (error) throw error;
  return rowToOS(data);
}

export async function updateOrdemServico(o: OrdemServico): Promise<OrdemServico> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).update(osToRow(o)).eq('id', o.id).select().single();
  if (error) throw error;
  return rowToOS(data);
}

export async function updateOrdemServicoStatus(
  id: string,
  status: OrdemServicoStatus,
  extra?: { reportId?: string; dataConclusao?: string }
): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const patch: Record<string, unknown> = { status };
  if (extra?.reportId !== undefined) patch.report_id = extra.reportId;
  if (extra?.dataConclusao !== undefined) patch.data_conclusao = extra.dataConclusao;
  const { error } = await supabase.from(TABLE).update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteOrdemServico(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
