import { getSupabaseClient } from './supabaseClient';

/* ===================================================================
 * CORREÇÃO 3B.2 — Catálogo TÉCNICO para o técnico (consulta, não gestão).
 * Fonte canônica: a view `technical_catalog` (0086), projeção somente-
 * identificação do estoque — SEM preço/custo/margem/fornecedor e SEM filtro de
 * saldo. Serve Relatórios, Atendimento e Fotos com a MESMA fonte (§29/§37).
 * =================================================================== */

/** Item de catálogo para IDENTIFICAÇÃO técnica. Não contém dado comercial. */
export interface TechnicalCatalogItem {
  id: string;
  code?: string;
  name: string;
  /** ÁREA (SDAI/CFTV/ALARME/…). */
  category?: string;
  /** FAMÍLIA / TIPO. */
  subcategory?: string;
  /** FABRICANTE. */
  brand?: string;
  /** MODELO. */
  model?: string;
  productLine?: string;
  unit?: string;
  imageUrl?: string;
  technologies?: string[];
  shortDescription?: string;
  technicalDescription?: string;
  recommendedUse?: string;
  datasheetUrl?: string;
  systemType?: string;
  productType?: string;
  catalogStatus?: string;
  marketSegment?: string;
  canonicalTaxonomyId?: string;
}

function rowToItem(r: any): TechnicalCatalogItem {
  return {
    id: String(r.id),
    code: r.code ?? undefined,
    name: r.name ?? '',
    category: r.category ?? undefined,
    subcategory: r.subcategory ?? undefined,
    brand: r.brand ?? undefined,
    model: r.model ?? undefined,
    productLine: r.product_line ?? undefined,
    unit: r.unit ?? undefined,
    imageUrl: r.image_url ?? undefined,
    technologies: Array.isArray(r.technologies) ? r.technologies : undefined,
    shortDescription: r.short_description ?? undefined,
    technicalDescription: r.technical_description ?? undefined,
    recommendedUse: r.recommended_use ?? undefined,
    datasheetUrl: r.datasheet_url ?? undefined,
    systemType: r.system_type ?? undefined,
    productType: r.product_type ?? undefined,
    catalogStatus: r.catalog_status ?? undefined,
    marketSegment: r.market_segment ?? undefined,
    canonicalTaxonomyId: r.canonical_taxonomy_id ?? undefined,
  };
}

/**
 * Lê o catálogo técnico (view segura). NUNCA filtra por saldo — um equipamento
 * com saldo 0 continua selecionável para IDENTIFICAÇÃO (§28). Falha de rede/
 * permissão degrada para lista vazia (a UI oferece identificação manual).
 */
export async function fetchTechnicalCatalog(): Promise<TechnicalCatalogItem[]> {
  try {
    const supabase = getSupabaseClient() as any;
    const { data, error } = await supabase
      .from('technical_catalog')
      .select('*')
      .order('brand', { ascending: true });
    if (error) return [];
    return (data || []).map(rowToItem);
  } catch {
    return [];
  }
}

const uniqCI = (arr: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    const v = (raw || '').trim();
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out.sort((a, b) => a.localeCompare(b, 'pt-BR'));
};

/* ------------------------------------------------------------------ *
 * CORREÇÃO 3D — casamento TOLERANTE catálogo × taxonomia da Base (3D.5).
 * A Base usa grupos canônicos ("Central SDAI", "Repetidora de SDAI", …) e o
 * technical_catalog usa a família/tipo do estoque ("Central", "Detector óptico
 * de fumaça"…). Igualdade exata falhava → "Nenhum fabricante encontrado".
 * Aqui normalizamos e casamos por TOKENS, adaptando a taxonomia SEM reverter os
 * nomes da Base e SEM alterar o nome comercial do catálogo. Quando o grupo não
 * casa nenhuma subcategoria (catálogo sem essa família), cai para o escopo da
 * ÁREA — nunca some com os fabricantes da disciplina. Nunca filtra por saldo.
 * ------------------------------------------------------------------ */
const norm = (s?: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokenize = (s?: string) => norm(s).split(' ').filter(Boolean);

// Tokens que NÃO discriminam família (disciplina/conectivos) — removidos do núcleo do grupo.
const GROUP_STOPWORDS = new Set(['sdai', 'cftv', 'bms', 'alarme', 'de', 'da', 'do', 'das', 'dos', 'e']);
// Tokens da ÁREA (category) por código canônico.
const AREA_TOKENS: Record<string, string[]> = {
  SDAI: ['sdai'], CFTV: ['cftv'], BMS: ['bms', 'automacao'], ALARME: ['alarme'], CONTROLE_ACESSO: ['controle', 'acesso'],
};

/** Área do catálogo casa a área pedida (tolerante a rótulo/caixa/acentos). */
export function areaMatches(category?: string, area?: string): boolean {
  if (!area) return true;
  const cat = tokenize(category);
  if (cat.length === 0) return false;
  const want = AREA_TOKENS[area] || tokenize(area);
  const catSet = new Set(cat);
  // casa se a área é código exato, OU todos os tokens da área estão na categoria,
  // OU há interseção (ex.: category "Detecção SDAI" contém "sdai").
  if (norm(category) === norm(area)) return true;
  if (want.every((t) => catSet.has(t))) return true;
  return want.some((t) => catSet.has(t));
}

/** Núcleo discriminante de um grupo da Base (sem disciplina/conectivos). */
function groupCore(group?: string): string[] {
  return tokenize(group).filter((t) => !GROUP_STOPWORDS.has(t));
}

/** Grupo da Base casa a subcategoria/família do catálogo (por tokens). */
export function groupMatchesSubcategory(group?: string, subcategory?: string): boolean {
  const core = groupCore(group);
  if (core.length === 0) return true;                 // grupo genérico → não restringe
  const sub = new Set(tokenize(subcategory));
  if (sub.size === 0) return false;
  return core.some((t) => sub.has(t));                // interseção de ao menos 1 token forte
}

/**
 * Fabricantes distintos filtrados por área (category) e, quando alinhado, por
 * grupo/família (subcategory). Fallback para o escopo da ÁREA quando o grupo não
 * casa nenhuma subcategoria (§9 — não mascara, apenas adapta a taxonomia). Sem
 * filtro de saldo (§6/§31). Case/acentos-insensitive.
 */
export function manufacturersFromCatalog(items: TechnicalCatalogItem[], area?: string, subcategory?: string): string[] {
  const areaScope = items.filter((i) => areaMatches(i.category, area));
  let scope = areaScope;
  if (subcategory) {
    const narrowed = areaScope.filter((i) => groupMatchesSubcategory(subcategory, i.subcategory));
    if (narrowed.length > 0) scope = narrowed;
  }
  return uniqCI(scope.map((i) => i.brand || ''));
}

/** Modelos de um fabricante (área + grupo/família, com o mesmo fallback). */
export function modelsForManufacturer(
  items: TechnicalCatalogItem[],
  brand: string,
  area?: string,
  subcategory?: string
): TechnicalCatalogItem[] {
  const b = norm(brand);
  const base = items
    .filter((i) => norm(i.brand) === b)
    .filter((i) => areaMatches(i.category, area))
    .filter((i) => (i.model || i.name || '').trim());
  let scope = base;
  if (subcategory) {
    const narrowed = base.filter((i) => groupMatchesSubcategory(subcategory, i.subcategory));
    if (narrowed.length > 0) scope = narrowed;
  }
  return scope.sort((a, b2) => (a.model || a.name).localeCompare(b2.model || b2.name, 'pt-BR'));
}

/** Áreas (category) distintas do catálogo. */
export function areasFromCatalog(items: TechnicalCatalogItem[]): string[] {
  return uniqCI(items.map((i) => i.category || ''));
}

/**
 * Tipos/famílias (subcategory) distintos de uma ÁREA — a taxonomia técnica REAL
 * do catálogo, reutilizada como categoria do Item de Evidência (§25/§26). Sem
 * inventar nomes: usa exatamente os subcategory cadastrados. Case-insensitive
 * na área; ordenado em pt-BR.
 */
export function subcategoriesForArea(items: TechnicalCatalogItem[], area?: string): string[] {
  const scope = area ? items.filter((i) => areaMatches(i.category, area)) : items;
  return uniqCI(scope.map((i) => i.subcategory || ''));
}
