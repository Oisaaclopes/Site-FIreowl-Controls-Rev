'use client';

import React, { useState } from 'react';
import { FinancialTransaction } from '@/lib/types';

interface FinancasViewProps {
  transactions: FinancialTransaction[];
  onAddTransaction?: (t: FinancialTransaction) => void;
}

export const FinancasView: React.FC<FinancasViewProps> = ({ transactions }) => {
  const [filter, setFilter] = useState<'TODOS' | 'RECEITA' | 'DESPESA'>('TODOS');

  const totalReceitas = transactions
    .filter((t) => t.type === 'RECEITA')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalDespesas = transactions
    .filter((t) => t.type === 'DESPESA')
    .reduce((acc, t) => acc + t.amount, 0);

  const lucroLiquido = totalReceitas - totalDespesas;
  const margemLucro = totalReceitas > 0 ? ((lucroLiquido / totalReceitas) * 100).toFixed(1) : '0.0';

  const filteredTransactions = transactions.filter((t) => {
    if (filter === 'TODOS') return true;
    return t.type === filter;
  });

  return (
    <div className="flex flex-col w-full p-8 gap-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Consolidado Financeiro &amp; DRE (Simples Nacional)
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Finanças &amp; Fluxo de Caixa Integrado
          </h1>
        </div>

        <button
          onClick={() => alert('DRE & Relatório Financeiro exportados com sucesso!')}
          className="border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 uppercase"
        >
          <span className="material-symbols-outlined text-base">file_download</span> Baixar DRE Completo
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Receita Bruta Acumulada</p>
          <h2 className="font-data-mono text-2xl font-bold text-emerald-600 mt-2">
            R$ {totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
          <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded mt-1 inline-block">
            ▲ +14.2% em relação ao mês anterior
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Despesas &amp; Custos Totais</p>
          <h2 className="font-data-mono text-2xl font-bold text-[#E63946] mt-2">
            R$ {totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
          <span className="text-[10px] text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded mt-1 inline-block">
            Insumos, Folha &amp; Impostos
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Resultado Líquido (EBITDA)</p>
          <h2 className="font-data-mono text-2xl font-bold text-slate-900 mt-2">
            R$ {lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
          <span className="text-[10px] text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded mt-1 inline-block">
            Margem Operacional: {margemLucro}%
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Caixa Disponível em Conta</p>
          <h2 className="font-data-mono text-2xl font-bold text-emerald-600 mt-2">
            R$ {(lucroLiquido + 85000).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
          <span className="text-[10px] text-slate-600 font-semibold bg-slate-100 px-2 py-0.5 rounded mt-1 inline-block">
            Banco Bradesco (Sede)
          </span>
        </div>
      </div>

      {/* DRE Breakdown Box */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-3">
          Demonstrativo do Resultado do Exercício (DRE Simplificado)
        </h3>
        <div className="space-y-3 text-xs font-data-mono">
          <div className="flex justify-between p-2 bg-slate-50 rounded">
            <span className="font-bold text-slate-900">(+) RECEITA BRUTA DE SERVIÇOS</span>
            <span className="font-bold text-emerald-700">R$ {totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between p-2 pl-6 text-slate-600">
            <span>(-) Impostos Simples Nacional Anexo III (6%)</span>
            <span className="text-red-600">- R$ {(totalReceitas * 0.06).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between p-2 bg-slate-100 rounded font-semibold text-slate-900">
            <span>(=) RECEITA LÍQUIDA</span>
            <span>R$ {(totalReceitas * 0.94).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between p-2 pl-6 text-slate-600">
            <span>(-) Custos Operacionais de Campo &amp; Materiais</span>
            <span className="text-red-600">- R$ {totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between p-3 bg-[#1A1A72] text-white rounded-lg font-bold text-sm">
            <span>(=) RESULTADO OPERACIONAL LÍQUIDO FINAL</span>
            <span className="text-emerald-300">R$ {(totalReceitas * 0.94 - totalDespesas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-[#1A1A72] px-6 py-4 text-white text-xs font-bold uppercase tracking-wider flex justify-between items-center">
          <span>Lançamentos Consolidados do Período</span>
          <div className="flex gap-2 font-normal">
            {['TODOS', 'RECEITA', 'DESPESA'].map((st) => (
              <button
                key={st}
                onClick={() => setFilter(st as any)}
                className={`px-2.5 py-1 rounded text-[11px] ${
                  filter === st ? 'bg-white text-slate-900 font-bold' : 'text-slate-300'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <th className="p-4">Cód / Ref</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Cliente / Fornecedor</th>
                <th className="p-4">Descrição do Lançamento</th>
                <th className="p-4">Data Emissão</th>
                <th className="p-4 text-right">Valor Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredTransactions.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4 font-data-mono font-bold text-slate-900">{t.id}</td>
                  <td className="p-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        t.type === 'RECEITA' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {t.type}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-slate-900 uppercase">{t.clientOrVendor}</td>
                  <td className="p-4 text-slate-600">{t.description}</td>
                  <td className="p-4 font-data-mono text-slate-500">{t.date}</td>
                  <td className={`p-4 text-right font-data-mono font-bold ${t.type === 'RECEITA' ? 'text-emerald-600' : 'text-[#E63946]'}`}>
                    {t.type === 'RECEITA' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
