'use client';

import React, { useState } from 'react';
import { Pedido, DocumentType } from '@/lib/types';
import { Toggle } from '@/components/SidePanel';
import {
  DocOptions,
  DOC_OPTION_FIELDS,
  DOCUMENTOS_COM_VALORES,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_ICONS,
} from '@/lib/documentos';
import { Eye } from 'lucide-react';

interface Props {
  pedido: Pedido;
  doc: DocumentType;
  initial: DocOptions;
  onClose: () => void;
  onConfirm: (opts: DocOptions) => void;
}

/**
 * Tela de configuração que abre DEPOIS de definir o tipo de documento.
 * Opções: data de hoje, valor unitário, subtotais, descrição detalhada,
 * campos personalizados e assinatura do cliente. As opções de valor só
 * aparecem para documentos que têm preços.
 */
export const DocConfigModal: React.FC<Props> = ({ pedido, doc, initial, onClose, onConfirm }) => {
  const [opts, setOpts] = useState<DocOptions>(initial);
  const temValores = DOCUMENTOS_COM_VALORES.includes(doc);
  const set = (k: keyof DocOptions, v: boolean) => setOpts((o) => ({ ...o, [k]: v }));

  const campos = DOC_OPTION_FIELDS.filter((f) => temValores || (f.key !== 'showValorUnitario' && f.key !== 'showSubtotal'));

  return (
    <div className="fixed inset-0 z-[58] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-xl border border-slate-200 shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1A1A72]">{DOCUMENT_TYPE_ICONS[doc]}</span>
            <div>
              <h3 className="font-display text-base font-bold text-[#1A1A72] uppercase tracking-wide leading-none">Configurar documento</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">{DOCUMENT_TYPE_LABELS[doc]} — {pedido.numeroPedido}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-bold text-xl">✕</button>
        </div>

        <div className="px-6 py-5 space-y-2.5 overflow-y-auto">
          {campos.map((f) => (
            <div key={f.key} className="flex items-start justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
              <div className="min-w-0">
                <span className="text-sm font-semibold text-slate-700">{f.label}</span>
                {f.hint && <p className="text-[11px] text-slate-400 mt-0.5">{f.hint}</p>}
              </div>
              <div className="pt-0.5 shrink-0">
                <Toggle checked={!!opts[f.key]} onChange={(v) => set(f.key, v)} />
              </div>
            </div>
          ))}
          {temValores && !opts.showValorUnitario && !opts.showSubtotal && (
            <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              Documento com <strong>valor fechado</strong>: mostra só o total, sem preços por item.
            </p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider text-slate-600 hover:bg-slate-100">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(opts)}
            className="bg-[#E63946] hover:bg-[#a51515] text-white px-5 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm flex items-center gap-1.5"
          >
            <Eye className="w-4 h-4" /> Gerar documento
          </button>
        </div>
      </div>
    </div>
  );
};
