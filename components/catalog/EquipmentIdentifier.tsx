'use client';

import React, { useMemo } from 'react';
import { PickerField } from '@/components/ui/PickerField';
import {
  manufacturersFromCatalog,
  modelsForManufacturer,
  TechnicalCatalogItem,
} from '@/lib/technicalCatalog';

/* ===================================================================
 * CORREÇÃO pós-3B.4 — Identificação de EQUIPAMENTO (§1–§5, §27–§31).
 *   FABRICANTE e MODELO vêm SOMENTE do technical_catalog (sem preço/saldo).
 *   NUNCA consulta profiles/funcionários — usa o PickerField genérico com
 *   linguagem de equipamento e estados vazios corretos.
 *   Quando a categoria (subcategory da taxonomia) é conhecida, fabricantes e
 *   modelos são filtrados por ela (§27). "Não encontrei no catálogo" → manual.
 *   IDENTIFICAÇÃO ≠ material utilizado: NUNCA movimenta estoque (§42 da 3B.4).
 * =================================================================== */

export interface EquipmentIdentification {
  catalogItemId?: string;
  brand?: string;
  model?: string;
  manual?: boolean;
}

export function equipmentHasContent(v?: EquipmentIdentification | null): boolean {
  return !!v && !!((v.brand || '').trim() || (v.model || '').trim());
}

interface Props {
  value?: EquipmentIdentification | null;
  onChange: (v: EquipmentIdentification | undefined) => void;
  catalog: TechnicalCatalogItem[];
  /** Área da OS (category no catálogo; case-insensitive). */
  area?: string;
  /** Tipo/família (subcategory da taxonomia) para filtrar fabricantes/modelos. */
  subcategory?: string;
}

export const EquipmentIdentifier: React.FC<Props> = ({ value, onChange, catalog, area, subcategory }) => {
  const v = value || {};
  const manual = !!v.manual;

  const manufacturers = useMemo(
    () => manufacturersFromCatalog(catalog, area, subcategory),
    [catalog, area, subcategory]
  );
  const models = useMemo(
    () => (v.brand && !manual ? modelsForManufacturer(catalog, v.brand, area, subcategory) : []),
    [catalog, v.brand, area, subcategory, manual]
  );

  const catalogEmpty = manufacturers.length === 0;

  const pickBrand = (brand: string) => onChange(brand ? { brand, manual: false } : undefined);
  const pickModel = (itemId: string) => {
    const it = models.find((m) => m.id === itemId);
    onChange({ catalogItemId: it?.id, brand: it?.brand || v.brand, model: it?.model || it?.name, manual: false });
  };
  const setManualField = (field: 'brand' | 'model', text: string) => onChange({ ...v, manual: true, catalogItemId: undefined, [field]: text });
  const enableManual = () => onChange({ manual: true, brand: v.brand, model: undefined });
  const backToCatalog = () => onChange(undefined);

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-fg-secondary">Identificar equipamento (opcional)</p>
        {equipmentHasContent(v) && (
          <button type="button" onClick={backToCatalog} className="text-[10px] font-semibold text-fg-muted hover:text-fg-secondary uppercase">Limpar</button>
        )}
      </div>

      {!manual ? (
        <div className="flex flex-col gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase text-fg-muted">Fabricante</span>
            <PickerField
              ariaLabel="Fabricante do equipamento"
              sheetTitle="Selecionar fabricante"
              placeholder="Selecionar fabricante"
              searchPlaceholder="Buscar fabricante..."
              emptyLabel="Nenhum fabricante encontrado."
              value={v.brand && manufacturers.includes(v.brand) ? v.brand : ''}
              onChange={pickBrand}
              options={manufacturers.map((m) => ({ id: m, name: m }))}
              triggerClassName="mt-1 w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-fg-secondary"
            />
          </div>
          {v.brand && (
            <div>
              <span className="text-[10px] font-bold uppercase text-fg-muted">Modelo</span>
              <PickerField
                ariaLabel="Modelo do equipamento"
                sheetTitle="Selecionar modelo"
                placeholder="Selecionar modelo"
                searchPlaceholder="Buscar modelo..."
                emptyLabel="Nenhum modelo encontrado."
                value={v.catalogItemId || ''}
                onChange={pickModel}
                options={models.map((m) => ({ id: m.id, name: m.model || m.name }))}
                triggerClassName="mt-1 w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-fg-secondary"
              />
            </div>
          )}
          <button type="button" onClick={enableManual} className="mt-1 self-start text-[11px] font-semibold text-primary hover:underline">
            {catalogEmpty ? 'Informar fabricante/modelo manualmente' : 'Não encontrei no catálogo'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <input value={v.brand || ''} onChange={(e) => setManualField('brand', e.target.value)} placeholder="Fabricante (ex.: Tecnohold)" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25" />
          <input value={v.model || ''} onChange={(e) => setManualField('model', e.target.value)} placeholder="Modelo (ex.: AMETI2 IP-67)" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25" />
          <p className="text-[10px] text-fg-muted">Registro técnico da evidência. Não cria produto no estoque nem movimenta saldo.</p>
          {!catalogEmpty && (
            <button type="button" onClick={backToCatalog} className="self-start text-[11px] font-semibold text-primary hover:underline">Escolher do catálogo</button>
          )}
        </div>
      )}
    </div>
  );
};
