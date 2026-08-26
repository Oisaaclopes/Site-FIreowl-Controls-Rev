'use client';

import React from 'react';
import { DocumentType } from '@/lib/types';
import {
  DOCUMENT_TYPE_ORDER,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_ICONS,
  isDocumentoImplementado,
} from '@/lib/documentos';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (doc: DocumentType) => void;
  /** Documento pré-selecionado (fica destacado). */
  atual?: DocumentType;
}

/**
 * Modal "Qual documento gerar?" — as 8 opções. Fase 1: só a Proposta comercial
 * está implementada; as demais aparecem como "em breve" (desabilitadas).
 */
export const DocumentTypeModal: React.FC<Props> = ({ isOpen, onClose, onSelect, atual }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full rounded-xl border border-slate-200 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1A1A72]">description</span>
            <h3 className="font-display text-base font-bold text-[#1A1A72] uppercase tracking-wide">
              Qual documento gerar?
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-bold text-xl">
            ✕
          </button>
        </div>

        <div className="px-6 py-5 grid grid-cols-2 gap-3">
          {DOCUMENT_TYPE_ORDER.map((doc) => {
            const impl = isDocumentoImplementado(doc);
            const selecionado = atual === doc;
            return (
              <button
                key={doc}
                type="button"
                disabled={!impl}
                onClick={() => impl && onSelect(doc)}
                className={[
                  'flex items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
                  impl
                    ? selecionado
                      ? 'border-[#1A1A72] bg-[#1A1A72]/5 hover:bg-[#1A1A72]/10'
                      : 'border-slate-200 bg-white hover:border-[#1A1A72] hover:bg-slate-50'
                    : 'border-dashed border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed',
                ].join(' ')}
              >
                <span
                  className={`material-symbols-outlined text-xl shrink-0 ${
                    impl ? 'text-[#E63946]' : 'text-slate-400'
                  }`}
                >
                  {DOCUMENT_TYPE_ICONS[doc]}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-800">{DOCUMENT_TYPE_LABELS[doc]}</span>
                  {!impl && <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Em breve</span>}
                </span>
              </button>
            );
          })}
        </div>

        <div className="px-6 pb-5 pt-1">
          <p className="text-[11px] text-slate-400 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">info</span>
            Defina um documento padrão por tipo de pedido em Conta → PDF para pular esta escolha.
          </p>
        </div>
      </div>
    </div>
  );
};
