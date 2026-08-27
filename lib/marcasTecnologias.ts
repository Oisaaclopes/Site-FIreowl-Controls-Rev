import { getSupabaseClient } from './supabaseClient';
import { MarcaTecnologia } from './types';

const TABLE = 'marcas_tecnologias';

function rowToMarca(r: any): MarcaTecnologia {
  return {
    id: String(r.id),
    nome: r.nome || '',
    logoPath: r.logo_path || undefined,
    descricao: r.descricao || undefined,
    categoria: r.categoria || undefined,
    areas: Array.isArray(r.areas) ? r.areas : [],
    tecnologias: Array.isArray(r.tecnologias) ? r.tecnologias : [],
    ativo: r.ativo !== false,
    exibirProposta: r.exibir_proposta !== false,
    ordem: Number(r.ordem ?? 0),
  };
}

function marcaToRow(m: MarcaTecnologia): Record<string, unknown> {
  return {
    id: m.id,
    nome: m.nome,
    logo_path: m.logoPath || null,
    descricao: m.descricao || null,
    categoria: m.categoria || null,
    areas: m.areas || [],
    tecnologias: m.tecnologias || [],
    ativo: m.ativo !== false,
    exibir_proposta: m.exibirProposta !== false,
    ordem: m.ordem ?? 0,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchMarcasTecnologias(): Promise<MarcaTecnologia[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).select('*').order('ordem', { ascending: true }).order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToMarca);
}

export async function upsertMarcaTecnologia(m: MarcaTecnologia): Promise<MarcaTecnologia> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).upsert(marcaToRow(m), { onConflict: 'id' }).select().single();
  if (error) throw error;
  return rowToMarca(data);
}

export async function deleteMarcaTecnologia(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
