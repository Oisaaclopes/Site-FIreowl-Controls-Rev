'use client';
import { showToast } from '@/components/ui/Feedback';

import React, { useState } from 'react';
import { CustomQuote } from '@/lib/types';

interface OrcamentoViewProps {
  quotes: CustomQuote[];
  onAddQuote: (q: CustomQuote) => void;
  onConvertToOS: (q: CustomQuote) => void;
}

let quoteSeq = 100;

export const OrcamentoView: React.FC<OrcamentoViewProps> = ({
  quotes,
  onAddQuote,
  onConvertToOS,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [clientName, setClientName] = useState('Catuaí Shopping Londrina');
  const [desc, setDesc] = useState('Modernização e Expansão da Central SDAI');
  const [totalVal, setTotalVal] = useState(30000);
  const [discount, setDiscount] = useState(5);

  const laborVal = Math.round(totalVal * 0.7);
  const materialVal = Math.round(totalVal * 0.3);
  const finalVal = Math.round(totalVal * (1 - discount / 100));

  const handleCreateQuote = (e: React.FormEvent) => {
    e.preventDefault();
    const seq = (quoteSeq++).toString();
    onAddQuote({
      id: `ORC-2024-${seq}`,
      clientName,
      description: desc,
      laborValue: laborVal,
      materialValue: materialVal,
      totalValue: totalVal,
      discountApplied: discount,
      finalValue: finalVal,
      validityDays: 15,
      status: 'ENVIADO',
      createdAt: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(),
    });
    setShowModal(false);
  };

  return (
    <div className="flex flex-col w-full p-3 md:p-6 gap-3 md:gap-4">
      {/* Header */}
      <div className="flex justify-between items-center gap-3 border-b border-border pb-3">
        <div className="min-w-0">
          <span className="text-[10px] font-semibold text-fg-secondary uppercase tracking-wider">
            Composição 70% M.O. / 30% Materiais
          </span>
          <h1 className="text-lg md:text-2xl font-bold text-fg tracking-tight truncate">
            Orçamentos &amp; Propostas
          </h1>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="shrink-0 bg-danger hover:bg-danger-hover text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 uppercase"
        >
          <span className="material-symbols-outlined text-base">add</span> <span className="hidden sm:inline">Elaborar Orçamento</span><span className="sm:hidden">Novo</span>
        </button>
      </div>

      {/* Desktop: tabela */}
      <div className="hidden md:block bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 text-white text-xs font-bold uppercase tracking-wider">
          Propostas Comerciais Ativas
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-2 text-fg-secondary font-semibold uppercase tracking-wider border-b border-border">
                <th className="p-4">Código / Cliente</th>
                <th className="p-4">Escopo do Serviço</th>
                <th className="p-4">Mão de Obra (70%) / Materiais (30%)</th>
                <th className="p-4">Valor Total Final</th>
                <th className="p-4 text-center">Status / Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-medium text-fg-secondary">
              {quotes.map((q) => (
                <tr key={q.id} className="hover:bg-surface-2/80 transition-colors">
                  <td className="p-4">
                    <span className="font-data-mono font-bold text-danger">{q.id}</span> <br />
                    <span className="font-bold text-fg text-sm uppercase">{q.clientName}</span>
                  </td>
                  <td className="p-4 text-fg-secondary max-w-xs">{q.description}</td>
                  <td className="p-4 font-data-mono">
                    <span className="text-fg font-semibold">M.O: R$ {q.laborValue.toLocaleString('pt-BR')} (70%)</span> <br />
                    <span className="text-fg-secondary text-[11px]">Mat: R$ {q.materialValue.toLocaleString('pt-BR')} (30%)</span>
                  </td>
                  <td className="p-4 font-data-mono font-bold text-fg">
                    R$ {q.finalValue.toLocaleString('pt-BR')} <br />
                    <span className="text-emerald-700 font-normal text-[11px]">Desc: {q.discountApplied}%</span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="bg-slate-900 text-white px-2.5 py-0.5 rounded text-[10px] font-bold">
                        {q.status}
                      </span>
                      <button
                        onClick={() => {
                          onConvertToOS(q);
                          showToast(`Orçamento ${q.id} convertido em Pedido e Ordem de Serviço!`);
                        }}
                        className="bg-danger hover:bg-danger-hover text-white text-[10px] font-semibold px-3 py-1 rounded transition-colors uppercase tracking-wider shadow-sm"
                      >
                        Converter em OS
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: cards compactos */}
      <div className="md:hidden flex flex-col gap-2">
        {quotes.length === 0 ? (
          <p className="text-[11px] text-fg-muted italic text-center py-6">Nenhum orçamento ativo.</p>
        ) : (
          quotes.map((q) => (
            <div key={q.id} className="bg-surface rounded-lg border border-border shadow-sm p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-data-mono text-[11px] font-bold text-danger">{q.id}</span>
                <span className="bg-slate-900 text-white px-2 py-0.5 rounded text-[9px] font-bold uppercase">{q.status}</span>
              </div>
              <p className="font-bold text-fg text-sm uppercase truncate mt-1">{q.clientName}</p>
              <p className="text-[11px] text-fg-secondary mt-0.5 line-clamp-2">{q.description}</p>
              <div className="flex items-end justify-between gap-2 mt-2">
                <div className="font-data-mono min-w-0">
                  <p className="font-bold text-fg text-sm">R$ {q.finalValue.toLocaleString('pt-BR')}</p>
                  <p className="text-fg-muted text-[10px]">M.O R$ {q.laborValue.toLocaleString('pt-BR')} · Mat R$ {q.materialValue.toLocaleString('pt-BR')} · -{q.discountApplied}%</p>
                </div>
                <button
                  onClick={() => {
                    onConvertToOS(q);
                    showToast(`Orçamento ${q.id} convertido em Pedido e Ordem de Serviço!`);
                  }}
                  className="shrink-0 bg-danger hover:bg-danger-hover text-white text-[10px] font-semibold px-3 py-1.5 rounded uppercase tracking-wider shadow-sm"
                >
                  Converter em OS
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Add Quote */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface max-w-md w-full rounded-xl border border-border p-6 shadow-2xl relative">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-fg-muted hover:text-fg-secondary font-bold">
              ✕
            </button>
            <h3 className="text-lg font-bold text-fg uppercase mb-4">Novo Orçamento Técnico</h3>
            <form onSubmit={handleCreateQuote} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-fg-secondary mb-1 font-semibold uppercase">Razão Social do Cliente</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full border border-border rounded-lg p-2.5 text-fg focus:outline-none focus:ring-2 focus:ring-danger/20"
                />
              </div>
              <div>
                <label className="block text-fg-secondary mb-1 font-semibold uppercase">Escopo da Proposta</label>
                <input
                  type="text"
                  required
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full border border-border rounded-lg p-2.5 text-fg focus:outline-none focus:ring-2 focus:ring-danger/20"
                />
              </div>
              <div>
                <label className="block text-fg-secondary mb-1 font-semibold uppercase">Valor Bruto (R$)</label>
                <input
                  type="number"
                  required
                  value={totalVal}
                  onChange={(e) => setTotalVal(Number(e.target.value))}
                  className="w-full border border-border rounded-lg p-2.5 text-fg font-data-mono focus:outline-none focus:ring-2 focus:ring-danger/20"
                />
              </div>
              <div className="bg-surface-2 p-3 rounded-lg border border-border font-data-mono text-xs space-y-1">
                <div><strong className="text-fg">Composição Automática:</strong></div>
                <div>Mão de Obra (70%): R$ {laborVal.toLocaleString('pt-BR')}</div>
                <div>Materiais (30%): R$ {materialVal.toLocaleString('pt-BR')}</div>
              </div>
              <div>
                <label className="block text-fg-secondary mb-1 font-semibold uppercase">Desconto Aplicado (%)</label>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-full border border-border rounded-lg p-2.5 text-fg font-data-mono focus:outline-none focus:ring-2 focus:ring-danger/20"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-danger hover:bg-danger-hover text-white py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
              >
                Gerar Proposta Comercial
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
