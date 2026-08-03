'use client';

import React, { useState } from 'react';
import { Contract } from '@/lib/types';

interface ContratosViewProps {
  contracts: Contract[];
  onAddContract: (contract: Contract) => void;
}

export const ContratosView: React.FC<ContratosViewProps> = ({
  contracts,
  onAddContract,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [selectedPdfContract, setSelectedPdfContract] = useState<Contract | null>(null);
  const [clientName, setClientName] = useState('');
  const [monthlyVal, setMonthlyVal] = useState(15000);

  const handleCreateContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName) return;

    const timestamp = Date.now().toString().slice(-4);
    onAddContract({
      id: `CTR-FOWL-${timestamp.slice(-3)}`,
      clientName,
      unit: 'Unidade Londrina',
      monthlyValue: Number(monthlyVal),
      renewalDate: '30 DEZ 2026',
      readjustmentIndex: 'IPCA (+4.5%)',
      contractedHours: 100,
      usedHours: 12,
      status: 'ATIVO',
      responsibleTech: 'Eng. Ricardo M.',
      artDocumentRef: `ART-PR-2024-${timestamp}`
    });

    setShowModal(false);
    setClientName('');
  };

  const totalMonthlyRec = contracts.reduce((acc, c) => acc + c.monthlyValue, 0);

  return (
    <div className="flex flex-col w-full p-8 gap-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Módulo de Receita Recorrente (MRR)
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Gestão de Contratos de Manutenção
          </h1>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-[#ba1a1a] hover:bg-[#a51515] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 uppercase tracking-wide"
        >
          <span className="material-symbols-outlined text-base">add</span> Novo Contrato
        </button>
      </div>

      {/* Contract Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Receita Mensal Recorrente (MRR)</p>
          <h2 className="font-data-mono text-3xl font-bold text-slate-900 mt-2">
            R$ {totalMonthlyRec.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Contratos Vigentes</p>
          <h2 className="font-data-mono text-3xl font-bold text-emerald-600 mt-2">{contracts.length}</h2>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Índice de Reajuste Anual</p>
          <h2 className="font-data-mono text-3xl font-bold text-[#ba1a1a] mt-2">IPCA (+4.8%)</h2>
        </div>
      </div>

      {/* Contracts Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 text-white text-xs font-bold uppercase tracking-wider flex justify-between items-center">
          <span>Contratos Continuados Vigentes — Londrina &amp; Região</span>
          <span className="font-data-mono text-slate-400 font-normal">REF: CTR_SYS_2024</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <th className="p-4">Ref Contrato / Cliente</th>
                <th className="p-4">Valor Mensal</th>
                <th className="p-4">Renovação / Reajuste</th>
                <th className="p-4">Bolsa de Horas</th>
                <th className="p-4">Responsável / ART</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {contracts.map((ctr) => (
                <tr key={ctr.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4">
                    <span className="font-data-mono font-bold text-[#ba1a1a]">{ctr.id}</span> <br />
                    <span className="font-bold text-slate-900 text-sm uppercase">{ctr.clientName}</span>
                    <p className="text-[11px] text-slate-500">{ctr.unit}</p>
                  </td>
                  <td className="p-4 font-data-mono font-bold text-slate-900">
                    R$ {ctr.monthlyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-4">
                    <span className="font-data-mono text-slate-700">{ctr.renewalDate}</span> <br />
                    <span className="text-[11px] text-emerald-700 font-bold">{ctr.readjustmentIndex}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1 w-32">
                      <span className="text-[11px] font-data-mono text-slate-600">
                        {ctr.usedHours}h / {ctr.contractedHours}h
                      </span>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="bg-slate-800 h-full rounded-full"
                          style={{ width: `${(ctr.usedHours / ctr.contractedHours) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="font-semibold text-slate-900">{ctr.responsibleTech}</span> <br />
                    <span className="font-data-mono text-[10px] text-slate-400">{ctr.artDocumentRef}</span>
                  </td>
                  <td className="p-4 text-center">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        ctr.status === 'ATIVO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {ctr.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => setSelectedPdfContract(ctr)}
                      className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors text-slate-700 font-semibold text-xs inline-flex items-center gap-1"
                      title="Imprimir Resumo do Contrato"
                    >
                      <span className="material-symbols-outlined text-base">print</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add Contract */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-xl border border-slate-200 p-6 shadow-2xl relative">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold">
              ✕
            </button>
            <h3 className="text-lg font-bold text-slate-900 uppercase mb-4">Novo Contrato Recorrente</h3>
            <form onSubmit={handleCreateContract} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase">Razão Social do Cliente</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#ba1a1a]/20"
                  placeholder="Ex: Londrina Norte Shopping"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase">Valor Mensal Recorrente (R$)</label>
                <input
                  type="number"
                  required
                  value={monthlyVal}
                  onChange={(e) => setMonthlyVal(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 font-data-mono focus:outline-none focus:ring-2 focus:ring-[#ba1a1a]/20"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[#ba1a1a] hover:bg-[#a51515] text-white py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
              >
                Salvar e Ativar Contrato
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal PDF Preview */}
      {selectedPdfContract && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-xl border border-slate-200 p-6 shadow-2xl relative">
            <button onClick={() => setSelectedPdfContract(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold">
              ✕
            </button>
            <div className="border-b border-slate-200 pb-3 mb-4">
              <span className="font-data-mono text-xs text-[#ba1a1a] font-bold">{selectedPdfContract.id}</span>
              <h3 className="text-xl font-bold text-slate-900 uppercase">{selectedPdfContract.clientName}</h3>
              <p className="text-xs text-slate-500">Contrato de Manutenção de Sistemas SDAI &amp; Hidráulicos</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg space-y-2 text-xs font-data-mono border border-slate-200 mb-6">
              <div><strong>Valor Mensal:</strong> R$ {selectedPdfContract.monthlyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div><strong>Renovação Automática:</strong> {selectedPdfContract.renewalDate}</div>
              <div><strong>Reajuste Aplicável:</strong> {selectedPdfContract.readjustmentIndex}</div>
              <div><strong>Bolsa de Horas de Campo:</strong> {selectedPdfContract.usedHours}h / {selectedPdfContract.contractedHours}h</div>
              <div><strong>Responsável Técnico:</strong> {selectedPdfContract.responsibleTech}</div>
              <div><strong>Registro ART CREA:</strong> {selectedPdfContract.artDocumentRef}</div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  window.print();
                  setSelectedPdfContract(null);
                }}
                className="bg-[#ba1a1a] hover:bg-[#a51515] text-white font-semibold px-5 py-2 rounded-lg text-xs uppercase"
              >
                Imprimir Documento
              </button>
              <button
                onClick={() => setSelectedPdfContract(null)}
                className="px-4 border border-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
