'use client';
import React, { useEffect, useMemo, useState } from 'react';
import type { InventoryItem, UserRole } from '@/lib/types';
import { isSupabaseConfigured } from '@/lib/inventory';
import { stockStatus } from '@/lib/stockStatus';
import { EmptyState } from '@/components/EmptyState';
import { TaxonomyBreadcrumb, CrumbItem } from '@/components/catalog/TaxonomyBreadcrumb';
import { CatalogSearch } from '@/components/catalog/CatalogSearch';
import { TaxonomyNavigator } from '@/components/catalog/TaxonomyNavigator';
import { ProductCatalogList } from '@/components/catalog/ProductCatalogList';
import {
  TaxonomyNode, TaxonomyAlias, CatalogTree,
  fetchTaxonomyNodes, fetchTaxonomyAliases, buildCatalogTree,
  nodeChildren, nodePath, areaFamilies, countsByNode, countsByArea,
  productsUnderNode, searchCatalog, CANONICAL_AREAS, ClassificationStatus,
} from '@/lib/catalogTree';

type StatusFilter = 'all' | ClassificationStatus;
type StockMode = 'all' | 'in_stock' | 'low' | 'out' | 'catalog_only';

const AREA_ICON: Record<string, string> = { SDAI: 'local_fire_department', CFTV: 'videocam', ALARME: 'sensors', BMS: 'thermostat' };

const STOCK_OPTIONS: { value: StockMode; label: string }[] = [
  { value: 'all', label: 'Estoque: todos' },
  { value: 'in_stock', label: 'Em estoque' },
  { value: 'low', label: 'Estoque baixo' },
  { value: 'out', label: 'Sem estoque' },
  { value: 'catalog_only', label: 'Somente catálogo' },
];

// Reutiliza as regras de estoque existentes (lib/stockStatus). Não muda a regra.
function passesStock(item: InventoryItem, mode: StockMode): boolean {
  if (mode === 'all') return true;
  const st = stockStatus(item);
  if (mode === 'catalog_only') return st === 'SOMENTE_CATALOGO';
  if (mode === 'in_stock') return st === 'EM_ESTOQUE';
  if (mode === 'low') return st === 'ESTOQUE_BAIXO' || st === 'CRITICO';
  if (mode === 'out') return st === 'SEM_ESTOQUE';
  return true;
}

/**
 * Estoque unificado (Passada 3.1): a navegação técnica por taxonomia canônica é
 * a experiência principal, com o estoque como dimensão adicional (filtros de
 * saldo). Reaproveita TaxonomyNavigator/Breadcrumb/CatalogSearch/
 * ProductCatalogList/catalogTree e as regras de lib/stockStatus.
 */
export function CatalogoView({ inventory, inventoryLoading = false, userRole }: {
  inventory: InventoryItem[];
  inventoryLoading?: boolean;
  userRole: UserRole;
}) {
  const canSeePrice = userRole === 'ADMINISTRATIVO' || userRole === 'GESTOR';

  const [nodes, setNodes] = useState<TaxonomyNode[] | null>(null);
  const [aliases, setAliases] = useState<TaxonomyAlias[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [loadingTax, setLoadingTax] = useState(true);

  const [area, setArea] = useState<string | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [stockMode, setStockMode] = useState<StockMode>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  useEffect(() => {
    if (!isSupabaseConfigured()) { setLoadingTax(false); setLoadError(true); return; }
    let active = true;
    setLoadingTax(true);
    Promise.all([fetchTaxonomyNodes(), fetchTaxonomyAliases()])
      .then(([ns, as]) => { if (active) { setNodes(ns); setAliases(as); } })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoadingTax(false); });
    return () => { active = false; };
  }, []);

  const tree: CatalogTree | null = useMemo(() => (nodes ? buildCatalogTree(nodes) : null), [nodes]);
  const counts = useMemo(() => (tree ? countsByNode(tree, inventory) : new Map<string, number>()), [tree, inventory]);
  const areaCounts = useMemo(() => countsByArea(inventory), [inventory]);
  const revisarCount = useMemo(() => inventory.filter((p) => p.classificationStatus === 'REVISAR').length, [inventory]);
  const naoClassCount = useMemo(() => inventory.filter((p) => p.classificationStatus === 'NAO_CLASSIFICADO').length, [inventory]);

  const searchResult = useMemo(
    () => (tree && query.trim() ? searchCatalog(tree, inventory, aliases, query) : null),
    [tree, inventory, aliases, query],
  );

  // Aplica as dimensões de filtro (status de classificação + saldo).
  const applyFilters = (list: InventoryItem[]): InventoryItem[] =>
    list.filter((p) =>
      (statusFilter === 'all' || (p.classificationStatus ?? 'NAO_CLASSIFICADO') === statusFilter)
      && passesStock(p, stockMode));

  const resetTo = (a: string | null, n: string | null) => { setArea(a); setNodeId(n); setStatusFilter('all'); setStockMode('all'); setQuery(''); };

  const loading = inventoryLoading || loadingTax;

  const crumbs: CrumbItem[] = useMemo(() => {
    const list: CrumbItem[] = [{ key: 'root', label: 'Estoque', onClick: () => resetTo(null, null) }];
    if (area) list.push({ key: `area-${area}`, label: area, onClick: () => resetTo(area, null) });
    if (tree && nodeId) for (const n of nodePath(tree, nodeId)) list.push({ key: n.id, label: n.name, onClick: () => setNodeId(n.id) });
    return list;
  }, [area, nodeId, tree]);

  const hasFilter = statusFilter !== 'all' || stockMode !== 'all';

  let body: React.ReactNode = null;

  if (loading) {
    body = (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
        <p className="text-sm mt-2 font-semibold">Carregando estoque…</p>
      </div>
    );
  } else if (loadError || !tree) {
    body = <EmptyState variant="estoque" title="Estoque indisponível" description="Não foi possível carregar o catálogo/taxonomia. Verifique sua conexão e tente novamente." />;
  } else if (searchResult) {
    const list = applyFilters(searchResult.products);
    body = list.length === 0 ? (
      <EmptyState variant="generico" title="Nenhum resultado" description={`Nada encontrado para "${query}". Tente outro modelo, fabricante ou sinônimo técnico.`} />
    ) : (
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-slate-500">{list.length} resultado(s) para “{query}”.</p>
        <ProductCatalogList products={list} tree={tree} viewMode={viewMode} canSeePrice={canSeePrice} />
      </div>
    );
  } else if (hasFilter) {
    // Modo de filtro (status/saldo) — lista plana, opcionalmente restrita à área.
    const base = area ? inventory.filter((p) => (p.category || '').toUpperCase() === area) : inventory;
    const list = applyFilters(base);
    body = (
      <div className="flex flex-col gap-3">
        {statusFilter === 'REVISAR' && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <span className="material-symbols-outlined text-amber-600 text-[19px]">error</span>
            <div className="text-[12px] text-amber-800">
              <b>Fila de revisão de classificação.</b> Estes itens têm família definida, mas tipo/tecnologia a confirmar.{' '}
              {userRole === 'ADMINISTRATIVO'
                ? <button type="button" disabled className="underline decoration-dotted opacity-60 cursor-not-allowed">Revisar (em breve)</button>
                : 'Somente o Administrativo poderá revisar.'}
            </div>
          </div>
        )}
        {list.length === 0
          ? <EmptyState variant="generico" title="Nada aqui" description="Nenhum produto para este filtro." />
          : (
            <>
              <p className="text-xs font-semibold text-slate-500">{list.length} produto(s).</p>
              <ProductCatalogList products={list} tree={tree} viewMode={viewMode} canSeePrice={canSeePrice} />
            </>
          )}
      </div>
    );
  } else if (area === null) {
    const areas = [...new Set([...CANONICAL_AREAS, ...[...areaCounts.keys()]])].filter((a) => (areaCounts.get(a) ?? 0) > 0);
    body = (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {areas.map((a) => {
          const canonical = (CANONICAL_AREAS as readonly string[]).includes(a);
          return (
            <button key={a} type="button" onClick={() => { setArea(a); setNodeId(null); }}
              className="group flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-5 py-4 text-left hover:border-[#1A1A72] hover:shadow-sm transition-all active:scale-[0.99]">
              <span className="w-11 h-11 rounded-xl bg-[#1A1A72]/5 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[#1A1A72]">{AREA_ICON[a] || 'category'}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-[#131c28]">{a}</p>
                <p className="text-[11px] font-semibold text-slate-400">{areaCounts.get(a)} produtos</p>
              </div>
              {!canonical && <span className="text-[9px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">Em andamento</span>}
              <span className="material-symbols-outlined text-slate-300 group-hover:text-[#E63946]">chevron_right</span>
            </button>
          );
        })}
      </div>
    );
  } else if (!(CANONICAL_AREAS as readonly string[]).includes(area)) {
    const list = inventory.filter((p) => (p.category || '').toUpperCase() === area);
    body = (
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <span className="material-symbols-outlined text-amber-600 text-[19px]">pending</span>
          <p className="text-[12px] text-amber-800"><b>Classificação em andamento.</b> Esta área ainda não tem árvore canônica. Os produtos continuam acessíveis.</p>
        </div>
        <ProductCatalogList products={list} tree={tree} viewMode={viewMode} canSeePrice={canSeePrice} />
      </div>
    );
  } else {
    const children = nodeId ? nodeChildren(tree, nodeId) : areaFamilies(tree, area);
    const nodeProducts = nodeId ? productsUnderNode(tree, inventory, nodeId) : [];
    body = (
      <div className="flex flex-col gap-4">
        {children.length > 0 && <TaxonomyNavigator nodes={children} counts={counts} onSelect={(n) => setNodeId(n.id)} />}
        {nodeId && (
          nodeProducts.length > 0
            ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-slate-500">{nodeProducts.length} produto(s) neste ramo.</p>
                <ProductCatalogList products={nodeProducts} tree={tree} viewMode={viewMode} canSeePrice={canSeePrice} />
              </div>
            )
            : children.length === 0 && <EmptyState variant="estoque" title="Sem produtos" description="Este ramo ainda não possui produtos classificados." />
        )}
        {!nodeId && children.length === 0 && <EmptyState variant="estoque" title="Sem famílias" description="Nenhuma família com produto nesta área." />}
      </div>
    );
  }

  const chip = (active: boolean) =>
    `text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${active ? 'bg-[#1A1A72] text-white border-[#1A1A72]' : 'bg-white text-slate-600 border-slate-200 hover:border-[#1A1A72]'}`;

  return (
    <div className="px-3 sm:px-6 py-4 max-w-6xl mx-auto w-full">
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[#1A1A72] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#E63946]">inventory_2</span> Estoque
            </h1>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Catálogo técnico por taxonomia · saldo como dimensão</p>
          </div>
          <div className="hidden sm:flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
            {(['cards', 'list'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setViewMode(m)}
                aria-label={m === 'cards' ? 'Ver em cards' : 'Ver em lista'}
                className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors ${viewMode === m ? 'bg-white text-[#1A1A72] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined text-[19px]">{m === 'cards' ? 'grid_view' : 'view_list'}</span>
              </button>
            ))}
          </div>
        </div>

        <CatalogSearch value={query} onChange={setQuery} />

        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" className={chip(statusFilter === 'all' && !query)} onClick={() => { setStatusFilter('all'); setQuery(''); }}>Navegar</button>
          <button type="button" className={chip(statusFilter === 'REVISAR')} onClick={() => { setStatusFilter(statusFilter === 'REVISAR' ? 'all' : 'REVISAR'); setQuery(''); }}>
            Revisar classificação{revisarCount ? ` · ${revisarCount}` : ''}
          </button>
          <button type="button" className={chip(statusFilter === 'NAO_CLASSIFICADO')} onClick={() => { setStatusFilter(statusFilter === 'NAO_CLASSIFICADO' ? 'all' : 'NAO_CLASSIFICADO'); setQuery(''); }}>
            Não classificados{naoClassCount ? ` · ${naoClassCount}` : ''}
          </button>
          <select
            aria-label="Filtro de estoque"
            value={stockMode}
            onChange={(e) => { setStockMode(e.target.value as StockMode); setQuery(''); }}
            className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${stockMode !== 'all' ? 'bg-[#1A1A72] text-white border-[#1A1A72]' : 'bg-white text-slate-600 border-slate-200'}`}
          >
            {STOCK_OPTIONS.map((o) => <option key={o.value} value={o.value} className="text-slate-800">{o.label}</option>)}
          </select>
        </div>

        {!query && !hasFilter && <TaxonomyBreadcrumb items={crumbs} />}
      </div>

      {body}
    </div>
  );
}
