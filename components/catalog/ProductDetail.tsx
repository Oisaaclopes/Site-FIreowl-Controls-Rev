'use client';
import React, { useState } from 'react';
import type { InventoryItem } from '@/lib/types';
import { CatalogTree, productPathNames } from '@/lib/catalogTree';
import { productPricing, moneyOrDash, percentOrDash, ratioOrDash } from '@/lib/productPricing';
import { stockStatus, STOCK_STATUS_META, textOrNull } from '@/lib/stockStatus';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-[#131c28] text-right">{value}</span>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#1A1A72] flex items-center gap-1.5 mb-1.5">
        <span className="material-symbols-outlined text-[15px]">{icon}</span>{title}
      </p>
      {children}
    </div>
  );
}

/**
 * Painel de detalhes do produto (drawer). Reúne Comercial / Estoque / Cadastro /
 * Classificação. Movimentação (entrada/saída) e edição/exclusão só para quem
 * pode gerir (ADMINISTRATIVO). Preço/custo só para quem pode ver preço.
 */
export function ProductDetail({ item, tree, canManage, canSeePrice, onClose, onEdit, onDelete, onMovement }: {
  item: InventoryItem;
  tree: CatalogTree;
  canManage: boolean;
  canSeePrice: boolean;
  onClose: () => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
  onMovement: (item: InventoryItem, type: 'entrada' | 'saida', qty: number, note: string) => Promise<void>;
}) {
  const path = productPathNames(tree, item);
  const st = stockStatus(item);
  const catalogOnly = st === 'SOMENTE_CATALOGO';
  const { cost, price, profit, markup, margin } = productPricing(item);
  const [movType, setMovType] = useState<'entrada' | 'saida'>('entrada');
  const [movQty, setMovQty] = useState(1);
  const [movNote, setMovNote] = useState('');
  const [busy, setBusy] = useState(false);

  const doMove = async () => {
    const qty = Math.max(0, Math.floor(Number(movQty) || 0));
    if (qty <= 0 || busy) return;
    setBusy(true);
    try { await onMovement(item, movType, qty, movNote.trim()); setMovNote(''); setMovQty(1); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-slate-50 h-full overflow-y-auto shadow-2xl flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {/* Cabeçalho */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-start justify-between gap-2 z-10">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1A1A72]/70">{item.brand || 'Sem fabricante'}</p>
            <p className="text-base font-bold text-[#131c28] truncate">{item.model || item.code || item.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="h-9 w-9 flex items-center justify-center rounded-md text-slate-400 hover:text-[#E63946] hover:bg-slate-50 shrink-0">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          {canSeePrice && (
            <Section title="Comercial" icon="payments">
              <Row label="Custo" value={moneyOrDash(cost)} />
              <Row label="Preço de venda" value={moneyOrDash(price)} />
              <Row label="Lucro unitário" value={moneyOrDash(profit)} />
              <Row label="Margem" value={percentOrDash(margin)} />
              <Row label="Markup" value={ratioOrDash(markup)} />
            </Section>
          )}

          <Section title="Estoque" icon="inventory_2">
            <Row label="Situação" value={<span className={`text-${STOCK_STATUS_META[st].tone}-700`}>{STOCK_STATUS_META[st].label}</span>} />
            {!catalogOnly && <Row label="Saldo" value={`${item.quantity} ${item.unit || 'un'}`} />}
            {!catalogOnly && <Row label="Estoque mínimo" value={`${item.minQuantity} ${item.unit || 'un'}`} />}
            <Row label="Controla estoque" value={item.stockManaged === false ? 'Não (somente catálogo)' : 'Sim'} />
          </Section>

          <Section title="Cadastro" icon="badge">
            <Row label="Fabricante" value={textOrNull(item.brand)} />
            <Row label="Modelo" value={textOrNull(item.model)} />
            <Row label="Unidade" value={textOrNull(item.unit)} />
            <Row label="Fornecedor" value={textOrNull(item.supplier)} />
            {item.description && <Row label="Descrição" value={item.description} />}
          </Section>

          <Section title="Classificação" icon="account_tree">
            <Row label="Área" value={textOrNull(item.category)} />
            <Row label="Caminho canônico" value={path ? path.join(' › ') : '—'} />
            <Row label="Status" value={item.classificationStatus === 'CLASSIFICADO' ? 'Classificado' : item.classificationStatus === 'REVISAR' ? 'Revisar' : 'Não classificado'} />
          </Section>

          {/* Movimentação (só controlado + gestor administrativo) */}
          {canManage && !catalogOnly && item.stockManaged !== false && (
            <Section title="Movimentar saldo" icon="sync_alt">
              <div className="flex items-center gap-1.5 mb-2">
                {(['entrada', 'saida'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setMovType(t)}
                    className={`flex-1 text-xs font-bold uppercase py-1.5 rounded-md border transition-colors ${movType === t ? (t === 'entrada' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-[#E63946] text-white border-[#E63946]') : 'bg-white text-slate-500 border-slate-200'}`}>
                    {t === 'entrada' ? 'Entrada' : 'Saída'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="number" min={1} value={movQty} onChange={(e) => setMovQty(Number(e.target.value))}
                  className="w-20 border border-slate-300 rounded-md px-2 py-1.5 text-sm" aria-label="Quantidade" />
                <input type="text" value={movNote} onChange={(e) => setMovNote(e.target.value)} placeholder="Observação (opcional)"
                  className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-sm" aria-label="Observação" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">Novo saldo: <b>{movType === 'entrada' ? item.quantity + Math.max(0, Math.floor(Number(movQty) || 0)) : Math.max(0, item.quantity - Math.max(0, Math.floor(Number(movQty) || 0)))}</b> {item.unit || 'un'}</p>
              <button type="button" onClick={doMove} disabled={busy}
                className="mt-2 w-full bg-[#1A1A72] text-white text-sm font-bold py-2 rounded-md disabled:opacity-60">
                {busy ? 'Registrando…' : 'Confirmar movimentação'}
              </button>
            </Section>
          )}
        </div>

        {/* Ações */}
        {canManage && (
          <div className="sticky bottom-0 bg-white border-t border-slate-200 px-4 py-3 flex items-center gap-2 mt-auto">
            <button type="button" onClick={() => onEdit(item)} className="flex-1 bg-[#1A1A72] text-white text-sm font-bold py-2.5 rounded-lg flex items-center justify-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">edit</span> Editar
            </button>
            <button type="button" onClick={() => onDelete(item)} aria-label="Excluir" className="h-11 w-11 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-[#E63946] hover:border-[#E63946]">
              <span className="material-symbols-outlined">delete</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
