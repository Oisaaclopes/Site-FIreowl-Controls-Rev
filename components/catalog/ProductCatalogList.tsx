'use client';
import React from 'react';
import type { InventoryItem } from '@/lib/types';
import { CatalogTree, productPathNames, ClassificationStatus } from '@/lib/catalogTree';
import { productPricing, moneyOrDash, percentOrDash } from '@/lib/productPricing';
import { stockStatus } from '@/lib/stockStatus';

const STATUS_STYLE: Record<ClassificationStatus, { label: string; cls: string; icon: string }> = {
  CLASSIFICADO: { label: 'Classificado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'check_circle' },
  REVISAR: { label: 'Revisar', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'error' },
  NAO_CLASSIFICADO: { label: 'Não classificado', cls: 'bg-slate-100 text-slate-500 border-slate-200', icon: 'help' },
};

function StatusBadge({ status }: { status?: string }) {
  const s = STATUS_STYLE[(status as ClassificationStatus)] ?? STATUS_STYLE.NAO_CLASSIFICADO;
  return (
    <span className={`inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${s.cls}`}>
      <span className="material-symbols-outlined text-[13px]">{s.icon}</span>{s.label}
    </span>
  );
}

function ProductCard({ item, tree, canSeePrice, dense, onOpen }: { item: InventoryItem; tree: CatalogTree; canSeePrice: boolean; dense?: boolean; onOpen?: (item: InventoryItem) => void }) {
  const path = productPathNames(tree, item);
  const controlled = item.stockManaged === true;
  const catalogOnly = stockStatus(item) === 'SOMENTE_CATALOGO';
  const { price, margin } = productPricing(item);
  return (
    <button
      type="button"
      onClick={() => onOpen?.(item)}
      className={`text-left bg-white border border-slate-200 rounded-xl ${dense ? 'px-3.5 py-2.5' : 'px-4 py-3.5'} flex flex-col gap-1.5 hover:border-[#1A1A72] hover:shadow-sm transition-all active:scale-[0.997]`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1A1A72]/70">{item.brand || 'Sem fabricante'}</p>
          <p className="text-sm font-bold text-[#131c28] truncate">{item.model || item.code || item.name}</p>
        </div>
        <StatusBadge status={item.classificationStatus} />
      </div>
      {item.description && <p className="text-[12px] text-slate-500 line-clamp-1">{item.description}</p>}
      {path ? (
        <p className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
          <span className="material-symbols-outlined text-[13px] text-slate-300">account_tree</span>
          <span className="truncate">{path.join(' › ')}</span>
        </p>
      ) : (
        <p className="text-[11px] text-slate-400 italic">Sem classificação canônica{item.subcategory ? ` · legado: ${item.subcategory}` : ''}</p>
      )}
      <div className="flex items-center gap-3 pt-0.5 flex-wrap">
        {catalogOnly ? (
          <span className="text-[11px] font-semibold text-slate-500 inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px] text-slate-400">menu_book</span>Somente catálogo
          </span>
        ) : controlled && (
          <span className="text-[11px] font-semibold text-slate-600 inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px] text-slate-400">inventory_2</span>
            {item.quantity} {item.unit || 'un'}
          </span>
        )}
        {canSeePrice && price != null && <span className="text-[11px] font-bold text-emerald-700">Venda: {moneyOrDash(price)}</span>}
        {canSeePrice && margin != null && <span className="text-[11px] font-semibold text-slate-500">Margem: {percentOrDash(margin)}</span>}
      </div>
    </button>
  );
}

/** Lista de produtos (cards/lista). Card compacto com comercial resumido; clique abre detalhes. */
export function ProductCatalogList({ products, tree, viewMode = 'cards', canSeePrice = false, onOpen }: {
  products: InventoryItem[];
  tree: CatalogTree;
  viewMode?: 'cards' | 'list';
  canSeePrice?: boolean;
  onOpen?: (item: InventoryItem) => void;
}) {
  const dense = viewMode === 'list';
  return (
    <div className={dense ? 'flex flex-col gap-1.5' : 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5'}>
      {products.map((item) => (
        <ProductCard key={item.id} item={item} tree={tree} canSeePrice={canSeePrice} dense={dense} onOpen={onOpen} />
      ))}
    </div>
  );
}
