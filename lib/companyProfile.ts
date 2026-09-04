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
    website: r.website || undefined,
    regimeTributario: r.regime_tributario || '',
    logoUrl: r.logo_url || undefined,
    apresentacaoGeral: r.apresentacao_geral || undefined,
    apresentacaoAreas: (r.apresentacao_areas && typeof r.apresentacao_areas === 'object') ? r.apresentacao_areas : undefined,
    capaAreas: (r.capa_areas && typeof r.capa_areas === 'object') ? r.capa_areas : undefined,
    logoPrincipalPath: r.logo_principal_path || undefined,
    logoClaroPath: r.logo_claro_path || undefined,
    logoEscuroPath: r.logo_escuro_path || undefined,
    logoIconePath: r.logo_icone_path || undefined,
    expIntro: r.exp_intro || undefined,
    techIntro: r.tech_intro || undefined,
    expMaxEmpresas: r.exp_max_empresas ?? undefined,
    expMaxMarcas: r.exp_max_marcas ?? undefined,
  };
}

/**
 * §3 — normalização do site institucional. O usuário digita "de qualquer jeito"
 * (com ou sem https://, com ou sem www, com barra final); daqui saem duas
 * representações consistentes, sem o usuário precisar entender a diferença:
 *   - websiteDisplay: para EXIBIÇÃO (ex.: www.fireowlcontrols.com.br)
 *   - websiteHref:    para LINK     (ex.: https://www.fireowlcontrols.com.br)
 */
export function websiteDisplay(raw?: string): string {
  const s = (raw || '').trim();
  if (!s) return '';
  return s
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
}

export function websiteHref(raw?: string): string {
  const s = (raw || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s.replace(/\/+$/, '');
  return `https://${s.replace(/\/+$/, '')}`;
}

/** §20 — storage_path da capa da 1ª área da proposta que tiver capa cadastrada. */
export function capaAreaPath(profile: { capaAreas?: Record<string, string> } | undefined, areaIds: string[]): string | undefined {
  const mapa = profile?.capaAreas;
  if (!mapa) return undefined;
  for (const id of areaIds) {
    const p = mapa[id];
    if (p && p.trim()) return p;
  }
  return undefined;
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
    website: p.website || null,
    regime_tributario: p.regimeTributario || null,
    logo_url: p.logoUrl || null,
    apresentacao_geral: p.apresentacaoGeral || null,
    apresentacao_areas: p.apresentacaoAreas || {},
    capa_areas: p.capaAreas || {},
    logo_principal_path: p.logoPrincipalPath || null,
    logo_claro_path: p.logoClaroPath || null,
    logo_escuro_path: p.logoEscuroPath || null,
    logo_icone_path: p.logoIconePath || null,
    exp_intro: p.expIntro || null,
    tech_intro: p.techIntro || null,
    exp_max_empresas: p.expMaxEmpresas ?? 8,
    exp_max_marcas: p.expMaxMarcas ?? 8,
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
