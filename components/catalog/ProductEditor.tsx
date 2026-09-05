'use client';
import React, { useMemo, useState } from 'react';
import type { InventoryItem } from '@/lib/types';
import { CatalogTree, nodePath } from '@/lib/catalogTree';
import { moneyOrDash, percentOrDash, markupOrDash, computePricing, principalValue, isPricingMode, PRICING_MODES, PricingMode } from '@/lib/priceFormation';
import { modelsInScope, allManufacturers, normalizeBrand, modelAttrs } from '@/lib/catalogSelection';
import { normalizeUnitCode, quantityUnitError } from '@/lib/commercialUnits';
import { UnitSelector } from '@/components/ui/UnitSelector';
import { PickerField } from '@/components/ui/PickerField';
import { BrandPickerField } from '@/components/catalog/BrandPickerField';

const AREAS = ['SDAI', 'CFTV', 'ALARME', 'BMS'];
const NEW_MODEL = '__new_model__';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-secondary">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const input = 'w-full border border-border-strong rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary';

/**
 * Formulário de cadastro/edição de produto.
 * IDENTIFICAÇÃO: Área → Classificação → Fabricante (picker `brands` + cadastro
 * inline, dedup por caixa/acento) → Modelo (picker de modelos compatíveis da
 * marca/classificação, ou novo modelo em texto — sem criar estoque fake).
 * COMERCIAL: custo é a base; escolhe-se UMA variável (preço/margem/markup/lucro)
 * e o motor calcula as demais (lib/priceFormation). Persiste custo + preço +
 * pricing_mode (fonte de verdade); margem/markup/lucro são derivados.
 */
export function ProductEditor({ initial, tree, inventory, suppliers, brands, onCreateBrand, onClose, onSave }: {
  initial: InventoryItem | null;
  tree: CatalogTree;
  inventory: InventoryItem[];
  suppliers: string[];
  brands: string[];
  onCreateBrand: (name: string) => Promise<string>;
  onClose: () => void;
  onSave: (item: InventoryItem) => Promise<void>;
}) {
  const editing = !!initial;
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [model, setModel] = useState(initial?.model ?? '');
  const [newModelMode, setNewModelMode] = useState(false);
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [area, setArea] = useState(initial?.category ?? '');
  const [nodeId, setNodeId] = useState(initial?.canonicalTaxonomyId ?? '');
  const [unit, setUnit] = useState(normalizeUnitCode(initial?.unit ?? 'un'));
  const [supplier, setSupplier] = useState(initial?.supplier ?? '');
  const [stockManaged, setStockManaged] = useState(initial?.stockManaged !== false);
  const [quantity, setQuantity] = useState(initial?.quantity ?? 0);
  const [minQuantity, setMinQuantity] = useState(initial?.minQuantity ?? 0);

  // Atributos técnicos estruturados (autopreenchidos do modelo; nunca inventados).
  const [productLine, setProductLine] = useState(initial?.productLine ?? '');
  const [systemType, setSystemType] = useState(initial?.systemType ?? '');
  const [technologies, setTechnologies] = useState<string[] | undefined>(initial?.technologies);

  // Comercial — custo é a base; usuário informa UMA variável principal.
  const [costPrice, setCostPrice] = useState<number | ''>(initial?.costPrice ?? '');
  const [pricingMode, setPricingMode] = useState<PricingMode>(isPricingMode(initial?.pricingMode) ? (initial!.pricingMode as PricingMode) : 'PRICE');
  const [modeValue, setModeValue] = useState<number | ''>(() => {
    const c = initial?.costPrice ?? null;
    const p = initial?.salePrice ?? initial?.unitPrice ?? null;
    if (c == null || p == null) return '';
    const m = isPricingMode(initial?.pricingMode) ? (initial!.pricingMode as PricingMode) : 'PRICE';
    return principalValue(m, computePricing(c, 'PRICE', p)) ?? '';
  });

  const cost = costPrice === '' ? null : Number(costPrice);
  const pricing = useMemo(() => computePricing(cost, pricingMode, modeValue === '' ? null : Number(modeValue)), [cost, pricingMode, modeValue]);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Nós da área escolhida, rotulados pelo caminho canônico.
  const nodeOptions = useMemo(() => {
    if (!area) return [] as { id: string; label: string }[];
    return tree.nodes
      .filter((n) => n.area === area)
      .map((n) => ({ id: n.id, label: nodePath(tree, n.id).map((x) => x.name).join(' › ') }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [area, tree]);

  // Nome do grupo/família (folha do nó canônico) — filtra modelos por tokens.
  const groupLabel = useMemo(() => (nodeId ? nodePath(tree, nodeId).slice(-1)[0]?.name ?? '' : ''), [nodeId, tree]);

  // Fabricantes conhecidos (marcas cadastradas ∪ catálogo), sem escopo de área.
  const brandOptions = useMemo(() => allManufacturers(inventory, brands), [inventory, brands]);

  // Modelos compatíveis da marca + área + classificação (o próprio item é excluído).
  const modelItems = useMemo(
    () => (brand ? modelsInScope(inventory, { area, nodeId, group: groupLabel, brand }).filter((m) => m.id !== initial?.id) : []),
    [inventory, area, nodeId, groupLabel, brand, initial?.id],
  );

  // Casa o modelo atual (texto) a um item do catálogo, se houver.
  const matchedModelId = useMemo(() => {
    const mn = normalizeBrand(model);
    return mn ? modelItems.find((m) => normalizeBrand(m.model || m.name) === mn)?.id ?? '' : '';
  }, [model, modelItems]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearModelAttrs = () => { setProductLine(''); setSystemType(''); setTechnologies(undefined); };
  const clearModel = () => { setModel(''); setNewModelMode(false); clearModelAttrs(); };

  const pickBrand = (b: string) => { setBrand(b); clearModel(); };
  const changeArea = (a: string) => { setArea(a); setNodeId(''); clearModel(); };
  const changeNode = (id: string) => { setNodeId(id); clearModel(); };

  const pickModel = (id: string) => {
    if (id === NEW_MODEL) { setNewModelMode(true); setModel(''); clearModelAttrs(); return; }
    const it = modelItems.find((m) => m.id === id);
    if (!it) return;
    setModel(it.model || it.name);
    setNewModelMode(false);
    // Autopreenchimento SOMENTE de atributos estruturados existentes (§27/§14).
    const attrs = modelAttrs(it);
    setProductLine(attrs.productLine ?? '');
    setSystemType(attrs.systemType ?? '');
    setTechnologies(attrs.technologies);
  };

  const modelPickerValue = newModelMode ? NEW_MODEL : matchedModelId;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!(name.trim() || model.trim())) { setErr('Informe ao menos o modelo ou o nome.'); return; }
    if (!area) { setErr('Selecione a área.'); return; }
    if (pricing.error) { setErr(pricing.error); return; }
    const quantityError = stockManaged && (quantityUnitError(quantity, unit) || quantityUnitError(minQuantity, unit));
    if (quantityError) { setErr(quantityError); return; }
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
      productLine: productLine.trim() || undefined,
      systemType: systemType.trim() || undefined,
      technologies: technologies && technologies.length ? technologies : undefined,
      unit: normalizeUnitCode(unit),
      supplier: supplier.trim(),
      stockManaged,
      quantity: stockManaged ? Number(quantity) || 0 : 0,
      minQuantity: stockManaged ? Number(minQuantity) || 0 : 0,
      costPrice: pricing.cost ?? undefined,
      salePrice: pricing.price ?? undefined,
      unitPrice: pricing.price ?? 0,
      profitMargin: pricing.margin ?? undefined,
      markup: pricing.markup ?? undefined,
      pricingMode,
      canonicalTaxonomyId: nodeId || undefined,
      classificationStatus: nodeId ? 'CLASSIFICADO' : (initial?.classificationStatus ?? 'NAO_CLASSIFICADO'),
    };
    setSaving(true);
    try { await onSave(payload); onClose(); }
    catch { setErr('Não foi possível salvar. Tente novamente.'); }
    finally { setSaving(false); }
  };

  const changeMode = (m: PricingMode) => {
    const seed = principalValue(m, pricing);
    setPricingMode(m);
    setModeValue(seed ?? '');
  };

  const modeField = PRICING_MODES.find((p) => p.mode === pricingMode)!;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <form onSubmit={submit} className="relative w-full sm:max-w-md bg-surface h-full overflow-y-auto shadow-2xl flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="sticky top-0 bg-surface border-b border-border px-4 py-3 flex items-center justify-between z-10">
          <p className="text-base font-bold text-primary">{editing ? 'Editar produto' : 'Novo produto'}</p>
          <button type="button" onClick={onClose} aria-label="Fechar" className="h-9 w-9 flex items-center justify-center rounded-md text-fg-muted hover:text-danger"><span className="material-symbols-outlined">close</span></button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          {/* IDENTIFICAÇÃO */}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Área"><select className={input} value={area} onChange={(e) => changeArea(e.target.value)}>
              <option value="">Selecione…</option>
              {[...new Set([...AREAS, area].filter(Boolean))].map((a) => <option key={a} value={a}>{a}</option>)}
            </select></Field>
            <Field label="Unidade"><UnitSelector value={unit} onChange={(code) => { setUnit(code); setErr(quantityUnitError(quantity, code) || quantityUnitError(minQuantity, code) || ''); }} /></Field>
          </div>
          <Field label="Classificação (caminho canônico)">
            <select className={input} value={nodeId} onChange={(e) => changeNode(e.target.value)} disabled={!area}>
              <option value="">{area ? 'Não classificado' : 'Escolha a área primeiro'}</option>
              {nodeOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field>

          <Field label="Fabricante">
            <BrandPickerField brands={brandOptions} value={brand} onChange={pickBrand} onCreate={onCreateBrand} onError={setErr}
              triggerClassName="flex-1 flex items-center justify-between gap-2 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg-secondary" />
          </Field>

          <Field label="Modelo">
            {!newModelMode ? (
              <PickerField
                ariaLabel="Modelo do produto" sheetTitle="Selecionar modelo"
                placeholder={brand ? 'Selecionar modelo' : 'Escolha o fabricante primeiro'}
                searchPlaceholder="Buscar modelo..." emptyLabel="Nenhum modelo compatível. Cadastre um novo."
                disabled={!brand}
                value={modelPickerValue}
                onChange={pickModel}
                options={[...modelItems.map((m) => ({ id: m.id, name: m.model || m.name })), { id: NEW_MODEL, name: '+ Cadastrar novo modelo' }]}
                triggerClassName="w-full flex items-center justify-between gap-2 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg-secondary disabled:opacity-60"
              />
            ) : (
              <div className="flex items-center gap-2">
                <input className={input} autoFocus value={model} onChange={(e) => setModel(e.target.value)} placeholder="Modelo (ex.: DFC 421)" />
                <button type="button" onClick={() => { setNewModelMode(false); setModel(''); }} className="shrink-0 text-[11px] font-semibold text-primary hover:underline">Do catálogo</button>
              </div>
            )}
            {newModelMode && <p className="mt-1 text-[10px] text-fg-muted">Novo modelo técnico deste produto. Não cria estoque nem movimenta saldo.</p>}
          </Field>

          {(productLine || systemType) && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Linha"><input className={input} value={productLine} onChange={(e) => setProductLine(e.target.value)} /></Field>
              <Field label="Tecnologia"><input className={input} value={systemType} onChange={(e) => setSystemType(e.target.value)} /></Field>
            </div>
          )}

          <Field label="Nome / descrição curta"><input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Central de Alarme de Incêndio" /></Field>
          <Field label="Descrição"><textarea className={input} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>

          <Field label="Fornecedor">
            <input className={input} list="supplier-list" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            <datalist id="supplier-list">{suppliers.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>

          <label className="flex items-center gap-2 text-sm font-semibold text-fg-secondary">
            <input type="checkbox" checked={stockManaged} onChange={(e) => setStockManaged(e.target.checked)} />
            Controla estoque físico (desmarque para “somente catálogo”)
          </label>

          {stockManaged && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Saldo"><input type="number" min={0} className={input} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} /></Field>
              <Field label="Estoque mínimo"><input type="number" min={0} className={input} value={minQuantity} onChange={(e) => setMinQuantity(Number(e.target.value))} /></Field>
            </div>
          )}

          {/* COMERCIAL — custo + 1 variável → demais calculadas */}
          <div className="rounded-lg border border-border bg-surface-2 p-3 flex flex-col gap-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-fg-secondary">Comercial</p>
            <Field label="Custo (R$)"><input type="number" min={0} step="0.01" className={input} value={costPrice} onChange={(e) => setCostPrice(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Custo de aquisição" /></Field>

            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-secondary">Calcular a partir de</span>
              <div className="mt-1 grid grid-cols-4 gap-1 rounded-lg bg-surface-3 p-0.5">
                {PRICING_MODES.map((p) => (
                  <button key={p.mode} type="button" onClick={() => changeMode(p.mode)}
                    className={`text-[11px] font-bold py-1.5 rounded-md transition-colors ${pricingMode === p.mode ? 'bg-surface text-primary shadow-sm' : 'text-fg-muted hover:text-fg-secondary'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <Field label={modeField.fieldLabel}>
              <input type="number" step={pricingMode === 'MARKUP' ? '0.0001' : '0.01'} className={input} value={modeValue}
                onChange={(e) => setModeValue(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder={cost == null ? 'Informe o custo primeiro' : undefined} />
            </Field>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] font-semibold text-fg-secondary bg-surface rounded-lg px-3 py-2 border border-border">
              <span>Preço de venda</span><span className="text-right"><b className="text-fg">{moneyOrDash(pricing.price)}</b></span>
              <span>Lucro unitário</span><span className="text-right"><b className="text-emerald-700">{moneyOrDash(pricing.profit)}</b></span>
              <span>Margem</span><span className="text-right"><b>{percentOrDash(pricing.margin)}</b></span>
              <span>Markup</span><span className="text-right"><b>{markupOrDash(pricing.markup)}</b></span>
            </div>
          </div>

          {err && <p role="alert" className="text-xs font-semibold text-danger">{err}</p>}
        </div>

        <div className="sticky bottom-0 bg-surface border-t border-border px-4 py-3 mt-auto">
          <button type="submit" disabled={saving} className="w-full bg-danger hover:bg-danger-hover text-white text-sm font-bold py-2.5 rounded-lg uppercase tracking-wide disabled:opacity-60">
            {saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Cadastrar produto'}
          </button>
        </div>
      </form>
    </div>
  );
}
