'use client';

import React, { useState, useEffect } from 'react';
import { FinancialTransaction, PedidoOS, Contract, TabPath } from '@/lib/types';
import { usePrivacy } from '@/lib/privacy';

/** Máscara curta para os números dos cards (o prefixo "R$" já é exibido à parte). */
const MASK_DIGITS = '•••••••';

interface DashboardViewProps {
  transactions: FinancialTransaction[];
  pedidosOS: PedidoOS[];
  contracts: Contract[];
  onNewOSClick: () => void;
  onNavigateToTab: (tab: TabPath) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  transactions,
  pedidosOS,
  contracts,
  onNewOSClick,
  onNavigateToTab,
}) => {
  const { isPrivacyModeActive, maskMoney } = usePrivacy();

  // Indicadores reais derivados dos dados do sistema
  const receitaTotal = transactions
    .filter((t) => t.type === 'RECEITA')
    .reduce((acc, t) => acc + t.amount, 0);
  const despesaTotal = transactions
    .filter((t) => t.type === 'DESPESA')
    .reduce((acc, t) => acc + t.amount, 0);
  const contratosAtivos = contracts.filter((c) => c.status === 'ATIVO').length;
  const osAtrasadas = pedidosOS.filter((p) => p.status === 'ATRASADA').length;
  const cashMax = Math.max(receitaTotal, despesaTotal, 1);
  const cashBars = [
    { label: 'Receitas', value: receitaTotal, color: 'bg-emerald-600' },
    { label: 'Despesas', value: despesaTotal, color: 'bg-[#E63946]' },
  ];

  const [revenueValue, setRevenueValue] = useState(0);

  // Anima o contador de receita até o total real sempre que ele muda.
  useEffect(() => {
    const endValue = receitaTotal;
    const duration = 1200;
    const startValue = 0;
    const startTime = performance.now();

    const updateCounter = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.floor(progress * (endValue - startValue) + startValue);
      setRevenueValue(current);
      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      }
    };
    requestAnimationFrame(updateCounter);
  }, [receitaTotal]);

  return (
    <div className="flex flex-col w-full p-4 md:p-8 gap-5 md:gap-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Unidade Londrina/PR — Resumo Executivo
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Painel de Controle Operacional
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigateToTab('relatorios')}
            className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">fact_check</span>
            Relatórios Técnicos
          </button>
          <button
            onClick={onNewOSClick}
            className="bg-[#E63946] hover:bg-[#a51515] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 uppercase tracking-wide"
          >
            <span className="material-symbols-outlined text-base">add</span> Nova Ordem
          </button>
        </div>
      </div>

      {/* Indicator Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card: Receita */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="flex justify-between items-start">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Receita Mensal
            </p>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">trending_up</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-sm font-medium text-slate-500">R$</span>
            <span className="font-data-mono text-3xl font-bold text-slate-900 tabular-nums">
              {isPrivacyModeActive ? MASK_DIGITS : revenueValue.toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-slate-500">
            <span className="material-symbols-outlined text-sm">receipt_long</span>
            <span>{transactions.filter((t) => t.type === 'RECEITA').length} lançamento(s) de receita</span>
          </div>
        </div>

        {/* Card: Despesas */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="flex justify-between items-start">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Despesas Totais
            </p>
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">payments</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-sm font-medium text-slate-500">R$</span>
            <span className="font-data-mono text-3xl font-bold text-slate-900 tabular-nums">
              {isPrivacyModeActive ? MASK_DIGITS : despesaTotal.toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-slate-500">
            <span className="material-symbols-outlined text-sm">receipt_long</span>
            <span>{transactions.filter((t) => t.type === 'DESPESA').length} lançamento(s) de despesa</span>
          </div>
        </div>

        {/* Card: Contratos Ativos */}
        <div
          onClick={() => onNavigateToTab('contratos')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-slate-300 cursor-pointer transition-all"
        >
          <div className="flex justify-between items-start">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Contratos Ativos
            </p>
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">description</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="font-data-mono text-3xl font-bold text-slate-900 tabular-nums">
              {contratosAtivos.toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="material-symbols-outlined text-sm text-[#1A1A72]">verified</span>
            <span>{contracts.length} contratos no total</span>
          </div>
        </div>

        {/* Card: OS Atrasadas (Critical) */}
        <div
          onClick={() => onNavigateToTab('pedidos')}
          className="bg-red-50/60 p-5 rounded-xl border border-red-200 shadow-sm relative overflow-hidden group cursor-pointer hover:bg-red-100/50 transition-all"
        >
          <div className="flex justify-between items-start">
            <p className="text-xs font-bold text-[#E63946] uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">warning</span> OS Atrasadas
            </p>
            <div className="w-10 h-10 rounded-lg bg-red-100 text-[#E63946] flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">error</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="font-data-mono text-3xl font-bold text-[#E63946] tabular-nums">
              {osAtrasadas}
            </span>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#E63946] group-hover:underline">
            <span>Intervenção técnica pendente →</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left: Revenue vs Expense Bar Chart */}
        <div className="col-span-12 lg:col-span-8 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide">
                Fluxo de Caixa Mensal
              </h3>
              <p className="text-xs text-slate-500">
                Comparativo dos lançamentos financeiros carregados no sistema
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-emerald-600"></div>
                <span className="text-xs font-medium text-slate-600">Receita</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-[#E63946]"></div>
                <span className="text-xs font-medium text-slate-600">Despesa</span>
              </div>
            </div>
          </div>

          <div className="relative h-64 w-full flex items-end justify-center gap-12 pt-8">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40">
              <div className="border-t border-slate-200 w-full"></div>
              <div className="border-t border-slate-200 w-full"></div>
              <div className="border-t border-slate-200 w-full"></div>
              <div className="border-t border-dashed border-slate-200 w-full"></div>
            </div>

            {transactions.length === 0 ? <p className="relative z-10 self-center text-xs text-slate-400">Nenhum lançamento financeiro para comparar.</p> : cashBars.map((bar) => (
              <div key={bar.label} className="w-28 flex flex-col justify-end gap-1.5 group relative z-10">
                <div
                  className={`w-full ${bar.color} transition-all rounded-t-md shadow-sm`}
                  style={{ height: `${Math.max(4, Math.round((bar.value / cashMax) * 100))}%` }}
                  title={`${bar.label}: ${maskMoney(`R$ ${bar.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)}`}
                />
                <span className="text-center font-data-mono text-[10px] text-slate-600">{maskMoney(`R$ ${bar.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)}</span>
                <span className="text-center font-data-mono text-xs text-slate-500 mt-2 font-medium">
                  {bar.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Technical Highlight Card & Team Status */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          {/* Anomalias Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div>
              <span className="text-[10px] font-bold text-[#E63946] bg-red-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Módulo de Inteligência Técnica
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-3 tracking-tight leading-snug uppercase">
                Identificação de Anomalias no CRM
              </h2>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Acompanhe pendências, manutenções atrasadas e anomalias detectadas nos relatórios de campo.
              </p>
            </div>

            <button
              onClick={() => onNavigateToTab('relatorios')}
              className="mt-6 w-full py-2.5 bg-[#E63946] hover:bg-[#a51515] text-white rounded-lg font-semibold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-md"
            >
              <span>Ver pendências / anomalias</span>
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </div>

          {/* Manutenção de campo — sem dados simulados: estado vazio real até
              existir atribuição de equipe/localização de verdade. */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Manutenção de Campo em Tempo Real
            </h4>
            <button
              onClick={() => onNavigateToTab('agenda')}
              className="flex-1 min-h-[96px] rounded-lg border border-dashed border-slate-200 text-slate-400 hover:border-[#1A1A72] hover:text-[#1A1A72] transition-colors flex flex-col items-center justify-center gap-1 text-center px-3"
            >
              <span className="material-symbols-outlined text-2xl">groups_off</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide">Nenhuma equipe em atendimento</span>
              <span className="text-[10px]">Abrir a Agenda de despacho</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom: Recent Transactions Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-[#1A1A72] px-6 py-4 flex justify-between items-center text-white">
          <h3 className="text-xs font-bold uppercase tracking-wider">
            Últimos Lançamentos Financeiros &amp; Contratos
          </h3>
          <button
            onClick={() => onNavigateToTab('financas')}
            className="text-xs text-slate-300 hover:text-white underline font-medium"
          >
            Ver Histórico Completo
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-6">ID Operação</th>
                <th className="py-3 px-6">Cliente / Serviço</th>
                <th className="py-3 px-6">Data Emissão</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6 text-right">Valor Líquido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-6 font-data-mono font-bold text-slate-500">{t.id}</td>
                  <td className="py-3.5 px-6">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 uppercase">{t.clientOrVendor}</span>
                      <span className="text-[11px] text-slate-500">{t.description}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-6 font-data-mono text-slate-500">{t.date}</td>
                  <td className="py-3.5 px-6">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        t.status === 'CONFIRMADO'
                          ? 'bg-emerald-100 text-emerald-800'
                          : t.status === 'PENDENTE'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-6 text-right font-data-mono font-bold text-slate-900">
                    {maskMoney(`R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)}
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
