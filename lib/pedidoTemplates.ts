import { PedidoTemplate } from './types';
import { getSupabaseClient } from './supabaseClient';

const TABLE = 'pedido_templates';

const fromRow = (row: any): PedidoTemplate => ({
  ...(row.template || {}),
  id: String(row.id),
  name: row.name || 'Modelo sem nome',
  clientId: row.client_id || undefined,
});

const toRow = (template: PedidoTemplate) => ({
  id: template.id,
  name: template.name,
  client_id: template.clientId || null,
  template: {
    objetivo: template.objetivo,
    diretrizesNormativas: template.diretrizesNormativas,
    escopoServico: template.escopoServico,
    entregaveis: template.entregaveis,
    premissas: template.premissas,
    responsabilidadesContratada: template.responsabilidadesContratada,
    responsabilidadesContratante: template.responsabilidadesContratante,
    garantia: template.garantia,
    conclusao: template.conclusao,
  },
  updated_at: new Date().toISOString(),
});

export async function fetchPedidoTemplates(): Promise<PedidoTemplate[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).select('*').order('name');
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function upsertPedidoTemplate(template: PedidoTemplate): Promise<PedidoTemplate> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).upsert(toRow(template), { onConflict: 'id' }).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function deletePedidoTemplate(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
