import { getSupabaseClient } from './supabaseClient';
import { normalizedCatalogKey } from './catalogSeed/types';
import type { InventoryItem } from './types';

// =====================================================================
// Fonte de verdade da UI de Catálogo: catalog_taxonomy_nodes +
// catalog_taxonomy_aliases + inventory_items.canonical_taxonomy_id /
// classification_status. NÃO reconstrói a árvore pelo `subcategory` legado.
// Funções puras (testáveis) + fetch fino. Sem N+1: carrega tudo e monta
// as relações em memória.
// =====================================================================

export type ClassificationStatus = 'CLASSIFICADO' | 'REVISAR' | 'NAO_CLASSIFICADO';

export interface TaxonomyNode {
  id: string;
  code: string;
  parentId: string | null;
  nodeType: string;
  name: string;
  sortOrder: number;
  area: string;
  active: boolean;
}

export interface TaxonomyAlias {
  alias: string;
  normalized: string;
  nodeId: string;
}

export interface CatalogTree {
  nodes: TaxonomyNode[];
  byId: Map<string, TaxonomyNode>;
  /** Filhos diretos por parentId (chave '' = raízes/famílias), ordenados por sortOrder. */
  children: Map<string, TaxonomyNode[]>;
  /** Conjunto de ids descendentes (inclui o próprio nó). */
  descendants: Map<string, Set<string>>;
}

const ROOT_KEY = '';

// ---- Fetch ----------------------------------------------------------
export async function fetchTaxonomyNodes(): Promise<TaxonomyNode[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from('catalog_taxonomy_nodes')
    .select('id,code,parent_id,node_type,name,sort_order,area,active');
  if (error) throw error;
  return (data || []).map((r: any) => ({
    id: String(r.id), code: r.code, parentId: r.parent_id ?? null, nodeType: r.node_type,
    name: r.name, sortOrder: Number(r.sort_order ?? 0), area: r.area, active: r.active !== false,
  }));
}

export async function fetchTaxonomyAliases(): Promise<TaxonomyAlias[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from('catalog_taxonomy_aliases')
    .select('alias,normalized_alias,taxonomy_node_id,active');
  if (error) throw error;
  return (data || [])
    .filter((r: any) => r.active !== false)
    .map((r: any) => ({ alias: r.alias, normalized: r.normalized_alias, nodeId: String(r.taxonomy_node_id) }));
}

// ---- Construção da árvore -------------------------------------------
export function buildCatalogTree(nodes: TaxonomyNode[]): CatalogTree {
  const active = nodes.filter((n) => n.active);
  const byId = new Map(active.map((n) => [n.id, n]));
  const children = new Map<string, TaxonomyNode[]>();
  for (const n of active) {
    const key = n.parentId && byId.has(n.parentId) ? n.parentId : ROOT_KEY;
    (children.get(key) ?? children.set(key, []).get(key)!).push(n);
  }
  for (const list of children.values()) list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-BR'));

  // descendentes (inclui self) via DFS
  const descendants = new Map<string, Set<string>>();
  const collect = (id: string): Set<string> => {
    if (descendants.has(id)) return descendants.get(id)!;
    const set = new Set<string>([id]);
    for (const c of children.get(id) ?? []) for (const d of collect(c.id)) set.add(d);
    descendants.set(id, set);
    return set;
  };
  for (const n of active) collect(n.id);

  return { nodes: active, byId, children, descendants };
}

/** Filhos diretos de um nó (ou raízes quando parentId = null), opcionalmente por área. */
export function nodeChildren(tree: CatalogTree, parentId: string | null, area?: string): TaxonomyNode[] {
  const list = tree.children.get(parentId ?? ROOT_KEY) ?? [];
  return area ? list.filter((n) => n.area === area) : list;
}

/** Caminho raiz→nó (inclui o próprio nó). */
export function nodePath(tree: CatalogTree, nodeId: string): TaxonomyNode[] {
  const path: TaxonomyNode[] = [];
  let cur = tree.byId.get(nodeId);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift(cur);
    cur = cur.parentId ? tree.byId.get(cur.parentId) : undefined;
  }
  return path;
}

/** Famílias (raízes) de uma área, ordenadas. */
export function areaFamilies(tree: CatalogTree, area: string): TaxonomyNode[] {
  return nodeChildren(tree, null, area);
}

// ---- Produtos × nós -------------------------------------------------
/** Contagem de produtos por nó considerando TODOS os descendentes (não só diretos). */
export function countsByNode(tree: CatalogTree, products: InventoryItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of products) {
    const nid = p.canonicalTaxonomyId;
    if (!nid || !tree.byId.has(nid)) continue;
    // incrementa o nó e todos os seus ancestrais
    let cur = tree.byId.get(nid);
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      counts.set(cur.id, (counts.get(cur.id) ?? 0) + 1);
      cur = cur.parentId ? tree.byId.get(cur.parentId) : undefined;
    }
  }
  return counts;
}

/** Contagem de produtos por área (via category), independente de classificação. */
export function countsByArea(products: InventoryItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of products) {
    const a = (p.category || '').trim().toUpperCase();
    if (!a) continue;
    counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  return counts;
}

/** Produtos sob um nó (todo o ramo). */
export function productsUnderNode(tree: CatalogTree, products: InventoryItem[], nodeId: string): InventoryItem[] {
  const set = tree.descendants.get(nodeId);
  if (!set) return [];
  return products.filter((p) => p.canonicalTaxonomyId && set.has(p.canonicalTaxonomyId));
}

/** Caminho canônico resumido de um produto (nomes), ou null. */
export function productPathNames(tree: CatalogTree, product: InventoryItem): string[] | null {
  if (!product.canonicalTaxonomyId || !tree.byId.has(product.canonicalTaxonomyId)) return null;
  return nodePath(tree, product.canonicalTaxonomyId).map((n) => n.name);
}

// ---- Busca ----------------------------------------------------------
export interface CatalogSearchResult {
  products: InventoryItem[];
  /** Nós cujo nome/alias casou com a busca (para sugerir navegação). */
  nodeMatches: TaxonomyNode[];
}

/**
 * Busca global normalizada. Casa por: modelo, código, descrição, fabricante,
 * nome de família/tipo, código canônico e aliases (sinônimos técnicos).
 * Produtos sob um nó cujo nome/alias casou também entram no resultado.
 */
export function searchCatalog(
  tree: CatalogTree,
  products: InventoryItem[],
  aliases: TaxonomyAlias[],
  query: string,
): CatalogSearchResult | null {
  const q = normalizedCatalogKey(query);
  if (!q) return null;

  // 1) nós que casam por nome ou por alias
  const nodeMatchIds = new Set<string>();
  for (const n of tree.nodes) {
    if (normalizedCatalogKey(n.name).includes(q) || normalizedCatalogKey(n.code).includes(q)) nodeMatchIds.add(n.id);
  }
  for (const a of aliases) {
    if (a.normalized.includes(q) || q.includes(a.normalized)) if (tree.byId.has(a.nodeId)) nodeMatchIds.add(a.nodeId);
  }
  // produtos sob qualquer nó casado (todo o ramo)
  const nodeProductIds = new Set<string>();
  for (const nid of nodeMatchIds) for (const p of productsUnderNode(tree, products, nid)) nodeProductIds.add(p.id);

  // 2) produtos que casam por campos próprios
  const matched: InventoryItem[] = [];
  const pathCache = new Map<string, string>();
  for (const p of products) {
    const fields = normalizedCatalogKey(`${p.model || ''} ${p.code || ''} ${p.brand || ''} ${p.description || ''} ${p.name || ''} ${p.subcategory || ''}`);
    let hit = fields.includes(q) || nodeProductIds.has(p.id);
    if (!hit && p.canonicalTaxonomyId && tree.byId.has(p.canonicalTaxonomyId)) {
      let path = pathCache.get(p.canonicalTaxonomyId);
      if (path === undefined) { path = normalizedCatalogKey(nodePath(tree, p.canonicalTaxonomyId).map((n) => n.name).join(' ')); pathCache.set(p.canonicalTaxonomyId, path); }
      if (path.includes(q)) hit = true;
    }
    if (hit) matched.push(p);
  }

  return { products: matched, nodeMatches: [...nodeMatchIds].map((id) => tree.byId.get(id)!).filter(Boolean) };
}

// ---- Áreas ----------------------------------------------------------
/** Áreas com árvore canônica nesta fase. Outras aparecem como "em andamento". */
export const CANONICAL_AREAS = ['SDAI', 'CFTV'] as const;

export function statusLabel(s: ClassificationStatus | undefined): string {
  if (s === 'CLASSIFICADO') return 'Classificado';
  if (s === 'REVISAR') return 'Revisar';
  if (s === 'NAO_CLASSIFICADO') return 'Não classificado';
  return '—';
}
