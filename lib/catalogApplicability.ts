import type { InventoryItem } from './types';
import type { CatalogTree, TaxonomyNode } from './catalogTree';
import { TRANSVERSAL_DOMAIN } from './catalogTree';
import { areaMatches } from './technicalCatalog';

// =====================================================================
// APLICABILIDADE DE PRODUTO (0118 — inventory_item_areas).
//
//   Catálogo       = identidade + UMA classificação canônica (canonicalTaxonomyId)
//   Estoque        = UM saldo por produto (quantity) — nunca duplicado aqui
//   Aplicabilidade = N áreas comerciais por produto (applicableAreas)
//   Base Técnica   = equipamentos instalados em clientes — fora deste módulo
//
// Áreas EFETIVAS (espelha a view inventory_item_effective_areas):
//   • nó scope AREA        → área do nó (implícita) ∪ aplicabilidades extras
//   • nó scope TRANSVERSAL → SÓ as aplicabilidades (vazio = "sem aplicabilidade")
//   • sem nó (legado)      → category textual (areaMatches) ∪ aplicabilidades
//
// INFRA é domínio transversal do CATÁLOGO, não área comercial: nunca entra
// em COMMERCIAL_AREAS nem é devolvida como área efetiva.
// Funções puras — sem IO.
// =====================================================================

/** Áreas comerciais canônicas (propostas, contratos, levantamentos). */
export const COMMERCIAL_AREAS = ['SDAI', 'CFTV', 'ALARME', 'BMS', 'CONTROLE_ACESSO'] as const;
export type CommercialArea = typeof COMMERCIAL_AREAS[number];

export const COMMERCIAL_AREA_LABEL: Record<CommercialArea, string> = {
  SDAI: 'SDAI', CFTV: 'CFTV', ALARME: 'Alarme', BMS: 'BMS / Automação', CONTROLE_ACESSO: 'Controle de Acesso',
};

export function isCommercialArea(a: string | null | undefined): a is CommercialArea {
  return !!a && (COMMERCIAL_AREAS as readonly string[]).includes(a);
}

/** Ordena/deduplica/filtra para códigos comerciais canônicos (ordem de COMMERCIAL_AREAS). */
export function canonicalAreaList(list: ReadonlyArray<string | null | undefined>): CommercialArea[] {
  const set = new Set(list.map((a) => (a || '').trim().toUpperCase()));
  return COMMERCIAL_AREAS.filter((a) => set.has(a));
}

type TreeLike = Pick<CatalogTree, 'byId'> | null | undefined;
type ItemLike = Pick<InventoryItem, 'category' | 'canonicalTaxonomyId' | 'applicableAreas'>;

/** Nó canônico do produto na árvore carregada (null se sem vínculo/árvore). */
export function canonicalNodeOf(item: ItemLike, tree: TreeLike): TaxonomyNode | null {
  if (!tree || !item.canonicalTaxonomyId) return null;
  return tree.byId.get(item.canonicalTaxonomyId) ?? null;
}

/** Aplicabilidades explícitas (linhas de inventory_item_areas) normalizadas. */
export function explicitApplicability(item: Pick<InventoryItem, 'applicableAreas'> | null | undefined): CommercialArea[] {
  return canonicalAreaList(item?.applicableAreas ?? []);
}

export type EffectiveBasis = 'AREA' | 'TRANSVERSAL' | 'LEGADO';

export interface EffectiveAreas {
  /** Áreas comerciais em que o produto pode ser usado. */
  areas: CommercialArea[];
  /** De onde vem a área principal: nó AREA, nó TRANSVERSAL ou category legada. */
  basis: EffectiveBasis;
  /** Área implícita (classificação AREA ou category legada canônica). */
  primaryArea: CommercialArea | null;
  /** Transversal sem nenhuma aplicabilidade — não pronto para uso em proposta. */
  missingApplicability: boolean;
}

const isTransversalCategory = (category?: string) => (category || '').trim().toUpperCase() === TRANSVERSAL_DOMAIN;

export function effectiveAreas(item: ItemLike, tree: TreeLike): EffectiveAreas {
  const extra = explicitApplicability(item);
  const node = canonicalNodeOf(item, tree);
  if (node && node.scope === 'TRANSVERSAL') {
    return { areas: extra, basis: 'TRANSVERSAL', primaryArea: null, missingApplicability: extra.length === 0 };
  }
  if (node && isCommercialArea(node.area)) {
    return { areas: canonicalAreaList([node.area, ...extra]), basis: 'AREA', primaryArea: node.area, missingApplicability: false };
  }
  // Legado (sem classificação ou árvore indisponível): category textual.
  const legacy = isTransversalCategory(item.category) ? [] : COMMERCIAL_AREAS.filter((a) => areaMatches(item.category, a));
  return {
    areas: canonicalAreaList([...legacy, ...extra]),
    basis: 'LEGADO',
    primaryArea: legacy[0] ?? null,
    missingApplicability: isTransversalCategory(item.category) && extra.length === 0,
  };
}

/**
 * O produto serve para a área pedida? Substitui `areaMatches(category, área)`
 * nos seletores. Área desconhecida (fora do canônico) cai no casamento legado.
 */
export function appliesToArea(item: ItemLike, area: string | undefined, tree: TreeLike): boolean {
  if (!area) return true;
  const eff = effectiveAreas(item, tree);
  const code = area.trim().toUpperCase();
  if (eff.basis === 'LEGADO') {
    return (!isTransversalCategory(item.category) && areaMatches(item.category, area))
      || (eff.areas as string[]).includes(code);
  }
  return (eff.areas as string[]).includes(code);
}

/**
 * Domínio "casa" do produto no Estoque — onde ele aparece UMA única vez:
 * INFRA para nó transversal, a área do nó para nó AREA, senão a category legada.
 */
export function homeDomain(item: ItemLike, tree: TreeLike): string {
  const node = canonicalNodeOf(item, tree);
  if (node) return node.scope === 'TRANSVERSAL' ? TRANSVERSAL_DOMAIN : (node.area || '').toUpperCase();
  return (item.category || '').trim().toUpperCase();
}

/** Contagem de produtos por domínio casa (cada produto conta uma vez). */
export function countsByDomain(items: ItemLike[], tree: TreeLike): Map<string, number> {
  const counts = new Map<string, number>();
  for (const i of items) {
    const d = homeDomain(i, tree);
    if (!d) continue;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return counts;
}

/**
 * Aplicabilidade a PERSISTIR: só códigos canônicos, sem repetição e SEM a
 * área implícita (classificação AREA / category legada) — evita a linha
 * redundante que a 0118 rejeita.
 */
export function normalizeApplicability(selected: ReadonlyArray<string>, implicitArea: string | null | undefined): CommercialArea[] {
  const implicit = (implicitArea || '').trim().toUpperCase();
  return canonicalAreaList(selected).filter((a) => a !== implicit);
}

/** Erro de validação da gravação (null = ok). Transversal exige ≥ 1 área. */
export function applicabilityError(domain: string, selected: ReadonlyArray<string>): string | null {
  if (domain === TRANSVERSAL_DOMAIN && canonicalAreaList(selected).length === 0) {
    return 'Produto de Infraestrutura precisa de ao menos uma área de aplicabilidade.';
  }
  return null;
}

/** Diferença entre o persistido e o desejado (para gravar só o necessário). */
export function diffApplicability(current: ReadonlyArray<string>, next: ReadonlyArray<string>): { toAdd: CommercialArea[]; toRemove: CommercialArea[] } {
  const cur = canonicalAreaList(current);
  const nxt = canonicalAreaList(next);
  return { toAdd: nxt.filter((a) => !cur.includes(a)), toRemove: cur.filter((a) => !nxt.includes(a)) };
}
