'use client';

import React, { useState } from 'react';
import { Pedido } from '@/lib/types';
import { Toggle } from '@/components/SidePanel';
import { Plus, Trash2, SlidersHorizontal, X } from 'lucide-react';

export interface PersonalizadoData {
  titulo: string;
  campos: { rotulo: string; valor: string }[];
  incluirItens: boolean;
  incluirAssinatura: boolean;
}

interface Props {
  pedido: Pedido;
  onClose: () => void;
  onConfirm: (data: PersonalizadoData) => void;
}

export const PersonalizadoConfigModal: React.FC<Props> = ({ pedido, onClose, onConfirm }) => {
  const [titulo, setTitulo] = useState<string>(pedido.proposal?.tituloPersonalizado || 'Documento Técnico');
  const [campos, setCampos] = useState<{ rotulo: string; valor: string }[]>(
    pedido.proposal?.camposPersonalizados?.length
      ? pedido.proposal.camposPersonalizados
      : [{ rotulo: 'Observações', valor: '' }]
  );
  const [incluirItens, setIncluirItens] = useState(true);
  const [incluirAssinatura, setIncluirAssinatura] = useState(true);

  const addCampo = () => setCampos((c) => [...c, { rotulo: '', valor: '' }]);
  const updCampo = (i: number, k: 'rotulo' | 'valor', v: string) => setCampos((c) => c.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const rmCampo = (i: number) => setCampos((c) => c.filter((_, j) => j !== i));

  const confirmar = () => {
    const limpos = campos.filter((c) => c.rotulo.trim() || c.valor.trim());
    onConfirm({ titulo: titulo.trim() || 'Documento', campos: limpos, incluirItens, incluirAssinatura });
  };

  const inputCls = 'w-full border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20';
  const labelCls = 'text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 block';

  return (
    <div className="fixed inset-0 z-[58] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full rounded-xl border border-slate-200 shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-[#1A1A72]" />
            <div>
              <h3 className="font-display text-base font-bold text-[#1A1A72] uppercase tracking-wide leading-none">Documento personalizado</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">{pedido.numeroPedido} — defina o título e os campos.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <div>
            <label className={labelCls}>Título do documento</label>
            <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Termo de Vistoria" className={`${inputCls} font-semibold`} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className={labelCls}>Campos personalizados</span>
              <button type="button" onClick={addCampo} className="text-[11px] font-bold uppercase tracking-wider text-[#1A1A72] hover:underline flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Campo
              </button>
            </div>
            <div className="space-y-2">
              {campos.map((c, i) => (
                <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <input
                      type="text"
                      value={c.rotulo}
                      onChange={(e) => updCampo(i, 'rotulo', e.target.value)}
                      placeholder="Rótulo (ex.: Escopo, Parecer, Condições)"
                      className="flex-1 border border-slate-200 rounded p-1.5 text-xs font-bold text-slate-700"
                    />
                    <button type="button" onClick={() => rmCampo(i)} className="p-1 text-slate-400 hover:text-[#E63946] hover:bg-red-50 rounded shrink-0"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <textarea
                    rows={2}
                    value={c.valor}
                    onChange={(e) => updCampo(i, 'valor', e.target.value)}
                    placeholder="Conteúdo do campo…"
                    className="w-full border border-slate-200 rounded p-1.5 text-xs text-slate-600 resize-y"
                  />
                </div>
              ))}
              {campos.length === 0 && <p className="text-[11px] text-slate-400 italic">Nenhum campo. Adicione acima.</p>}
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
            <span className="text-sm font-semibold text-slate-700">Incluir tabela de itens do pedido</span>
            <Toggle checked={incluirItens} onChange={setIncluirItens} />
          </div>
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
            <span className="text-sm font-semibold text-slate-700">Incluir campo de assinatura</span>
            <Toggle checked={incluirAssinatura} onChange={setIncluirAssinatura} />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider text-slate-600 hover:bg-slate-100">Cancelar</button>
          <button onClick={confirmar} className="bg-[#E63946] hover:bg-[#a51515] text-white px-5 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm">
            Gerar documento
          </button>
        </div>
      </div>
    </div>
  );
};
