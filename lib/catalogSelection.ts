import type { InventoryItem } from './types';
import { areaMatches, groupMatchesSubcategory } from './technicalCatalog';

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
