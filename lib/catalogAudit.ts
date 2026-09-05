import type { InventoryItem } from './types';
import { normalizeBrand } from './catalogSelection';

// =====================================================================
// AUDITORIA DE QUALIDADE DO CATÁLOGO (read-only, pura, testável).
//
// Instrumento objetivo que consome inventory_items e produz o relatório de
// consistência que alimenta os pickers (Cadastro de Produto, Proposta) e o
// Levantamento. NÃO altera nada — só analisa. Reutiliza a mesma normalização
// de marca dos pickers, para que "duplicidade" aqui signifique o mesmo que lá.
//
// Distingue duas noções de "classificado":
//   • família (subcategory) — o que agrupa o seletor de materiais da Proposta;
//   • canônica (canonicalTaxonomyId/classificationStatus) — a árvore do Estoque.
// Um item pode ter família mas não ter classificação canônica.
// =====================================================================

export const CANONICAL_AREAS = ['SDAI', 'CFTV', 'ALARME', 'BMS', 'CONTROLE_ACESSO'];

const has = (s?: string | null) => !!(s || '').trim();
/** Colapsa um modelo a chave alfanumérica: "DFC 421"/"DFC-421"/"dfc421" → "dfc421". */
const normModel = (s?: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const normSub = (s?: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export interface AreaCount {
  area: string;
  total: number;
  withBrand: number;
  withoutBrand: number;
  withModel: number;
  withoutModel: number;
  withSubcategory: number;
  unclassifiedFamily: number;   // sem subcategory → cai em "Outros / Não classificados"
  canonicalClassified: number;  // canonicalTaxonomyId presente / status CLASSIFICADO
  unclassifiedCanonical: number;
  catalogOnly: number;
  stockManaged: number;
}

export interface AuditItemRef { id: string; code?: string; name: string; brand?: string; model?: string; category?: string; subcategory?: string; }
export interface BrandDup { normalized: string; variants: string[] }
export interface ModelDup { area: string; family: string; brand: string; normalizedModel: string; items: AuditItemRef[] }

export interface CatalogAudit {
  total: number;
  areas: AreaCount[];
  missingCategory: AuditItemRef[];
  missingSubcategory: AuditItemRef[];
  missingBrand: AuditItemRef[];
  missingModel: AuditItemRef[];
  unclassifiedFamily: AuditItemRef[];
  areaOutsideCanonical: AuditItemRef[];
  brandDuplicates: BrandDup[];
  modelDuplicates: ModelDup[];
}

const ref = (i: InventoryItem): AuditItemRef => ({
  id: i.id, code: i.code || undefined, name: i.name, brand: i.brand, model: i.model, category: i.category, subcategory: i.subcategory,
});

const isCanonicalClassified = (i: InventoryItem) =>
  has(i.canonicalTaxonomyId) || i.classificationStatus === 'CLASSIFICADO';
const isCatalogOnly = (i: InventoryItem) => i.catalogOnly === true || i.stockManaged === false;

/** Executa a auditoria completa (read-only). */
export function auditCatalog(items: InventoryItem[]): CatalogAudit {
  const areaKey = (i: InventoryItem) => (has(i.category) ? i.category.trim().toUpperCase() : 'SEM ÁREA');
  const areaMap = new Map<string, InventoryItem[]>();
  for (const i of items) {
    const k = areaKey(i);
    (areaMap.get(k) || areaMap.set(k, []).get(k)!).push(i);
  }

  const areas: AreaCount[] = [...areaMap.entries()]
    .map(([area, list]) => ({
      area,
      total: list.length,
      withBrand: list.filter((i) => has(i.brand)).length,
      withoutBrand: list.filter((i) => !has(i.brand)).length,
      withModel: list.filter((i) => has(i.model)).length,
      withoutModel: list.filter((i) => !has(i.model)).length,
      withSubcategory: list.filter((i) => has(i.subcategory)).length,
      unclassifiedFamily: list.filter((i) => !has(i.subcategory)).length,
      canonicalClassified: list.filter((i) => isCanonicalClassified(i)).length,
      unclassifiedCanonical: list.filter((i) => !isCanonicalClassified(i)).length,
      catalogOnly: list.filter((i) => isCatalogOnly(i)).length,
      stockManaged: list.filter((i) => i.stockManaged !== false).length,
    }))
    .sort((a, b) => a.area.localeCompare(b.area, 'pt-BR'));

  // Duplicidade de marca (mesma chave normalizada, grafias diferentes).
  const brandVariants = new Map<string, Set<string>>();
  for (const i of items) {
    if (!has(i.brand)) continue;
    const k = normalizeBrand(i.brand!);
    if (!k) continue;
    (brandVariants.get(k) || brandVariants.set(k, new Set()).get(k)!).add(i.brand!.trim());
  }
  const brandDuplicates: BrandDup[] = [...brandVariants.entries()]
    .filter(([, v]) => v.size > 1)
    .map(([normalized, v]) => ({ normalized, variants: [...v].sort((a, b) => a.localeCompare(b, 'pt-BR')) }));

  // Duplicidade de modelo no mesmo contexto (área + família + marca + modelo normalizado).
  const modelBuckets = new Map<string, { area: string; family: string; brand: string; normalizedModel: string; items: InventoryItem[] }>();
  for (const i of items) {
    if (!has(i.model)) continue;
    const nm = normModel(i.model);
    if (!nm) continue;
    const key = [areaKey(i), normSub(i.subcategory), normalizeBrand(i.brand || ''), nm].join('||');
    const b = modelBuckets.get(key);
    if (b) b.items.push(i);
    else modelBuckets.set(key, { area: areaKey(i), family: (i.subcategory || '').trim() || '—', brand: (i.brand || '').trim() || '—', normalizedModel: nm, items: [i] });
  }
  const modelDuplicates: ModelDup[] = [...modelBuckets.values()]
    .filter((b) => b.items.length > 1)
    .map((b) => ({ area: b.area, family: b.family, brand: b.brand, normalizedModel: b.normalizedModel, items: b.items.map(ref) }));

  return {
    total: items.length,
    areas,
    missingCategory: items.filter((i) => !has(i.category)).map(ref),
    missingSubcategory: items.filter((i) => !has(i.subcategory)).map(ref),
    missingBrand: items.filter((i) => !has(i.brand)).map(ref),
    missingModel: items.filter((i) => !has(i.model)).map(ref),
    unclassifiedFamily: items.filter((i) => !has(i.subcategory)).map(ref),
    areaOutsideCanonical: items.filter((i) => has(i.category) && !CANONICAL_AREAS.includes(i.category.trim().toUpperCase())).map(ref),
    brandDuplicates,
    modelDuplicates,
  };
}
