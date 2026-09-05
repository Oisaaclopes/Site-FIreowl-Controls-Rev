import type { InventoryItem } from './types';
import { areaMatches, groupMatchesSubcategory } from './technicalCatalog';

export { areaMatches } from './technicalCatalog';

// =====================================================================
// SELEÇÃO DE CATÁLOGO COMERCIAL (Área → Grupo → Fabricante → Produto).
//
// Camada compartilhada entre o Cadastro de Produto (fabricante/modelo) e o
// seletor de materiais da Proposta. Opera sobre inventory_items (o PRODUTO
// comercial real, com id/código/preço), REUTILIZANDO o casamento tolerante
// da Base Técnica (areaMatches / groupMatchesSubcategory) — sem alterar o
// Levantamento. NUNCA filtra por saldo: item com saldo 0 continua elegível
// (pode ser comprado depois).
//
// Escopo (com fallback controlado, nunca oculta em silêncio):
//   1) área (category, tolerante a rótulo/acentos)
//   2) nó canônico exato (canonicalTaxonomyId) quando houver itens
//   3) senão, grupo/família textual por tokens (subcategory)
//   4) senão, permanece no escopo da área
// =====================================================================

const norm = (s?: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

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

export interface ScopeFilter {
  area?: string;
  /** Nó canônico selecionado (filtro primário e exato). */
  nodeId?: string;
  /** Grupo/família textual (fallback tolerante por tokens). */
  group?: string;
}

/** Itens no escopo (área + nó canônico OU grupo). Nunca filtra saldo. */
export function itemsInScope(items: InventoryItem[], f: ScopeFilter): InventoryItem[] {
  const areaScope = items.filter((i) => areaMatches(i.category, f.area));
  if (f.nodeId) {
    const byNode = areaScope.filter((i) => i.canonicalTaxonomyId === f.nodeId);
    if (byNode.length > 0) return byNode;
  }
  if (f.group && norm(f.group)) {
    const byGroup = areaScope.filter((i) => groupMatchesSubcategory(f.group, i.subcategory));
    if (byGroup.length > 0) return byGroup;
  }
  return areaScope;
}

/** Fabricantes (brand) com produto no escopo. Ordenado, sem duplicar por caixa. */
export function manufacturersInScope(items: InventoryItem[], f: ScopeFilter): string[] {
  return uniqCI(itemsInScope(items, f).map((i) => i.brand || ''));
}

/** Produtos/modelos de um fabricante no escopo (ordenados por modelo/nome). */
export function modelsInScope(items: InventoryItem[], f: ScopeFilter & { brand?: string }): InventoryItem[] {
  const b = norm(f.brand);
  return itemsInScope(items, f)
    .filter((i) => (!f.brand ? true : norm(i.brand) === b))
    .filter((i) => (i.model || i.name || '').trim())
    .sort((a, b2) => (a.model || a.name).localeCompare(b2.model || b2.name, 'pt-BR'));
}

/**
 * Todos os fabricantes conhecidos (marcas cadastradas ∪ marcas do catálogo),
 * SEM escopo de área — usado no cadastro de produto, onde a marca pode ainda
 * não ter produto naquela área. Dedup case-insensitive, ordenado.
 */
export function allManufacturers(items: InventoryItem[], brandNames: string[]): string[] {
  return uniqCI([...(brandNames || []), ...items.map((i) => i.brand || '')]);
}

/** Chave de deduplicação de marca (trim + caixa + acento). */
export function normalizeBrand(name: string): string {
  return norm(name);
}

// ---------------------------------------------------------------------
// SELETOR DE MATERIAIS DA PROPOSTA (Área → Grupo/Família → Fabricante →
// Produto). Agrupa por SUBCATEGORIA EXATA (não por tokens) para o passo a
// passo comercial ser preciso; itens sem subcategoria caem num bucket
// "Não classificados" visível (§18) — nunca ocultados. Nunca filtra saldo.
// ---------------------------------------------------------------------

export const UNCLASSIFIED_GROUP = '__unclassified__';
export const NO_BRAND = '__no_brand__';

export interface CatalogGroup { key: string; label: string; count: number; }

const inArea = (items: InventoryItem[], area?: string) => items.filter((i) => areaMatches(i.category, area));

/** Grupos (subcategoria exata) presentes na área, com contagem. Ordena com
 * "Não classificados" por último. */
export function groupsInArea(items: InventoryItem[], area?: string): CatalogGroup[] {
  const map = new Map<string, { label: string; count: number }>();
  for (const i of inArea(items, area)) {
    const sub = (i.subcategory || '').trim();
    const key = sub ? norm(sub) : UNCLASSIFIED_GROUP;
    const label = sub || 'Outros / Não classificados';
    const cur = map.get(key);
    if (cur) cur.count += 1;
    else map.set(key, { label, count: 1 });
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, label: v.label, count: v.count }))
    .sort((a, b) =>
      a.key === UNCLASSIFIED_GROUP ? 1 : b.key === UNCLASSIFIED_GROUP ? -1 : a.label.localeCompare(b.label, 'pt-BR'));
}

/** Itens de um grupo exato (ou bucket "Não classificados") dentro da área. */
export function itemsInAreaGroup(items: InventoryItem[], area: string | undefined, groupKey?: string): InventoryItem[] {
  const scope = inArea(items, area);
  if (!groupKey) return scope;
  if (groupKey === UNCLASSIFIED_GROUP) return scope.filter((i) => !(i.subcategory || '').trim());
  return scope.filter((i) => norm(i.subcategory) === groupKey);
}

/** Fabricantes de um grupo. Inclui o sentinela NO_BRAND se houver itens sem marca. */
export function brandsInAreaGroup(items: InventoryItem[], area: string | undefined, groupKey?: string): string[] {
  const scope = itemsInAreaGroup(items, area, groupKey);
  const named = uniqCI(scope.map((i) => i.brand || ''));
  const hasBrandless = scope.some((i) => !(i.brand || '').trim());
  return hasBrandless ? [...named, NO_BRAND] : named;
}

/** Produtos de um grupo + fabricante (NO_BRAND = sem marca). Ordena por modelo/nome. */
export function productsInAreaGroup(items: InventoryItem[], area: string | undefined, groupKey?: string, brand?: string): InventoryItem[] {
  const scope = itemsInAreaGroup(items, area, groupKey);
  const b = norm(brand);
  const filtered = !brand
    ? scope
    : brand === NO_BRAND
      ? scope.filter((i) => !(i.brand || '').trim())
      : scope.filter((i) => norm(i.brand) === b);
  return filtered.sort((a, b2) => (a.model || a.name).localeCompare(b2.model || b2.name, 'pt-BR'));
}

/** Busca direta por código/SKU/modelo/nome/fabricante, restrita à área por padrão. */
export function searchCatalogItems(items: InventoryItem[], term: string, area?: string): InventoryItem[] {
  const q = norm(term);
  if (!q) return [];
  const tokens = q.split(' ').filter(Boolean);
  return inArea(items, area)
    .filter((i) => {
      const hay = norm([i.code, i.serialBP, i.model, i.name, i.brand].filter(Boolean).join(' '));
      return tokens.every((t) => hay.includes(t));
    })
    .sort((a, b2) => (a.model || a.name).localeCompare(b2.model || b2.name, 'pt-BR'))
    .slice(0, 50);
}

export interface ModelAttrs { productLine?: string; systemType?: string; technologies?: string[]; }

/**
 * Atributos técnicos ESTRUTURADOS de um modelo do catálogo, para autopreenchimento.
 * Devolve SOMENTE o que existe no dado — nunca infere/inventa (§27/§14): campo
 * ausente permanece ausente.
 */
export function modelAttrs(it: Pick<InventoryItem, 'productLine' | 'systemType' | 'technologies'>): ModelAttrs {
  const a: ModelAttrs = {};
  if (it.productLine) a.productLine = it.productLine;
  if (it.systemType) a.systemType = it.systemType;
  if (it.technologies && it.technologies.length) a.technologies = it.technologies;
  return a;
}

/** Marca equivalente já existente (mesma chave normalizada), se houver. */
export function findExistingBrand(name: string, brandNames: string[]): string | undefined {
  const k = norm(name);
  if (!k) return undefined;
  return (brandNames || []).find((b) => norm(b) === k);
}
