'use client';
import { showToast } from '@/components/ui/Feedback';

import React, { useState } from 'react';
import { FinancialTransaction } from '@/lib/types';

interface FinanceiroViewProps {
  transactions: FinancialTransaction[];
}

export const FinanceiroView: React.FC<FinanceiroViewProps> = ({ transactions }) => {
  const [filterType, setFilterType] = useState<'ALL' | 'RECEITA' | 'DESPESA'>('ALL');

  const filteredTransactions = transactions.filter((t) => {
    if (filterType === 'ALL') return true;
    return t.type === filterType;
  });

  const receitasTotal = transactions
    .filter((t) => t.type === 'RECEITA')
    .reduce((acc, t) => acc + t.amount, 0);

  const despesasTotal = transactions
    .filter((t) => t.type === 'DESPESA')
    .reduce((acc, t) => acc + t.amount, 0);

  const resultadoLiquido = receitasTotal - despesasTotal;

  return (
    <div className="flex flex-col w-full p-4 md:p-8 gap-5 md:gap-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-border pb-5">
        <div>
          <span className="text-xs font-semibold text-fg-secondary uppercase tracking-wider">
            Gestão Financeira &amp; DRE (Simples Nacional)
          </span>
          <h1 className="text-2xl font-bold text-fg tracking-tight mt-0.5">
            DRE Simplificado &amp; Fluxo de Caixa
          </h1>
        </div>

        <button
          onClick={() => showToast('DRE exportado em Excel/PDF com sucesso!')}
          className="border border-border hover:bg-surface-2 text-fg-secondary font-semibold text-xs px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 uppercase"
        >
          <span className="material-symbols-outlined text-base">download</span> Exportar DRE
        </button>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs font-semibold text-fg-secondary uppercase">Receitas Totais</p>
          <h2 className="font-data-mono text-3xl font-bold text-emerald-600 mt-2">
            R$ {receitasTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
        </div>
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs font-semibold text-fg-secondary uppercase">Despesas Totais</p>
          <h2 className="font-data-mono text-3xl font-bold text-danger mt-2">
            R$ {despesasTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
        </div>
        <div className="bg-[#0f172a] text-white p-5 rounded-xl border border-slate-800 shadow-md">
          <p className="text-xs font-semibold text-fg-muted uppercase">Resultado Líquido</p>
          <h2 className="font-data-mono text-3xl font-bold text-emerald-400 mt-2">
            R$ {resultadoLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
        </div>
      </div>

      {/* Financial Table */}
      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 text-white text-xs font-bold uppercase tracking-wider flex justify-between items-center">
          <span>Demonstrativo de Lançamentos de Receita e Custo</span>
          <div className="flex gap-2 font-normal">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-2.5 py-1 rounded text-[11px] ${filterType === 'ALL' ? 'bg-surface text-fg font-bold' : 'text-fg-muted'}`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterType('RECEITA')}
              className={`px-2.5 py-1 rounded text-[11px] ${filterType === 'RECEITA' ? 'bg-emerald-500 text-white font-bold' : 'text-fg-muted'}`}
            >
              Receitas
            </button>
            <button
              onClick={() => setFilterType('DESPESA')}
              className={`px-2.5 py-1 rounded text-[11px] ${filterType === 'DESPESA' ? 'bg-red-500 text-white font-bold' : 'text-fg-muted'}`}
            >
              Despesas
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-2 text-fg-secondary font-semibold uppercase tracking-wider border-b border-border">
                <th className="p-4">Ref / Operação</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Cliente / Fornecedor</th>
                <th className="p-4">Data Emissão</th>
                <th className="p-4 text-right">Valor Bruto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-medium text-fg-secondary">
              {filteredTransactions.map((t) => (
                <tr key={t.id} className="hover:bg-surface-2/80 transition-colors">
                  <td className="p-4 font-data-mono font-bold text-fg">{t.id}</td>
                  <td className="p-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        t.type === 'RECEITA' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {t.type}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="font-bold uppercase text-fg">{t.clientOrVendor}</span> <br />
                    <span className="text-[11px] text-fg-secondary">{t.description}</span>
                  </td>
                  <td className="p-4 font-data-mono text-fg-secondary">{t.date}</td>
                  <td className="p-4 text-right font-data-mono font-bold text-fg">
                    R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
