'use client';
import React, { useMemo, useState } from 'react';
import type { InventoryItem } from '@/lib/types';
import { PickerField } from '@/components/ui/PickerField';
import {
  areaMatches, groupsInArea, brandsInAreaGroup, productsInAreaGroup, searchCatalogItems,
  NO_BRAND, UNCLASSIFIED_GROUP,
} from '@/lib/catalogSelection';

/* ===================================================================
 * Seletor inteligente de MATERIAIS da Proposta: Área (da proposta) → Grupo/
 * Família → Fabricante → Produto. Não renderiza lista gigante de início;
 * cada passo destrava o próximo. Reutiliza a taxonomia real do estoque
 * (subcategoria) e o casamento de área da Base Técnica (areaMatches), sem
 * alterar o Levantamento. Retorna um inventory_item comercial real (id) —
 * o pai resolve descrição/unidade/preço. Nunca esconde item por saldo 0.
 * =================================================================== */

const brl = (n?: number) => (n == null ? '' : `R$ ${(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
const saldoTxt = (i: InventoryItem) => (i.stockManaged === false ? 'catálogo' : (i.quantity || 0) > 0 ? `${i.quantity} un` : 'sem saldo');

interface Props {
  items: InventoryItem[];
  /** Códigos de área da proposta (ex.: ['SDAI']). Vazio = sem restrição. */
  areaCodes: string[];
  value: string; // vinculoId selecionado
  onPick: (id: string) => void;
  onError?: (msg: string) => void;
}

export const MaterialCatalogPicker: React.FC<Props> = ({ items, areaCodes, value, onPick }) => {
  const [group, setGroup] = useState('');
  const [brand, setBrand] = useState('');
  const [search, setSearch] = useState('');
  const [showAllAreas, setShowAllAreas] = useState(false);

  // Escopo por área(s) da proposta (união). Vazio → tudo (fallback controlado).
  const scoped = useMemo(() => {
    if (showAllAreas || areaCodes.length === 0) return items;
    return items.filter((i) => areaCodes.some((a) => areaMatches(i.category, a)));
  }, [items, areaCodes, showAllAreas]);

  const groups = useMemo(() => groupsInArea(scoped, undefined), [scoped]);
  const brands = useMemo(() => (group ? brandsInAreaGroup(scoped, undefined, group) : []), [scoped, group]);
  const products = useMemo(() => (group && brand ? productsInAreaGroup(scoped, undefined, group, brand) : []), [scoped, group, brand]);

  const searchResults = useMemo(() => (search.trim() ? searchCatalogItems(items, search, showAllAreas ? undefined : (areaCodes[0] && areaCodes.length === 1 ? areaCodes[0] : undefined)) : []), [items, search, showAllAreas, areaCodes]);
  // Busca com múltiplas áreas: filtra pela união manualmente.
  const searchScoped = useMemo(() => {
    if (!search.trim()) return [] as InventoryItem[];
    if (showAllAreas || areaCodes.length <= 1) return searchResults;
    return searchResults.filter((i) => areaCodes.some((a) => areaMatches(i.category, a)));
  }, [searchResults, search, showAllAreas, areaCodes]);

  const changeGroup = (g: string) => { setGroup(g); setBrand(''); onPick(''); };
  const changeBrand = (b: string) => { setBrand(b); onPick(''); };

  const productLabel = (i: InventoryItem) => `${i.code ? `${i.code} · ` : ''}${i.model || i.name} · ${saldoTxt(i)}`;
  const brandLabel = (b: string) => (b === NO_BRAND ? 'Sem fabricante' : b);

  const groupCount = groups.length;
  const areaTag = areaCodes.length ? areaCodes.join(' / ') : 'todas as áreas';

  return (
    <div className="mb-3 rounded-lg border border-border bg-surface-2 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">Vincular do estoque · {areaTag}</p>
        {(group || brand || value) && (
          <button type="button" onClick={() => { setGroup(''); setBrand(''); onPick(''); }} className="text-[10px] font-semibold text-fg-muted hover:text-fg-secondary underline">Recomeçar</button>
        )}
      </div>

      {/* Busca direta */}
      <input
        type="text" value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Buscar direto por código, SKU, modelo ou fabricante…"
        className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-danger/20"
      />

      {search.trim() ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-fg-muted">
            <span>{searchScoped.length} produto(s) encontrado(s)</span>
            {areaCodes.length > 0 && (
              <button type="button" onClick={() => setShowAllAreas((v) => !v)} className="font-semibold text-primary hover:underline">
                {showAllAreas ? 'Só a área da proposta' : 'Mostrar todas as áreas'}
              </button>
            )}
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-border rounded-md border border-border bg-surface">
            {searchScoped.map((i) => (
              <button key={i.id} type="button" onClick={() => { onPick(i.id); setSearch(''); }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-surface-2 ${i.id === value ? 'bg-primary-soft/40' : ''}`}>
                <span className="font-semibold text-fg">{i.model || i.name}</span>
                <span className="block text-[10px] text-fg-secondary">{[i.code, i.brand, saldoTxt(i), brl(i.salePrice ?? i.unitPrice)].filter(Boolean).join(' · ')}</span>
              </button>
            ))}
            {searchScoped.length === 0 && <p className="px-3 py-3 text-center text-[11px] text-fg-muted">Nada encontrado{!showAllAreas && areaCodes.length ? ' nesta área.' : '.'}</p>}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <span className="block text-[10px] font-bold uppercase text-fg-muted mb-1">Grupo / Família</span>
            <PickerField
              ariaLabel="Grupo de materiais" sheetTitle="Selecionar grupo"
              placeholder={groupCount ? 'Selecionar grupo' : 'Sem itens na área'}
              searchPlaceholder="Buscar grupo..." emptyLabel="Nenhum grupo nesta área."
              value={group} onChange={changeGroup}
              options={groups.map((g) => ({ id: g.key, name: `${g.label} (${g.count})` }))}
              triggerClassName="w-full flex items-center justify-between gap-2 rounded-md border border-border-strong bg-surface px-3 py-2 text-xs text-fg-secondary"
            />
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase text-fg-muted mb-1">Fabricante</span>
            <PickerField
              ariaLabel="Fabricante" sheetTitle="Selecionar fabricante"
              placeholder={group ? 'Selecionar fabricante' : 'Escolha o grupo'}
              searchPlaceholder="Buscar fabricante..." emptyLabel="Nenhum fabricante neste grupo."
              disabled={!group}
              value={brand} onChange={changeBrand}
              options={brands.map((b) => ({ id: b, name: brandLabel(b) }))}
              triggerClassName="w-full flex items-center justify-between gap-2 rounded-md border border-border-strong bg-surface px-3 py-2 text-xs text-fg-secondary disabled:opacity-60"
            />
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase text-fg-muted mb-1">Produto / Modelo</span>
            <PickerField
              ariaLabel="Produto" sheetTitle="Selecionar produto"
              placeholder={brand ? 'Selecionar produto' : 'Escolha o fabricante'}
              searchPlaceholder="Buscar produto..." emptyLabel="Nenhum produto."
              disabled={!brand}
              value={value} onChange={onPick}
              options={products.map((p) => ({ id: p.id, name: productLabel(p) }))}
              triggerClassName="w-full flex items-center justify-between gap-2 rounded-md border border-border-strong bg-surface px-3 py-2 text-xs text-fg-secondary disabled:opacity-60"
            />
          </div>
        </div>
      )}

      {!search.trim() && group && brand && (
        <p className="text-[10px] text-fg-muted">{products.length} produto(s) encontrado(s){group === UNCLASSIFIED_GROUP ? ' · itens sem classificação nesta área' : ''}.</p>
      )}
      <p className="text-[10px] text-fg-muted">Não encontrou? Deixe em branco e preencha o material manualmente no card abaixo.</p>
    </div>
  );
};
