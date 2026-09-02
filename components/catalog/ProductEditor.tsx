'use client';
import React, { useMemo, useState } from 'react';
import type { InventoryItem } from '@/lib/types';
import { CatalogTree, nodePath } from '@/lib/catalogTree';
import { calculateProfit, calculateMarkup, calculateMargin, moneyOrDash, percentOrDash, ratioOrDash } from '@/lib/productPricing';
import { COMMERCIAL_UNITS, normalizeUnitCode } from '@/lib/commercialUnits';

const AREAS = ['SDAI', 'CFTV', 'ALARME', 'BMS'];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const input = 'w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#1A1A72]';

/**
 * Formulário de cadastro/edição de produto. Taxonomia canônica como fonte
 * (área + nó), não subcategory legado. Comercial com preview de lucro/margem/
 * markup (helpers de productPricing). Salva via onSave (mutation layer).
 */
export function ProductEditor({ initial, tree, suppliers, onClose, onSave }: {
  initial: InventoryItem | null;
  tree: CatalogTree;
  suppliers: string[];
  onClose: () => void;
  onSave: (item: InventoryItem) => Promise<void>;
}) {
  const editing = !!initial;
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [model, setModel] = useState(initial?.model ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [area, setArea] = useState(initial?.category ?? '');
  const [nodeId, setNodeId] = useState(initial?.canonicalTaxonomyId ?? '');
  const [unit, setUnit] = useState(normalizeUnitCode(initial?.unit ?? 'un'));
  const [supplier, setSupplier] = useState(initial?.supplier ?? '');
  const [stockManaged, setStockManaged] = useState(initial?.stockManaged !== false);
  const [quantity, setQuantity] = useState(initial?.quantity ?? 0);
  const [minQuantity, setMinQuantity] = useState(initial?.minQuantity ?? 0);
  const [costPrice, setCostPrice] = useState<number | ''>(initial?.costPrice ?? '');
  const [salePrice, setSalePrice] = useState<number | ''>(initial?.salePrice ?? initial?.unitPrice ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const cost = costPrice === '' ? null : Number(costPrice);
  const price = salePrice === '' ? null : Number(salePrice);
  const profit = calculateProfit(cost, price);
  const margin = calculateMargin(cost, price);
  const markup = calculateMarkup(cost, price);

  // Nós da área escolhida, rotulados pelo caminho canônico.
  const nodeOptions = useMemo(() => {
    if (!area) return [] as { id: string; label: string }[];
    return tree.nodes
      .filter((n) => n.area === area)
      .map((n) => ({ id: n.id, label: nodePath(tree, n.id).map((x) => x.name).join(' › ') }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [area, tree]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!(name.trim() || model.trim())) { setErr('Informe ao menos o modelo ou o nome.'); return; }
    if (!area) { setErr('Selecione a área.'); return; }
    setErr('');
    const finalName = name.trim() || model.trim();
    const code = initial?.code || `${area}-${Date.now().toString(36).toUpperCase()}`;
    const payload: InventoryItem = {
      ...(initial ?? { id: '', quantity: 0, minQuantity: 0, unitPrice: 0, supplier: '', location: '', name: '', category: '', code: '' }),
      id: initial?.id ?? '',
      code,
      name: finalName,
      category: area,
      brand: brand.trim() || undefined,
      model: model.trim() || undefined,
      description: description.trim() || undefined,
      unit: normalizeUnitCode(unit),
      supplier: supplier.trim(),
      stockManaged,
      quantity: stockManaged ? Number(quantity) || 0 : 0,
      minQuantity: stockManaged ? Number(minQuantity) || 0 : 0,
      costPrice: cost ?? undefined,
      salePrice: price ?? undefined,
      unitPrice: price ?? 0,
      canonicalTaxonomyId: nodeId || undefined,
      classificationStatus: nodeId ? 'CLASSIFICADO' : (initial?.classificationStatus ?? 'NAO_CLASSIFICADO'),
    };
    setSaving(true);
    try { await onSave(payload); onClose(); }
    catch { setErr('Não foi possível salvar. Tente novamente.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <form onSubmit={submit} className="relative w-full sm:max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between z-10">
          <p className="text-base font-bold text-[#1A1A72]">{editing ? 'Editar produto' : 'Novo produto'}</p>
          <button type="button" onClick={onClose} aria-label="Fechar" className="h-9 w-9 flex items-center justify-center rounded-md text-slate-400 hover:text-[#E63946]"><span className="material-symbols-outlined">close</span></button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Fabricante"><input className={input} value={brand} onChange={(e) => setBrand(e.target.value)} /></Field>
            <Field label="Modelo"><input className={input} value={model} onChange={(e) => setModel(e.target.value)} /></Field>
          </div>
          <Field label="Nome / descrição curta"><input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Central de Alarme de Incêndio" /></Field>
          <Field label="Descrição"><textarea className={input} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Área"><select className={input} value={area} onChange={(e) => { setArea(e.target.value); setNodeId(''); }}>
              <option value="">Selecione…</option>
              {[...new Set([...AREAS, area].filter(Boolean))].map((a) => <option key={a} value={a}>{a}</option>)}
            </select></Field>
            <Field label="Unidade"><select className={input} value={COMMERCIAL_UNITS.some((u) => u.code === unit) ? unit : '__outro'} onChange={(e) => { if (e.target.value !== '__outro') setUnit(e.target.value); }}>
              {COMMERCIAL_UNITS.map((u) => <option key={u.code} value={u.code}>{u.code} — {u.label}</option>)}
              {!COMMERCIAL_UNITS.some((u) => u.code === unit) && unit && <option value="__outro">{unit} (não padrão)</option>}
            </select></Field>
          </div>
          <Field label="Caminho canônico (classificação)">
            <select className={input} value={nodeId} onChange={(e) => setNodeId(e.target.value)} disabled={!area}>
              <option value="">{area ? 'Não classificado' : 'Escolha a área primeiro'}</option>
              {nodeOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field>

          <Field label="Fornecedor">
            <input className={input} list="supplier-list" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            <datalist id="supplier-list">{suppliers.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>

          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <input type="checkbox" checked={stockManaged} onChange={(e) => setStockManaged(e.target.checked)} />
            Controla estoque físico (desmarque para “somente catálogo”)
          </label>

          {stockManaged && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Saldo"><input type="number" min={0} className={input} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} /></Field>
              <Field label="Estoque mínimo"><input type="number" min={0} className={input} value={minQuantity} onChange={(e) => setMinQuantity(Number(e.target.value))} /></Field>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Field label="Custo (R$)"><input type="number" min={0} step="0.01" className={input} value={costPrice} onChange={(e) => setCostPrice(e.target.value === '' ? '' : Number(e.target.value))} /></Field>
            <Field label="Preço de venda (R$)"><input type="number" min={0} step="0.01" className={input} value={salePrice} onChange={(e) => setSalePrice(e.target.value === '' ? '' : Number(e.target.value))} /></Field>
          </div>
          <div className="flex items-center gap-3 flex-wrap text-[11px] font-semibold text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
            <span>Lucro: <b className="text-emerald-700">{moneyOrDash(profit)}</b></span>
            <span>Margem: <b>{percentOrDash(margin)}</b></span>
            <span>Markup: <b>{ratioOrDash(markup)}</b></span>
          </div>

          {err && <p role="alert" className="text-xs font-semibold text-[#E63946]">{err}</p>}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-4 py-3 mt-auto">
          <button type="submit" disabled={saving} className="w-full bg-[#E63946] hover:bg-[#a51515] text-white text-sm font-bold py-2.5 rounded-lg uppercase tracking-wide disabled:opacity-60">
            {saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Cadastrar produto'}
          </button>
        </div>
      </form>
    </div>
  );
}
