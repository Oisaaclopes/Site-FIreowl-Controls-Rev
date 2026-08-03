'use client';

import React, { useState } from 'react';
import { FinancialTransaction, Supplier } from '@/lib/types';

interface DespesasViewProps {
  transactions: FinancialTransaction[];
  suppliers: Supplier[];
  onAddTransaction: (t: FinancialTransaction) => void;
}

let despSeq = 500;

export const DespesasView: React.FC<DespesasViewProps> = ({
  transactions,
  suppliers,
  onAddTransaction,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Form State
  const [clientOrVendor, setClientOrVendor] = useState(suppliers[0]?.name || 'Bosch Security Systems Brasil');
  const [description, setDescription] = useState('Aquisição de Lote de Detectores Ópticos');
  const [amount, setAmount] = useState(12800);

  const despesas = transactions.filter((t) => t.type === 'DESPESA');
  const filteredDespesas = despesas.filter((t) => {
    if (filterStatus === 'ALL') return true;
    return t.status === filterStatus;
  });

  const totalConfirmed = despesas
    .filter((t) => t.status === 'CONFIRMADO')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalPending = despesas
    .filter((t) => t.status === 'PENDENTE')
    .reduce((acc, t) => acc + t.amount, 0);

  const handleCreateDespesa = (e: React.FormEvent) => {
    e.preventDefault();
    const seq = (despSeq++).toString();
    const newTx: FinancialTransaction = {
      id: `#FOWL-DESP-${seq}`,
      type: 'DESPESA',
      clientOrVendor,
      description,
      date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(),
      status: 'CONFIRMADO',
      amount: Number(amount),
    };
    onAddTransaction(newTx);
    setShowModal(false);
  };

  return (
    <div className="flex flex-col w-full p-8 gap-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Gestão Financeira — Saídas, Insumos &amp; Custos
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Despesas &amp; Pagamentos a Fornecedores
          </h1>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-[#E63946] hover:bg-[#a51515] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 uppercase"
        >
          <span className="material-symbols-outlined text-base">add</span> Nova Despesa
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Despesas Pagas</p>
          <h2 className="font-data-mono text-3xl font-bold text-[#E63946] mt-2">
            R$ {totalConfirmed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">A Pagar / Agendado</p>
          <h2 className="font-data-mono text-3xl font-bold text-amber-600 mt-2">
            R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
        </div>

        <div className="bg-[#0f172a] text-white p-5 rounded-xl border border-slate-800 shadow-md">
          <p className="text-xs font-semibold text-slate-400 uppercase">Total de Custos Acumulados</p>
          <h2 className="font-data-mono text-3xl font-bold text-red-400 mt-2">
            R$ {(totalConfirmed + totalPending).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 text-white text-xs font-bold uppercase tracking-wider flex justify-between items-center">
          <span>Lançamentos de Despesa e Fornecedores</span>
          <div className="flex gap-2">
            {['ALL', 'CONFIRMADO', 'PENDENTE'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-2.5 py-1 rounded text-[11px] ${
                  filterStatus === st ? 'bg-white text-slate-900 font-bold' : 'text-slate-300'
                }`}
              >
                {st === 'ALL' ? 'Todas' : st}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <th className="p-4">Cód. Transação</th>
                <th className="p-4">Fornecedor / Favorecido</th>
                <th className="p-4">Descrição do Custo</th>
                <th className="p-4">Data Emissão</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Valor Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredDespesas.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4 font-data-mono font-bold text-[#E63946]">{t.id}</td>
                  <td className="p-4 font-bold uppercase text-slate-900">{t.clientOrVendor}</td>
                  <td className="p-4 text-slate-600">{t.description}</td>
                  <td className="p-4 font-data-mono text-slate-500">{t.date}</td>
                  <td className="p-4 text-center">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        t.status === 'CONFIRMADO'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="p-4 text-right font-data-mono font-bold text-[#E63946]">
                    R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add Despesa */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-xl border border-slate-200 p-6 shadow-2xl relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold"
            >
              ✕
            </button>
            <h3 className="text-lg font-bold text-slate-900 uppercase mb-4">Lançar Nova Despesa</h3>
            <form onSubmit={handleCreateDespesa} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase">Fornecedor / Beneficiário</label>
                <select
                  value={clientOrVendor}
                  onChange={(e) => setClientOrVendor(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                  <option value="Outros Fornecedores">Outros Fornecedores</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase">Descrição do Custo</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase">Valor da Despesa (R$)</label>
                <input
                  type="number"
                  required
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 font-data-mono focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#E63946] hover:bg-[#a51515] text-white py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
              >
                Confirmar Lançamento de Despesa
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
