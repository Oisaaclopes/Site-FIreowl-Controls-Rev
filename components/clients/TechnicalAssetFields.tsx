'use client';
import React from 'react';
import { TechArea, CONDITIONS, CONDITION_LABEL } from '@/lib/technicalBase';
import { assetFormSpec, AssetFormValues, AssetFormField } from '@/lib/technicalAssetForm';
import { AssetConditionValue } from '@/lib/types';
import { EquipmentIdentifier, EquipmentIdentification } from '@/components/catalog/EquipmentIdentifier';
import { TechnicalCatalogItem } from '@/lib/technicalCatalog';

/* ==========================================================================
 * ETAPA 3D.5 — Renderizador ÚNICO de campos de ativo (§54).
 * Lê a config contextual (assetFormSpec) e monta o formulário adaptado ao grupo.
 * Fabricante/Modelo entram NATURALMENTE (sem card "Identificar equipamento") e
 * vêm do technical_catalog filtrado por área+grupo, com fallback manual (§8).
 * Usado por cadastro manual e por Levantamento — mesma regra em todo lugar.
 * ========================================================================== */

const inputCls = 'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-fg placeholder:text-fg-muted focus:border-primary focus:outline-none';
const labelCls = 'text-[11px] font-semibold text-fg-secondary';

interface Props {
  area: TechArea;
  group: string;
  catalog: TechnicalCatalogItem[];
  value: AssetFormValues;
  onChange: (v: AssetFormValues) => void;
}

export const TechnicalAssetFields: React.FC<Props> = ({ area, group, catalog, value, onChange }) => {
  const spec = assetFormSpec(area, group);
  const setAttr = (k: string, v: string) => onChange({ ...value, attrs: { ...value.attrs, [k]: v } });
  const setCol = (store: 'central' | 'laco' | 'endereco' | 'serial' | 'localizacao', v: string) => onChange({ ...value, [store]: v });

  const equip: EquipmentIdentification | undefined = (value.fabricante || value.modelo || value.catalogItemId)
    ? { brand: value.fabricante, model: value.modelo, catalogItemId: value.catalogItemId, manual: !value.catalogItemId && !!(value.fabricante || value.modelo) }
    : undefined;
  const onEquip = (e?: EquipmentIdentification) =>
    onChange({ ...value, fabricante: e?.brand, modelo: e?.model, catalogItemId: e?.catalogItemId });

  const renderField = (f: AssetFormField) => {
    const raw = f.store === 'attr' ? (value.attrs[f.attrKey || f.key] || '') : ((value as any)[f.store] || '');
    const setter = (v: string) => (f.store === 'attr' ? setAttr(f.attrKey || f.key, v) : setCol(f.store as any, v));
    if (f.input === 'select') {
      return (
        <label key={f.key} className="flex flex-col gap-1">
          <span className={labelCls}>{f.label}</span>
          <select value={raw} onChange={(e) => setter(e.target.value)} className={inputCls}>
            <option value="">Selecione…</option>
            {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      );
    }
    if (f.input === 'textarea') {
      return (
        <label key={f.key} className="flex flex-col gap-1 sm:col-span-2">
          <span className={labelCls}>{f.label}</span>
          <textarea value={raw} onChange={(e) => setter(e.target.value)} rows={2} className={inputCls} />
        </label>
      );
    }
    return (
      <label key={f.key} className="flex flex-col gap-1">
        <span className={labelCls}>{f.label}</span>
        <input
          value={raw}
          onChange={(e) => setter(e.target.value)}
          placeholder={f.placeholder}
          inputMode={f.inputMode || (f.input === 'ip' ? 'decimal' : undefined)}
          className={inputCls}
        />
      </label>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {/* Fabricante/Modelo naturais do formulário (§8) */}
      <div className="sm:col-span-2">
        <EquipmentIdentifier value={equip} onChange={onEquip} catalog={catalog} area={area} subcategory={group || undefined} />
        {spec.catalogOptional && <p className="mt-1 text-[10px] text-fg-muted">Fabricante/modelo são opcionais para infraestrutura.</p>}
      </div>

      {spec.fields.filter((f) => f.input !== 'textarea').map(renderField)}

      {spec.showSerial && (
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Nº de Série</span>
          <input value={value.serial || ''} onChange={(e) => setCol('serial', e.target.value)} placeholder="Aceita letras e números" className={inputCls} />
        </label>
      )}
      {spec.showLocalizacao && (
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Localização</span>
          <input value={value.localizacao || ''} onChange={(e) => setCol('localizacao', e.target.value)} className={inputCls} />
        </label>
      )}
      {spec.showCondition && (
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Condição</span>
          <select value={value.condicao || 'NORMAL'} onChange={(e) => onChange({ ...value, condicao: e.target.value as AssetConditionValue })} className={inputCls}>
            {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABEL[c]}</option>)}
          </select>
        </label>
      )}
      {/* observação técnica (textarea, largura total) */}
      {spec.showObservacao && (
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={labelCls}>Observação técnica</span>
          <textarea value={value.attrs['observacao'] || ''} onChange={(e) => setAttr('observacao', e.target.value)} rows={2} className={inputCls} />
        </label>
      )}
    </div>
  );
};
