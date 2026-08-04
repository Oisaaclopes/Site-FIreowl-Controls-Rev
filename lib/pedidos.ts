import { getSupabaseClient } from './supabaseClient';
import { Pedido, PedidoStatus, CommercialProposalData } from './types';

const TABLE = 'pedidos';

function rowToPedido(r: any): Pedido {
  return {
    id: String(r.id),
    numeroPedido: r.numero_pedido || '',
    referencia: r.referencia || '',
    clienteId: r.cliente_id || '',
    clienteNome: r.cliente_nome || '',
    fornecedor: r.fornecedor || '',
    dataEmissao: r.data_emissao || '',
    responsavelComercialId: r.responsavel_comercial_id || '',
    responsavelComercialNome: r.responsavel_comercial_nome || '',
    status: (r.status || 'rascunho') as PedidoStatus,
    proposal: (r.proposal || {}) as CommercialProposalData,
    createdAt: r.created_at || '',
    updatedAt: r.updated_at || '',
  };
}

function pedidoToRow(p: Pedido): Record<string, unknown> {
  return {
    id: p.id,
    numero_pedido: p.numeroPedido,
    referencia: p.referencia,
    cliente_id: p.clienteId,
    cliente_nome: p.clienteNome,
    fornecedor: p.fornecedor,
    data_emissao: p.dataEmissao,
    responsavel_comercial_id: p.responsavelComercialId,
    responsavel_comercial_nome: p.responsavelComercialNome,
    status: p.status,
    valor_total: p.proposal?.valorTotal ?? 0,
    proposal: p.proposal ?? {},
    updated_at: new Date().toISOString(),
  };
}

export async function fetchPedidos(): Promise<Pedido[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToPedido);
}

// Cria ou atualiza (upsert por id) — usado ao salvar a proposta
export async function upsertPedido(p: Pedido): Promise<Pedido> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(pedidoToRow(p), { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return rowToPedido(data);
}

export async function updatePedidoStatus(id: string, status: PedidoStatus): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase
    .from(TABLE)
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
