'use client';

import React, { useMemo, useState } from 'react';
import { PedidoEquipmentItem } from '@/lib/types';
import { Plus, Minus, Trash2, ChevronUp, ChevronDown, Pencil, Check, X } from 'lucide-react';

const brl = (n: number) => `R$ ${(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const lineTotal = (it: { precoUnitario?: number; quantidade: number; desconto?: number }) =>
  Math.max(0, (it.precoUnitario || 0) * it.quantidade - (it.desconto || 0));

type Draft = {
  descricao: string;
  descricaoDetalhada: string;
  marcaModelo: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
  desconto: number;
  vinculoId: string;
};

interface Props {
  tipo: 'material' | 'servico';
  accent: 'red' | 'emerald';
  itens: { it: PedidoEquipmentItem; idx: number }[];
  /** Opções para vincular (estoque ou catálogo de serviços). */
  catalogo?: { id: string; label: string }[];
  /** Resolve os campos a preencher ao escolher um item do catálogo. */
  resolveCatalogo?: (id: string) => Partial<PedidoEquipmentItem> | undefined;
  onAdd: (item: Partial<PedidoEquipmentItem>) => void;
  onUpdate: (idx: number, patch: Partial<PedidoEquipmentItem>) => void;
  onRemove: (idx: number) => void;
  onMove: (idx: number, dir: -1 | 1) => void;
}

const emptyDraft = (tipo: 'material' | 'servico'): Draft => ({
  descricao: '',
  descricaoDetalhada: '',
  marcaModelo: '',
  unidade: tipo === 'servico' ? 'vb' : 'un',
  quantidade: 1,
  precoUnitario: 0,
  desconto: 0,
  vinculoId: '',
});

export const ItensCardEditor: React.FC<Props> = ({ tipo, accent, itens, catalogo, resolveCatalogo, onAdd, onUpdate, onRemove, onMove }) => {
  const [draft, setDraft] = useState<Draft>(emptyDraft(tipo));
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [catalogoFilter, setCatalogoFilter] = useState('');

  const filteredCatalogo = useMemo(() => {
    if (!catalogo) return [];
    if (!catalogoFilter.trim()) return catalogo;
    const term = catalogoFilter.toLowerCase().trim();
    return catalogo.filter((c) => c.label.toLowerCase().includes(term));
  }, [catalogo, catalogoFilter]);

  const isServico = tipo === 'servico';
  const accentText = accent === 'emerald' ? 'text-emerald-700' : 'text-[#E63946]';
  const accentBg = accent === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-[#E63946] hover:bg-[#a51515]';
  const accentRing = accent === 'emerald' ? 'focus:ring-emerald-500/25' : 'focus:ring-[#E63946]/20';

  const total = itens.reduce((a, x) => a + lineTotal(x.it), 0);

  const set = (k: keyof Draft, v: string | number) => setDraft((d) => ({ ...d, [k]: v }));

  const pickCatalogo = (id: string) => {
    setDraft((d) => ({ ...d, vinculoId: id }));
    if (!id || !resolveCatalogo) return;
    const fill = resolveCatalogo(id);
    if (fill) {
      setDraft((d) => ({
        ...d,
        descricao: fill.descricao ?? d.descricao,
        marcaModelo: fill.marcaModelo ?? d.marcaModelo,
        precoUnitario: fill.precoUnitario ?? d.precoUnitario,
        unidade: fill.unidade ?? d.unidade,
      }));
    }
  };

  const resetDraft = () => { setDraft(emptyDraft(tipo)); setEditingIdx(null); };

  const commit = () => {
    if (!draft.descricao.trim()) return;
    const payload: Partial<PedidoEquipmentItem> = {
      descricao: draft.descricao.trim(),
      descricaoDetalhada: draft.descricaoDetalhada.trim() || undefined,
      marcaModelo: draft.marcaModelo.trim(),
      unidade: draft.unidade.trim() || (isServico ? 'vb' : 'un'),
      quantidade: Math.max(1, Math.floor(draft.quantidade || 1)),
      precoUnitario: draft.precoUnitario || 0,
      desconto: draft.desconto ? Math.max(0, draft.desconto) : undefined,
      ...(isServico ? { vinculoServicoId: draft.vinculoId || undefined } : { vinculoEstoqueId: draft.vinculoId || undefined }),
      tipo,
    };
    if (editingIdx !== null) onUpdate(editingIdx, payload);
    else onAdd(payload);
    resetDraft();
  };

  const startEdit = (idx: number, it: PedidoEquipmentItem) => {
    setOpenMenu(null);
    setEditingIdx(idx);
    setDraft({
      descricao: it.descricao || '',
      descricaoDetalhada: it.descricaoDetalhada || '',
      marcaModelo: it.marcaModelo || '',
      unidade: it.unidade || (isServico ? 'vb' : 'un'),
      quantidade: it.quantidade || 1,
      precoUnitario: it.precoUnitario || 0,
      desconto: it.desconto || 0,
      vinculoId: (isServico ? it.vinculoServicoId : it.vinculoEstoqueId) || '',
    });
  };

  const stepQtd = (idx: number, it: PedidoEquipmentItem, delta: number) =>
    onUpdate(idx, { quantidade: Math.max(1, (it.quantidade || 1) + delta) });

  const inputCls = `w-full border border-slate-300 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 ${accentRing}`;
  const miniLabel = 'block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1';

  return (
    <div className="space-y-3">
      {/* ---- Lista de itens (cards compactos) ---- */}
      {itens.length > 0 ? (
        <div className="space-y-2">
          {itens.map(({ it, idx }, pos) => (
            <div key={idx} className={`relative rounded-xl border bg-white p-3 ${editingIdx === idx ? (accent === 'emerald' ? 'border-emerald-400 ring-1 ring-emerald-200' : 'border-[#E63946]/50 ring-1 ring-[#E63946]/15') : 'border-slate-200'}`}>
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 font-data-mono font-bold text-xs ${accentText}`}>{pos + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800 text-sm leading-snug break-words">{it.descricao || <span className="text-slate-400 italic">Sem descrição</span>}</p>
                  {it.descricaoDetalhada && <p className="text-[11px] text-slate-500 leading-snug mt-0.5 break-words">{it.descricaoDetalhada}</p>}
                  <p className="text-[11px] text-slate-500 font-data-mono mt-1">
                    {(it.unidade || 'un').toUpperCase()} · {it.quantidade}× {brl(it.precoUnitario || 0)}
                    {it.desconto ? <span className="text-[#E63946]"> · desc {brl(it.desconto)}</span> : null}
                  </p>
                  {(it.sourceOrigins?.length || it.stockSnapshot !== undefined) ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {it.sourceOrigins?.slice(0, 2).map((origin, originIndex) => (
                        <span key={`${origin.reportId}-${originIndex}`} title={origin.reference || origin.label} className="max-w-full truncate rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700">Origem: {origin.label}</span>
                      ))}
                      {(it.sourceOrigins?.length || 0) > 2 && <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700">+{(it.sourceOrigins?.length || 0) - 2} origem(ns)</span>}
                      {it.stockSnapshot !== undefined && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">Saldo consultado: {it.stockSnapshot}</span>}
                    </div>
                  ) : null}
                </div>
                {/* Menu de opções */}
                <div className="relative shrink-0">
                  <button type="button" onClick={() => setOpenMenu(openMenu === idx ? null : idx)} className="p-1 text-slate-400 hover:text-slate-700 rounded" title="Opções">
                    <span className="material-symbols-outlined text-lg leading-none">more_vert</span>
                  </button>
                  {openMenu === idx && (
                    <div className="absolute right-0 top-7 z-10 w-36 bg-white border border-slate-200 rounded-lg shadow-lg py-1 text-xs">
                      <button type="button" onClick={() => startEdit(idx, it)} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"><Pencil className="w-3.5 h-3.5" /> Editar</button>
                      <button type="button" onClick={() => { setOpenMenu(null); onMove(idx, -1); }} disabled={pos === 0} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 disabled:opacity-40"><ChevronUp className="w-3.5 h-3.5" /> Mover p/ cima</button>
                      <button type="button" onClick={() => { setOpenMenu(null); onMove(idx, 1); }} disabled={pos === itens.length - 1} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 disabled:opacity-40"><ChevronDown className="w-3.5 h-3.5" /> Mover p/ baixo</button>
                      <button type="button" onClick={() => { setOpenMenu(null); onRemove(idx); }} className="w-full text-left px-3 py-2 hover:bg-red-50 flex items-center gap-2 text-[#E63946]"><Trash2 className="w-3.5 h-3.5" /> Remover</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                {/* Stepper de quantidade */}
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => stepQtd(idx, it, -1)} className="w-7 h-7 rounded-full border border-slate-300 text-slate-500 hover:bg-slate-50 flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button>
                  <input
                    type="number" min={1} value={it.quantidade}
                    onChange={(e) => onUpdate(idx, { quantidade: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                    className="w-14 text-center font-data-mono font-bold text-slate-800 border border-slate-200 rounded-lg p-1.5"
                  />
                  <button type="button" onClick={() => stepQtd(idx, it, 1)} className={`w-7 h-7 rounded-full border flex items-center justify-center ${accent === 'emerald' ? 'border-emerald-300 text-emerald-600 hover:bg-emerald-50' : 'border-[#E63946]/40 text-[#E63946] hover:bg-red-50'}`}><Plus className="w-3.5 h-3.5" /></button>
                </div>
                <span className={`font-data-mono font-bold text-sm ${accentText}`}>{brl(lineTotal(it))}</span>
              </div>
            </div>
          ))}

          {/* Total */}
          <div className="flex items-center justify-between bg-slate-100 rounded-xl px-4 py-3">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Quantidade</span>
              <span className="text-sm font-bold text-slate-700">{itens.reduce((a, x) => a + (x.it.quantidade || 0), 0)}</span>
            </div>
            <div className="text-right">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Valor total ({isServico ? 'serviços' : 'materiais'})</span>
              <span className="text-base font-bold text-slate-900 font-data-mono">{brl(total)}</span>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 italic px-1">Nenhum {isServico ? 'serviço' : 'material'} adicionado. Use o card abaixo.</p>
      )}

      {/* ---- Card grande para adicionar / editar ---- */}
      <div className={`rounded-xl border-2 border-dashed p-4 ${accent === 'emerald' ? 'border-emerald-200 bg-emerald-50/40' : 'border-[#E63946]/25 bg-red-50/30'}`}>
        <div className="flex items-center justify-between mb-3">
          <span className={`text-xs font-bold uppercase tracking-wider ${accentText}`}>
            {editingIdx !== null ? `Editando ${isServico ? 'serviço' : 'material'}` : `Adicionar ${isServico ? 'serviço' : 'material'}`}
          </span>
          {editingIdx !== null && (
            <button type="button" onClick={resetDraft} className="text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-1"><X className="w-3.5 h-3.5" /> Cancelar edição</button>
          )}
        </div>

        {catalogo && catalogo.length > 0 && (
          <div className="mb-3 space-y-1">
            <div className="flex items-center justify-between">
              <label className={miniLabel}>Vincular do {isServico ? 'catálogo de serviços' : 'estoque'} (opcional)</label>
              {catalogoFilter && (
                <button
                  type="button"
                  onClick={() => setCatalogoFilter('')}
                  className="text-[10px] text-slate-400 hover:text-slate-600 underline font-medium"
                >
                  Limpar busca ({filteredCatalogo.length} itens)
                </button>
              )}
            </div>
            <input
              type="text"
              value={catalogoFilter}
              onChange={(e) => setCatalogoFilter(e.target.value)}
              placeholder={`🔍 Filtrar ${isServico ? 'serviços' : 'materiais do estoque'} por código, nome ou marca...`}
              className={`${inputCls} bg-white text-xs mb-1.5`}
            />
            <select value={draft.vinculoId} onChange={(e) => pickCatalogo(e.target.value)} className={`${inputCls} bg-white text-xs`}>
              <option value="">Digitar manualmente… ({filteredCatalogo.length} disponíveis)</option>
              {filteredCatalogo.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-3">
          <label className={miniLabel}>Descrição</label>
          <input type="text" value={draft.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder={isServico ? 'Serviço a ser realizado…' : 'Material…'} className={inputCls} />
        </div>

        <div className="mb-3">
          <label className={miniLabel}>Descrição detalhada (opcional)</label>
          <textarea rows={2} value={draft.descricaoDetalhada} onChange={(e) => set('descricaoDetalhada', e.target.value)} placeholder="Detalhes que aparecem abaixo do item no documento…" className={`${inputCls} resize-y`} />
        </div>

        {!isServico && (
          <div className="mb-3">
            <label className={miniLabel}>Marca / Modelo (opcional)</label>
            <input type="text" value={draft.marcaModelo} onChange={(e) => set('marcaModelo', e.target.value)} placeholder="Ex.: Notifier FSP-951" className={inputCls} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className={miniLabel}>Preço (R$)</label>
            <input type="number" min={0} step="0.01" value={draft.precoUnitario} onChange={(e) => set('precoUnitario', Number(e.target.value))} className={`${inputCls} font-data-mono`} />
          </div>
          <div>
            <label className={miniLabel}>Quantidade</label>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => set('quantidade', Math.max(1, (draft.quantidade || 1) - 1))} className="w-9 h-[42px] rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-50 flex items-center justify-center shrink-0"><Minus className="w-4 h-4" /></button>
              <input type="number" min={1} value={draft.quantidade} onChange={(e) => set('quantidade', Math.max(1, Math.floor(Number(e.target.value) || 1)))} className={`${inputCls} text-center font-data-mono font-bold`} />
              <button type="button" onClick={() => set('quantidade', (draft.quantidade || 1) + 1)} className="w-9 h-[42px] rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-50 flex items-center justify-center shrink-0"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
          <div>
            <label className={miniLabel}>Unidade de medida</label>
            <input type="text" value={draft.unidade} onChange={(e) => set('unidade', e.target.value)} placeholder="un, vb, m, rl…" className={`${inputCls} uppercase`} />
          </div>
          <div>
            <label className={miniLabel}>Desconto (R$)</label>
            <input type="number" min={0} step="0.01" value={draft.desconto} onChange={(e) => set('desconto', Number(e.target.value))} className={`${inputCls} font-data-mono`} />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-data-mono">Total do item: <b className="text-slate-800">{brl(lineTotal({ precoUnitario: draft.precoUnitario, quantidade: draft.quantidade, desconto: draft.desconto }))}</b></span>
          <button type="button" onClick={commit} disabled={!draft.descricao.trim()} className={`${accentBg} disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-sm flex items-center gap-1.5`}>
            {editingIdx !== null ? <><Check className="w-4 h-4" /> Salvar</> : <><Plus className="w-4 h-4" /> Adicionar</>}
          </button>
        </div>
      </div>
    </div>
  );
};
