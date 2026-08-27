import { getSupabaseClient } from './supabaseClient';
import { CompanyProfile } from './types';

const TABLE = 'company_profile';

function rowToProfile(r: any): CompanyProfile {
  return {
    razaoSocial: r.razao_social || 'Fireowl Controls Technology Ltda.',
    nomeFantasia: r.nome_fantasia || undefined,
    cnpj: r.cnpj || '',
    endereco: r.endereco || '',
    telefone: r.telefone || '',
    email: r.email || '',
    regimeTributario: r.regime_tributario || '',
    logoUrl: r.logo_url || undefined,
    apresentacaoGeral: r.apresentacao_geral || undefined,
    apresentacaoAreas: (r.apresentacao_areas && typeof r.apresentacao_areas === 'object') ? r.apresentacao_areas : undefined,
  };
}

function profileToRow(p: CompanyProfile): Record<string, unknown> {
  return {
    id: 1,
    razao_social: p.razaoSocial,
    nome_fantasia: p.nomeFantasia || null,
    cnpj: p.cnpj || null,
    endereco: p.endereco || null,
    telefone: p.telefone || null,
    email: p.email || null,
    regime_tributario: p.regimeTributario || null,
    logo_url: p.logoUrl || null,
    apresentacao_geral: p.apresentacaoGeral || null,
    apresentacao_areas: p.apresentacaoAreas || {},
    updated_at: new Date().toISOString(),
  };
}

/** Busca o perfil da empresa (linha singleton). null se ainda não existe. */
export async function fetchCompanyProfile(): Promise<CompanyProfile | null> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', 1).maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data) : null;
}

/** Cria/atualiza o perfil da empresa (upsert na linha id = 1). */
export async function upsertCompanyProfile(p: CompanyProfile): Promise<CompanyProfile> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).upsert(profileToRow(p), { onConflict: 'id' }).select().single();
  if (error) throw error;
  return rowToProfile(data);
}
