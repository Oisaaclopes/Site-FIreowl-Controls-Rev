'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { SupplyOrder, InventoryItem, SupplyPurchase, Supplier } from '@/lib/types';
import { fetchPurchases, createPurchase } from '@/lib/supplyPurchases';
import { fetchSuppliers } from '@/lib/suppliers';
import { updateSupplyOrder } from '@/lib/supplyOrders';
import { SupplierPickerField } from '@/components/fornecimento/SupplierPickerField';
import { syncSupplyOrderStatus, keyOf, sugestaoCompra, totalCompra } from '@/lib/supplyReceipts';
import { isSupabaseConfigured } from '@/lib/inventory';

interface Props {
  order: SupplyOrder;
  inventory: InventoryItem[];
  onClose: () => void;
  onSaved?: () => void;
}

interface Row {
  key: string;
  inventoryItemId?: string;
  descricao: string;
  pedido: number;
  estoque: number;
  jaComprado: number;
  comprar: number;
  custo?: number;
}

const money = (n: number) => `R$ ${(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export const SupplyPurchaseModal: React.FC<Props> = ({ order, inventory, onClose, onSaved }) => {
  const online = isSupabaseConfigured();
  const [purchases, setPurchases] = useState<SupplyPurchase[] | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const purs = online ? await fetchPurchases(order.id) : [];
        if (!alive) return;
        setPurchases(purs);
        const jaComp: Record<string, number> = {};
        purs.filter((p) => p.status !== 'cancelada').forEach((p) => (p.items || []).forEach((it) => { const k = it.orderItemKey || it.inventoryItemId || ''; if (k) jaComp[k] = (jaComp[k] || 0) + Number(it.quantity || 0); }));
        const base: Row[] = (order.items || []).map((it, i) => ({ it, i })).filter((x) => x.it.tipo !== 'servico').map(({ it, i }) => {
          const key = keyOf(it, i);
          const inv = it.vinculoEstoqueId ? inventory.find((s) => s.id === it.vinculoEstoqueId) : undefined;
          const pedido = Number(it.quantidade || 0);
          const estoque = inv?.quantity || 0;
          const jc = jaComp[key] || 0;
          return { key, inventoryItemId: it.vinculoEstoqueId, descricao: it.descricao || inv?.name || 'Item', pedido, estoque, jaComprado: jc, comprar: sugestaoCompra(pedido, estoque + jc), custo: it.precoUnitario || inv?.costPrice || undefined };
        });
        setRows(base);
      } catch (e: any) { if (alive) setErro(e?.message || 'Falha ao carregar compras.'); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  // Fornecedores cadastrados (base canônica) + pré-seleção do pedido (§31/§8).
  useEffect(() => {
    if (!online) return;
    let alive = true;
    fetchSuppliers().then((list) => {
      if (!alive) return;
      setSuppliers(list);
      if (order.supplierId && list.some((s) => s.id === order.supplierId)) setSupplierId(order.supplierId);
      else if (order.supplier) {
        const m = list.find((s) => s.name.trim().toLowerCase() === (order.supplier || '').trim().toLowerCase());
        if (m) setSupplierId(m.id);
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [online, order.id, order.supplier, order.supplierId]);

  const set = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const comprarRows = useMemo(() => rows.filter((r) => r.comprar > 0), [rows]);
  const selectedSupplier = suppliers.find((s) => s.id === supplierId);
  const total = useMemo(() => totalCompra(comprarRows.map((r) => ({ quantity: r.comprar, unitCost: r.custo }))), [comprarRows]);

  const salvar = async () => {
    if (!online) { setErro('Conecte-se à internet para registrar a compra.'); return; }
    if (busy || comprarRows.length === 0) return;
    setBusy(true); setErro(null);
    try {
      const supplierSnapshot = selectedSupplier?.name || order.supplier || undefined;
      await createPurchase(
        { supplyOrderId: order.id, supplier: supplierSnapshot, supplierId: supplierId || undefined, status: 'registrada', purchaseDate, expectedDate: expectedDate || undefined, notes: notes || undefined },
        comprarRows.map((r) => ({ orderItemKey: r.key, inventoryItemId: r.inventoryItemId, descricao: r.descricao, quantity: r.comprar, unitCost: r.custo }))
      );
      // Propaga o fornecedor estruturado ao pedido, para o recebimento pré-selecionar por id (§31).
      if (supplierId && supplierId !== order.supplierId) {
        try { await updateSupplyOrder({ ...order, supplierId, supplier: supplierSnapshot }); } catch { /* não bloqueia a compra */ }
      }
      await syncSupplyOrderStatus(order);
      onSaved?.();
      onClose();
    } catch (e: any) { setErro(e?.message || 'Não foi possível registrar a compra.'); } finally { setBusy(false); }
  };

  const th = 'text-[10px] font-bold uppercase tracking-wide text-fg-muted px-2 py-1 text-center';
  const td = 'px-2 py-1.5 text-xs text-fg-secondary text-center font-data-mono';
  const inp = 'w-16 border border-border-strong rounded px-1.5 py-1 text-xs text-right font-data-mono';

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-surface w-full max-w-3xl rounded-2xl border border-border shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        <div className="bg-navy-3 text-white p-4 px-5 flex items-center justify-between shrink-0">
          <div><h3 className="text-sm font-bold uppercase tracking-wide">Registrar compra</h3><p className="text-[11px] text-fg-muted">{order.id} · {order.clientName}</p></div>
          <button onClick={onClose} className="text-fg-muted hover:text-white p-1"><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="p-5 overflow-y-auto">
          {erro && <div className="mb-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg p-2.5">{erro}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="sm:col-span-1"><label className="block text-[10px] font-bold uppercase text-fg-secondary mb-1">Fornecedor</label><SupplierPickerField suppliers={suppliers} value={supplierId} onChange={setSupplierId} onCreated={(s) => setSuppliers((prev) => [s, ...prev.filter((x) => x.id !== s.id)])} online={online} onError={setErro} /></div>
            <div><label className="block text-[10px] font-bold uppercase text-fg-secondary mb-1">Data da compra</label><input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="w-full border border-border-strong rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-[10px] font-bold uppercase text-fg-secondary mb-1">Previsão de entrega</label><input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="w-full border border-border-strong rounded-lg px-3 py-2 text-sm" /></div>
          </div>
          {purchases === null && online ? <p className="text-xs text-fg-muted">Carregando…</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead><tr className="border-b border-border"><th className={`${th} text-left`}>Produto</th><th className={th}>Pedido</th><th className={th}>Estoque</th><th className={th}>Já comprado</th><th className={th}>Comprar</th><th className={th}>Custo un.</th><th className={th}>Total</th></tr></thead>
                <tbody>
                  {rows.map((r) => {
                    const excedente = r.estoque + r.jaComprado + r.comprar - r.pedido;
                    return (
                      <tr key={r.key} className="border-b border-border">
                        <td className="px-2 py-1.5 text-xs text-left"><div className="font-semibold text-fg">{r.descricao}</div>{excedente > 0 && <span className="text-[10px] text-amber-600">{excedente} un. de excedente de estoque</span>}</td>
                        <td className={td}>{r.pedido}</td>
                        <td className={`${td} text-fg-muted`}>{r.estoque}</td>
                        <td className={`${td} text-fg-muted`}>{r.jaComprado}</td>
                        <td className={td}><input type="number" min={0} value={r.comprar} onChange={(e) => set(r.key, { comprar: Math.max(0, Number(e.target.value) || 0) })} className={inp} /></td>
                        <td className={td}><input type="number" min={0} step="0.01" value={r.custo ?? ''} onChange={(e) => set(r.key, { custo: e.target.value === '' ? undefined : Number(e.target.value) })} className={`${inp} w-20`} /></td>
                        <td className={`${td} font-bold`}>{money(r.comprar * (r.custo || 0))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div><label className="block text-[10px] font-bold uppercase text-fg-secondary mb-1 mt-3">Observação</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border border-border-strong rounded-lg px-3 py-2 text-sm" /></div>
          <p className="text-[11px] text-fg-secondary mt-2">Sugestão de compra = pedido − estoque − já comprado. Você pode ajustar (§8/§17). A compra não altera o preço de venda.</p>
        </div>
        <div className="p-4 border-t border-border bg-surface-2 flex items-center gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 text-xs font-bold uppercase text-fg-secondary hover:text-fg">Cancelar</button>
          <div className="flex-1 text-right"><span className="text-[10px] uppercase text-fg-muted">Total da compra</span> <span className="font-data-mono font-bold text-emerald-700 ml-1">{money(total)}</span></div>
          <button disabled={busy || !online || comprarRows.length === 0} onClick={salvar} className="bg-navy-3 hover:bg-[#13315C] disabled:opacity-40 text-white py-2.5 px-5 rounded-lg text-xs font-bold uppercase tracking-wider">{busy ? 'Salvando…' : 'Registrar compra'}</button>
        </div>
      </div>
    </div>
  );
};
