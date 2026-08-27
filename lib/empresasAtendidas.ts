import { getSupabaseClient } from './supabaseClient';
import { EmpresaAtendida, AutorizacaoMarca } from './types';

const TABLE = 'empresas_atendidas';

function rowToEmpresa(r: any): EmpresaAtendida {
  return {
    id: String(r.id),
    nome: r.nome || '',
    nomeFantasia: r.nome_fantasia || undefined,
    logoPath: r.logo_path || undefined,
    descricao: r.descricao || undefined,
    segmentos: Array.isArray(r.segmentos) ? r.segmentos : [],
    areas: Array.isArray(r.areas) ? r.areas : [],
    destaque: !!r.destaque,
    ativo: r.ativo !== false,
    exibirProposta: r.exibir_proposta !== false,
    autorizacao: (r.autorizacao || 'nao_informado') as AutorizacaoMarca,
    ordem: Number(r.ordem ?? 0),
  };
}

function empresaToRow(e: EmpresaAtendida): Record<string, unknown> {
  return {
    id: e.id,
    nome: e.nome,
    nome_fantasia: e.nomeFantasia || null,
    logo_path: e.logoPath || null,
    descricao: e.descricao || null,
    segmentos: e.segmentos || [],
    areas: e.areas || [],
    destaque: !!e.destaque,
    ativo: e.ativo !== false,
    exibir_proposta: e.exibirProposta !== false,
    autorizacao: e.autorizacao || 'nao_informado',
    ordem: e.ordem ?? 0,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchEmpresasAtendidas(): Promise<EmpresaAtendida[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).select('*').order('ordem', { ascending: true }).order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToEmpresa);
}

export async function upsertEmpresaAtendida(e: EmpresaAtendida): Promise<EmpresaAtendida> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).upsert(empresaToRow(e), { onConflict: 'id' }).select().single();
  if (error) throw error;
  return rowToEmpresa(data);
}

export async function deleteEmpresaAtendida(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
