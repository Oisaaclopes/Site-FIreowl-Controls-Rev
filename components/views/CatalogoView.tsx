'use client';
import { requestConfirm } from '@/components/ui/Feedback';
import React, { useEffect, useMemo, useState } from 'react';
import type { InventoryItem, UserRole, Supplier } from '@/lib/types';
import { isSupabaseConfigured, insertStockMovement } from '@/lib/inventory';
import { stockStatus, stockIndicators } from '@/lib/stockStatus';
import { productPricing, isInformed } from '@/lib/productPricing';
import { EmptyState } from '@/components/EmptyState';
import { TaxonomyBreadcrumb, CrumbItem } from '@/components/catalog/TaxonomyBreadcrumb';
import { CatalogSearch } from '@/components/catalog/CatalogSearch';
import { TaxonomyNavigator } from '@/components/catalog/TaxonomyNavigator';
import { ProductCatalogList } from '@/components/catalog/ProductCatalogList';
import { ProductDetail } from '@/components/catalog/ProductDetail';
import { ProductEditor } from '@/components/catalog/ProductEditor';
import {
  TaxonomyNode, TaxonomyAlias, CatalogTree,
  fetchTaxonomyNodes, fetchTaxonomyAliases, buildCatalogTree,
  nodeChildren, nodePath, areaFamilies, countsByNode, countsByArea,
  productsUnderNode, searchCatalog, CANONICAL_AREAS, ClassificationStatus,
} from '@/lib/catalogTree';

type StatusFilter = 'all' | ClassificationStatus;
type StockMode = 'all' | 'in_stock' | 'low' | 'out' | 'catalog_only';
type SortMode = 'none' | 'margin_desc' | 'margin_asc' | 'markup_desc' | 'markup_asc' | 'price_desc' | 'price_asc' | 'has_cost' | 'no_cost' | 'has_price' | 'no_price';

const AREA_ICON: Record<string, string> = { SDAI: 'local_fire_department', CFTV: 'videocam', ALARME: 'sensors', BMS: 'thermostat' };
const STOCK_OPTIONS: { value: StockMode; label: string }[] = [
  { value: 'all', label: 'Estoque: todos' }, { value: 'in_stock', label: 'Em estoque' }, { value: 'low', label: 'Estoque baixo' },
  { value: 'out', label: 'Sem estoque' }, { value: 'catalog_only', label: 'Somente catálogo' },
];
const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'none', label: 'Ordenar / filtrar' }, { value: 'margin_desc', label: 'Maior margem' }, { value: 'margin_asc', label: 'Menor margem' },
  { value: 'markup_desc', label: 'Maior markup' }, { value: 'markup_asc', label: 'Menor markup' }, { value: 'price_desc', label: 'Maior preço' }, { value: 'price_asc', label: 'Menor preço' },
  { value: 'has_cost', label: 'Com custo' }, { value: 'no_cost', label: 'Sem custo' }, { value: 'has_price', label: 'Com preço' }, { value: 'no_price', label: 'Sem preço' },
];

function passesStock(item: InventoryItem, mode: StockMode): boolean {
  if (mode === 'all') return true;
  const st = stockStatus(item);
  if (mode === 'catalog_only') return st === 'SOMENTE_CATALOGO';
  if (mode === 'in_stock') return st === 'EM_ESTOQUE';
  if (mode === 'low') return st === 'ESTOQUE_BAIXO' || st === 'CRITICO';
  if (mode === 'out') return st === 'SEM_ESTOQUE';
  return true;
}

export function CatalogoView({ inventory, inventoryLoading = false, userRole, suppliers = [], brands = [], onCreateBrand, onAddInventoryItem, onUpdateInventoryItem, onDeleteInventoryItem }: {
  inventory: InventoryItem[];
  inventoryLoading?: boolean;
  userRole: UserRole;
  suppliers?: Supplier[];
  brands?: string[];
  onCreateBrand?: (name: string) => Promise<string>;
  onAddInventoryItem?: (item: InventoryItem) => void | Promise<void>;
  onUpdateInventoryItem?: (item: InventoryItem) => void | Promise<void>;
  onDeleteInventoryItem?: (id: string) => void | Promise<void>;
}) {
  const canSeePrice = userRole === 'ADMINISTRATIVO' || userRole === 'GESTOR';
  const canManage = (userRole === 'ADMINISTRATIVO' || userRole === 'GESTOR') && !!onUpdateInventoryItem;

  const [nodes, setNodes] = useState<TaxonomyNode[] | null>(null);
  const [aliases, setAliases] = useState<TaxonomyAlias[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [loadingTax, setLoadingTax] = useState(true);

  const [area, setArea] = useState<string | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [stockMode, setStockMode] = useState<StockMode>('all');
  const [sortMode, setSortMode] = useState<SortMode>('none');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [editorItem, setEditorItem] = useState<InventoryItem | null | 'new'>(null);

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
  const indic = useMemo(() => stockIndicators(inventory), [inventory]);

  const searchResult = useMemo(
    () => (tree && query.trim() ? searchCatalog(tree, inventory, aliases, query) : null),
    [tree, inventory, aliases, query],
  );

  // Mantém o item aberto sincronizado com o inventário recarregado.
  useEffect(() => {
    if (selectedItem) { const fresh = inventory.find((i) => i.id === selectedItem.id); if (fresh && fresh !== selectedItem) setSelectedItem(fresh); }
  }, [inventory]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ordenação/filtro comercial aplicado a qualquer lista exibida.
  const arrange = (list: InventoryItem[]): InventoryItem[] => {
    let out = list;
    const priceOf = (i: InventoryItem) => productPricing(i);
    if (sortMode === 'has_cost') out = out.filter((i) => isInformed(i.costPrice));
    else if (sortMode === 'no_cost') out = out.filter((i) => !isInformed(i.costPrice));
    else if (sortMode === 'has_price') out = out.filter((i) => priceOf(i).price != null);
    else if (sortMode === 'no_price') out = out.filter((i) => priceOf(i).price == null);
    const dir = sortMode.endsWith('_desc') ? -1 : 1;
    const key = sortMode.startsWith('margin') ? 'margin' : sortMode.startsWith('markup') ? 'markup' : sortMode.startsWith('price') ? 'price' : null;
    if (key) out = [...out].sort((a, b) => {
      const va = priceOf(a)[key as 'margin' | 'markup' | 'price'] ?? -Infinity;
      const vb = priceOf(b)[key as 'margin' | 'markup' | 'price'] ?? -Infinity;
      return (va - vb) * dir;
    });
    return out;
  };

  const applyFilters = (list: InventoryItem[]): InventoryItem[] =>
    arrange(list.filter((p) =>
      (statusFilter === 'all' || (p.classificationStatus ?? 'NAO_CLASSIFICADO') === statusFilter)
      && passesStock(p, stockMode)));

  const resetTo = (a: string | null, n: string | null) => { setArea(a); setNodeId(n); setStatusFilter('all'); setStockMode('all'); setSortMode('none'); setQuery(''); };
  const loading = inventoryLoading || loadingTax;
  const hasFilter = statusFilter !== 'all' || stockMode !== 'all' || sortMode !== 'none';

  const crumbs: CrumbItem[] = useMemo(() => {
    const list: CrumbItem[] = [{ key: 'root', label: 'Estoque', onClick: () => resetTo(null, null) }];
    if (area) list.push({ key: `area-${area}`, label: area, onClick: () => resetTo(area, null) });
    if (tree && nodeId) for (const n of nodePath(tree, nodeId)) list.push({ key: n.id, label: n.name, onClick: () => setNodeId(n.id) });
    return list;
  }, [area, nodeId, tree]);

  // ---- Mutations (reutilizam a camada existente) ----
  const handleMovement = async (item: InventoryItem, type: 'entrada' | 'saida', qty: number, note: string) => {
    const newBalance = type === 'entrada' ? item.quantity + qty : Math.max(0, item.quantity - qty);
    const updated: InventoryItem = { ...item, quantity: newBalance };
    await onUpdateInventoryItem?.(updated);
    if (isSupabaseConfigured()) {
      try { await insertStockMovement({ id: '', itemId: item.id, itemCode: item.code, itemName: item.name, type, quantity: qty, resultingBalance: newBalance, note: note || undefined }); }
      catch (e) { console.error('Movimentação aplicada, histórico falhou:', e); }
    }
    setSelectedItem(updated);
  };
  const handleSaveProduct = async (item: InventoryItem) => {
    if (item.id) await onUpdateInventoryItem?.(item); else await onAddInventoryItem?.(item);
  };
  const handleDeleteProduct = async (item: InventoryItem) => {
    if (typeof window !== 'undefined' && !await requestConfirm(`Excluir "${item.model || item.name}"? Esta ação não pode ser desfeita.`)) return;
    await onDeleteInventoryItem?.(item.id);
    setSelectedItem(null);
  };

  const openDetail = (item: InventoryItem) => setSelectedItem(item);
  const list = (products: InventoryItem[]) => <ProductCatalogList products={products} tree={tree!} viewMode={viewMode} canSeePrice={canSeePrice} onOpen={openDetail} />;

  let body: React.ReactNode = null;
  if (loading) {
    body = <div className="flex flex-col items-center justify-center py-24 text-fg-muted"><span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span><p className="text-sm mt-2 font-semibold">Carregando estoque…</p></div>;
  } else if (loadError || !tree) {
    body = <EmptyState variant="estoque" title="Estoque indisponível" description="Não foi possível carregar o catálogo/taxonomia. Verifique sua conexão e tente novamente." />;
  } else if (searchResult) {
    const l = applyFilters(searchResult.products);
    body = l.length === 0
      ? <EmptyState variant="generico" title="Nenhum resultado" description={`Nada encontrado para "${query}".`} />
      : <div className="flex flex-col gap-3"><p className="text-xs font-semibold text-fg-secondary">{l.length} resultado(s) para “{query}”.</p>{list(l)}</div>;
  } else if (hasFilter) {
    const base = area ? inventory.filter((p) => (p.category || '').toUpperCase() === area) : inventory;
    const l = applyFilters(base);
    body = (
      <div className="flex flex-col gap-3">
        {statusFilter === 'REVISAR' && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <span className="material-symbols-outlined text-amber-600 text-[19px]">error</span>
            <div className="text-[12px] text-amber-800"><b>Fila de revisão de classificação.</b> Itens com família definida, tipo/tecnologia a confirmar.</div>
          </div>
        )}
        {l.length === 0 ? <EmptyState variant="generico" title="Nada aqui" description="Nenhum produto para este filtro." /> : <><p className="text-xs font-semibold text-fg-secondary">{l.length} produto(s).</p>{list(l)}</>}
      </div>
    );
  } else if (area === null) {
    const areas = [...new Set([...CANONICAL_AREAS, ...[...areaCounts.keys()]])].filter((a) => (areaCounts.get(a) ?? 0) > 0);
    body = (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {areas.map((a) => {
          const canonical = (CANONICAL_AREAS as readonly string[]).includes(a);
          return (
            <button key={a} type="button" onClick={() => { setArea(a); setNodeId(null); }} className="group flex items-center gap-3 bg-surface border border-border rounded-2xl px-5 py-4 text-left hover:border-primary hover:shadow-sm transition-all active:scale-[0.99]">
              <span className="w-11 h-11 rounded-xl bg-navy/5 flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-primary">{AREA_ICON[a] || 'category'}</span></span>
              <div className="min-w-0 flex-1"><p className="text-base font-bold text-[#131c28]">{a}</p><p className="text-[11px] font-semibold text-fg-muted">{areaCounts.get(a)} produtos</p></div>
              {!canonical && <span className="text-[9px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">Em andamento</span>}
              <span className="material-symbols-outlined text-fg-muted group-hover:text-danger">chevron_right</span>
            </button>
          );
        })}
      </div>
    );
  } else if (!(CANONICAL_AREAS as readonly string[]).includes(area)) {
    body = (
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5"><span className="material-symbols-outlined text-amber-600 text-[19px]">pending</span><p className="text-[12px] text-amber-800"><b>Classificação em andamento.</b> Esta área ainda não tem árvore canônica. Os produtos continuam acessíveis.</p></div>
        {list(arrange(inventory.filter((p) => (p.category || '').toUpperCase() === area)))}
      </div>
    );
  } else {
    const children = nodeId ? nodeChildren(tree, nodeId) : areaFamilies(tree, area);
    const nodeProducts = nodeId ? arrange(productsUnderNode(tree, inventory, nodeId)) : [];
    body = (
      <div className="flex flex-col gap-4">
        {children.length > 0 && <TaxonomyNavigator nodes={children} counts={counts} onSelect={(n) => setNodeId(n.id)} />}
        {nodeId && (nodeProducts.length > 0
          ? <div className="flex flex-col gap-2"><p className="text-xs font-semibold text-fg-secondary">{nodeProducts.length} produto(s) neste ramo.</p>{list(nodeProducts)}</div>
          : children.length === 0 && <EmptyState variant="estoque" title="Sem produtos" description="Este ramo ainda não possui produtos." />)}
        {!nodeId && children.length === 0 && <EmptyState variant="estoque" title="Sem famílias" description="Nenhuma família com produto nesta área." />}
      </div>
    );
  }

  const chip = (active: boolean) => `text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${active ? 'bg-navy text-white border-primary' : 'bg-surface text-fg-secondary border-border hover:border-primary'}`;
  const selectCls = (active: boolean) => `text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${active ? 'bg-navy text-white border-primary' : 'bg-surface text-fg-secondary border-border'}`;

  return (
    <div className="px-3 sm:px-6 py-4 max-w-6xl mx-auto w-full">
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-primary flex items-center gap-2"><span className="material-symbols-outlined text-danger">inventory_2</span> Estoque</h1>
            <p className="text-[11px] text-fg-muted font-semibold uppercase tracking-wide">Catálogo técnico por taxonomia · saldo como dimensão</p>
          </div>
          <div className="flex items-center gap-2">
            {canManage && <button type="button" onClick={() => setEditorItem('new')} className="inline-flex items-center gap-1.5 bg-danger hover:bg-danger-hover text-white text-xs font-bold px-3 py-2 rounded-lg uppercase tracking-wide"><span className="material-symbols-outlined text-[18px]">add</span><span className="hidden sm:inline">Novo produto</span></button>}
            <div className="hidden sm:flex items-center gap-1 bg-surface-3 rounded-lg p-0.5">
              {(['cards', 'list'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setViewMode(m)} aria-label={m === 'cards' ? 'Ver em cards' : 'Ver em lista'} className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors ${viewMode === m ? 'bg-surface text-primary shadow-sm' : 'text-fg-muted hover:text-fg-secondary'}`}><span className="material-symbols-outlined text-[19px]">{m === 'cards' ? 'grid_view' : 'view_list'}</span></button>
              ))}
            </div>
          </div>
        </div>

        {/* Indicadores compactos */}
        <div className="flex items-center gap-2 flex-wrap text-[11px] font-semibold">
          <span className="px-2 py-1 rounded-md bg-surface-3 text-fg-secondary">{indic.catalogo} no catálogo</span>
          <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700">{indic.comSaldo} com saldo</span>
          <span className="px-2 py-1 rounded-md bg-amber-50 text-amber-700">{indic.estoqueBaixo + indic.critico} estoque baixo</span>
          <span className="px-2 py-1 rounded-md bg-red-50 text-red-700">{indic.semEstoque} sem estoque</span>
        </div>

        <CatalogSearch value={query} onChange={setQuery} />

        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" className={chip(statusFilter === 'all' && !query)} onClick={() => { setStatusFilter('all'); setQuery(''); }}>Navegar</button>
          <button type="button" className={chip(statusFilter === 'REVISAR')} onClick={() => { setStatusFilter(statusFilter === 'REVISAR' ? 'all' : 'REVISAR'); setQuery(''); }}>Revisar{revisarCount ? ` · ${revisarCount}` : ''}</button>
          <button type="button" className={chip(statusFilter === 'NAO_CLASSIFICADO')} onClick={() => { setStatusFilter(statusFilter === 'NAO_CLASSIFICADO' ? 'all' : 'NAO_CLASSIFICADO'); setQuery(''); }}>Não classificados{naoClassCount ? ` · ${naoClassCount}` : ''}</button>
          <select aria-label="Filtro de estoque" value={stockMode} onChange={(e) => { setStockMode(e.target.value as StockMode); setQuery(''); }} className={selectCls(stockMode !== 'all')}>
            {STOCK_OPTIONS.map((o) => <option key={o.value} value={o.value} className="text-fg">{o.label}</option>)}
          </select>
          {canSeePrice && (
            <select aria-label="Ordenar e filtrar" value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} className={selectCls(sortMode !== 'none')}>
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value} className="text-fg">{o.label}</option>)}
            </select>
          )}
        </div>

        {!query && !hasFilter && <TaxonomyBreadcrumb items={crumbs} />}
      </div>

      {body}

      {selectedItem && tree && (
        <ProductDetail item={selectedItem} tree={tree} canManage={canManage} canSeePrice={canSeePrice}
          onClose={() => setSelectedItem(null)}
          onEdit={(it) => { setSelectedItem(null); setEditorItem(it); }}
          onDelete={handleDeleteProduct} onMovement={handleMovement} />
      )}
      {editorItem !== null && tree && (
        <ProductEditor initial={editorItem === 'new' ? null : editorItem} tree={tree} inventory={inventory}
          suppliers={suppliers.map((s) => s.name).filter(Boolean)}
          brands={brands}
          onCreateBrand={onCreateBrand ?? (async (n) => n)}
          onClose={() => setEditorItem(null)} onSave={handleSaveProduct} />
      )}
    </div>
  );
}
