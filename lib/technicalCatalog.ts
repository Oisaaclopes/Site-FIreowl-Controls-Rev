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

/** Fabricantes distintos, opcionalmente filtrados por área (category). */
export function manufacturersFromCatalog(items: TechnicalCatalogItem[], area?: string): string[] {
  const scope = area ? items.filter((i) => (i.category || '') === area) : items;
  return uniqCI(scope.map((i) => i.brand || ''));
}

/** Modelos de um fabricante (área opcional). Mantém o item para referência. */
export function modelsForManufacturer(
  items: TechnicalCatalogItem[],
  brand: string,
  area?: string
): TechnicalCatalogItem[] {
  const b = (brand || '').trim().toLowerCase();
  return items
    .filter((i) => (i.brand || '').trim().toLowerCase() === b)
    .filter((i) => !area || (i.category || '') === area)
    .filter((i) => (i.model || i.name || '').trim())
    .sort((a, b2) => (a.model || a.name).localeCompare(b2.model || b2.name, 'pt-BR'));
}

/** Áreas (categorias) distintas do catálogo. */
export function areasFromCatalog(items: TechnicalCatalogItem[]): string[] {
  return uniqCI(items.map((i) => i.category || ''));
}
