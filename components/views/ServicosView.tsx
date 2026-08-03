'use client';

import React, { useState } from 'react';
import { ServiceCatalogItem, Client, CustomQuote } from '@/lib/types';

interface ServicosViewProps {
  services: ServiceCatalogItem[];
  clients: Client[];
  quotes: CustomQuote[];
  onAddQuote: (q: CustomQuote) => void;
  onSelectClientForReport?: (clientName: string) => void;
}

let servSeq = 20;

export const ServicosView: React.FC<ServicosViewProps> = ({
  services,
  clients,
  quotes,
  onAddQuote,
  onSelectClientForReport,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'catalogo' | 'orcamentos' | 'rdo_laudo'>('catalogo');
  const [showModal, setShowModal] = useState(false);

  // Quote form state
  const [clientName, setClientName] = useState(clients[0]?.name || 'Catuaí Shopping Londrina');
  const [title, setTitle] = useState('Proposta de Retrofit & Substituição de 45 Detectores SDAI');
  const [value, setValue] = useState(14500);

  const handleCreateQuote = (e: React.FormEvent) => {
    e.preventDefault();
    const seq = (servSeq++).toString();
    const val = Number(value);
    const created: CustomQuote = {
      id: `ORC-2024-${seq}`,
      clientName,
      description: title,
      laborValue: Math.round(val * 0.7),
      materialValue: Math.round(val * 0.3),
      totalValue: val,
      discountApplied: 0,
      finalValue: val,
      validityDays: 15,
      status: 'ENVIADO',
      createdAt: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(),
    };
    onAddQuote(created);
    setShowModal(false);
  };

  return (
    <div className="flex flex-col w-full p-8 gap-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Engenharia de Incêndio &amp; Operações de Campo SDAI
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Gestão de Serviços &amp; Tabela de Preços Normativos
          </h1>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveSubTab('orcamentos')}
            className="bg-[#ba1a1a] hover:bg-[#a51515] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 uppercase tracking-wide"
          >
            <span className="material-symbols-outlined text-base">request_quote</span> Novo Orçamento
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveSubTab('catalogo')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeSubTab === 'catalogo'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span className="material-symbols-outlined text-base">construction</span>
          Catálogo &amp; Preços Normativos
        </button>

        <button
          onClick={() => setActiveSubTab('orcamentos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeSubTab === 'orcamentos'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span className="material-symbols-outlined text-base">request_quote</span>
          Orçamentos &amp; Propostas
        </button>

        <button
          onClick={() => setActiveSubTab('rdo_laudo')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeSubTab === 'rdo_laudo'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span className="material-symbols-outlined text-base">fact_check</span>
          Relatórios &amp; Auditoria NBR 17240
        </button>
      </div>

      {/* Subtab 1: Catálogo & Preços */}
      {activeSubTab === 'catalogo' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {services.map((s) => (
            <div key={s.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start">
                  <span className="font-data-mono text-xs font-bold text-[#ba1a1a]">{s.code}</span>
                  <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full uppercase">
                    {s.nbrNormRef}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 uppercase mt-2">{s.title}</h3>
                <p className="text-xs text-slate-500 mt-1">Categoria: {s.category}</p>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center font-data-mono">
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase">Horas Estimadas</span>
                  <span className="text-slate-900 font-bold text-xs">{s.estimatedHours} horas técnicas</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] block uppercase">Valor Padrão</span>
                  <span className="text-[#ba1a1a] font-bold text-base">
                    R$ {s.standardValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Subtab 2: Orçamentos */}
      {activeSubTab === 'orcamentos' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-900 px-6 py-4 text-white text-xs font-bold uppercase tracking-wider flex justify-between items-center">
            <span>Orçamentos &amp; Propostas Técnicas Registradas</span>
            <button
              onClick={() => setShowModal(true)}
              className="bg-[#ba1a1a] hover:bg-[#a51515] text-white px-3 py-1 rounded text-xs uppercase"
            >
              + Novo Orçamento
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                  <th className="p-4">Cód. Orçamento</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Proposta / Escopo</th>
                  <th className="p-4">Data Emissão</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Valor Proposto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {quotes.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/80">
                    <td className="p-4 font-data-mono font-bold text-[#ba1a1a]">{q.id}</td>
                    <td className="p-4 font-bold uppercase text-slate-900">{q.clientName}</td>
                    <td className="p-4 text-slate-600">{q.description}</td>
                    <td className="p-4 font-data-mono text-slate-500">{q.createdAt}</td>
                    <td className="p-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          q.status === 'APROVADO'
                            ? 'bg-emerald-100 text-emerald-800'
                            : q.status === 'ENVIADO'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {q.status}
                      </span>
                    </td>
                    <td className="p-4 text-right font-data-mono font-bold text-slate-900">
                      R$ {q.finalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab 3: Relatórios & Auditoria NBR 17240 */}
      {activeSubTab === 'rdo_laudo' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 uppercase">
                Auditoria de Laço &amp; Emissão de Relatório SDAI
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Seleção de Unidade para Laudo com Conformidade NBR 17240 e Assinatura com ART CREA-PR.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clients.map((c) => (
              <div key={c.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50 flex justify-between items-center">
                <div>
                  <span className="font-data-mono text-xs font-bold text-[#ba1a1a]">{c.code}</span>
                  <h4 className="font-bold text-slate-900 uppercase text-sm">{c.name}</h4>
                  <p className="text-xs text-slate-500">{c.address}</p>
                </div>
                <button
                  onClick={() => {
                    if (onSelectClientForReport) onSelectClientForReport(c.name);
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-3.5 py-2 rounded-lg transition-colors uppercase"
                >
                  Abrir Auditoria
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Add Quote */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-xl border border-slate-200 p-6 shadow-2xl relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold"
            >
              ✕
            </button>
            <h3 className="text-lg font-bold text-slate-900 uppercase mb-4">Gerar Novo Orçamento</h3>
            <form onSubmit={handleCreateQuote} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase">Cliente Destinatário</label>
                <select
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#ba1a1a]/20"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase">Título da Proposta / Escopo</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#ba1a1a]/20"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase">Valor da Proposta (R$)</label>
                <input
                  type="number"
                  required
                  value={value}
                  onChange={(e) => setValue(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 font-data-mono focus:outline-none focus:ring-2 focus:ring-[#ba1a1a]/20"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#ba1a1a] hover:bg-[#a51515] text-white py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
              >
                Emitir Orçamento
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
