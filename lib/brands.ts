import { getSupabaseClient } from './supabaseClient';
import { PartnerBrand } from './types';

/* Marcas/fabricantes persistidos (tabela brands). A chave de ligação com
 * fornecedores/estoque/dispositivos é o NOME da marca. */

const TABLE = 'brands';

function rowToBrand(r: any): PartnerBrand {
  return {
    id: String(r.id),
    name: r.name || '',
    category: r.category || '',
    logoUrl: r.logo_url ?? undefined,
    segment: r.segment ?? undefined,
  };
}

export async function fetchBrands(): Promise<PartnerBrand[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).select('*').order('name', { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToBrand);
}

/** Garante que a marca existe (idempotente por nome) e devolve a linha. */
export async function ensureBrand(name: string, category = 'SDAI'): Promise<PartnerBrand> {
  return upsertBrand({ id: '', name, category });
}

/** Cria ou atualiza os dados de uma marca homologada. */
export async function upsertBrand(brand: PartnerBrand): Promise<PartnerBrand> {
  const nome = brand.name.trim();
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from(TABLE)
    .upsert({ name: nome, category: brand.category, logo_url: brand.logoUrl ?? null, segment: brand.segment ?? null }, { onConflict: 'name' })
    .select()
    .single();
  if (error) throw error;
  return rowToBrand(data);
}

export async function deleteBrand(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

/** Semeia a tabela a partir das marcas empacotadas, sem duplicar (por nome). */
export async function seedBrands(iniciais: PartnerBrand[]): Promise<void> {
  if (iniciais.length === 0) return;
  const supabase = getSupabaseClient() as any;
  const rows = iniciais.map((b) => ({ name: b.name, category: b.category, logo_url: b.logoUrl ?? null, segment: b.segment ?? null }));
  const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'name' });
  if (error) throw error;
}
