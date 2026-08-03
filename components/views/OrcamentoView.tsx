'use client';

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
    <div className="flex flex-col w-full p-8 gap-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Composição Comercial (Regra 70% Mão de Obra / 30% Materiais)
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Orçamentos &amp; Propostas Técnicas
          </h1>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-[#E63946] hover:bg-[#a51515] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 uppercase"
        >
          <span className="material-symbols-outlined text-base">add</span> Elaborar Orçamento
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 text-white text-xs font-bold uppercase tracking-wider">
          Propostas Comerciais Ativas
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <th className="p-4">Código / Cliente</th>
                <th className="p-4">Escopo do Serviço</th>
                <th className="p-4">Mão de Obra (70%) / Materiais (30%)</th>
                <th className="p-4">Valor Total Final</th>
                <th className="p-4 text-center">Status / Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {quotes.map((q) => (
                <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4">
                    <span className="font-data-mono font-bold text-[#E63946]">{q.id}</span> <br />
                    <span className="font-bold text-slate-900 text-sm uppercase">{q.clientName}</span>
                  </td>
                  <td className="p-4 text-slate-600 max-w-xs">{q.description}</td>
                  <td className="p-4 font-data-mono">
                    <span className="text-slate-900 font-semibold">M.O: R$ {q.laborValue.toLocaleString('pt-BR')} (70%)</span> <br />
                    <span className="text-slate-500 text-[11px]">Mat: R$ {q.materialValue.toLocaleString('pt-BR')} (30%)</span>
                  </td>
                  <td className="p-4 font-data-mono font-bold text-slate-900">
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
                          alert(`Orçamento ${q.id} convertido em Pedido e Ordem de Serviço!`);
                        }}
                        className="bg-[#E63946] hover:bg-[#a51515] text-white text-[10px] font-semibold px-3 py-1 rounded transition-colors uppercase tracking-wider shadow-sm"
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

      {/* Modal Add Quote */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-xl border border-slate-200 p-6 shadow-2xl relative">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold">
              ✕
            </button>
            <h3 className="text-lg font-bold text-slate-900 uppercase mb-4">Novo Orçamento Técnico</h3>
            <form onSubmit={handleCreateQuote} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase">Razão Social do Cliente</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase">Escopo da Proposta</label>
                <input
                  type="text"
                  required
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase">Valor Bruto (R$)</label>
                <input
                  type="number"
                  required
                  value={totalVal}
                  onChange={(e) => setTotalVal(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 font-data-mono focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                />
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-data-mono text-xs space-y-1">
                <div><strong className="text-slate-900">Composição Automática:</strong></div>
                <div>Mão de Obra (70%): R$ {laborVal.toLocaleString('pt-BR')}</div>
                <div>Materiais (30%): R$ {materialVal.toLocaleString('pt-BR')}</div>
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase">Desconto Aplicado (%)</label>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 font-data-mono focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[#E63946] hover:bg-[#a51515] text-white py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
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
