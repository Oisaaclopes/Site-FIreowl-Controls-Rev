'use client';

import React, { useState, useEffect } from 'react';
import { FinancialTransaction, PedidoOS } from '@/lib/types';
import { usePrivacy } from '@/lib/privacy';

/** Máscara curta para os números dos cards (o prefixo "R$" já é exibido à parte). */
const MASK_DIGITS = '•••••••';

interface DashboardViewProps {
  transactions: FinancialTransaction[];
  pedidosOS: PedidoOS[];
  onNewOSClick: () => void;
  onNavigateToTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  transactions,
  pedidosOS,
  onNewOSClick,
  onNavigateToTab,
}) => {
  const { isPrivacyModeActive, maskMoney } = usePrivacy();
  const [revenueValue, setRevenueValue] = useState(428000);

  useEffect(() => {
    const endValue = 428940;
    const duration = 1500;
    const startTime = performance.now();

    const updateCounter = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.floor(progress * (endValue - 428000) + 428000);
      setRevenueValue(current);
      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      }
    };
    requestAnimationFrame(updateCounter);
  }, []);

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
            onClick={() => onNavigateToTab('tecnico')}
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
          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-emerald-600">
            <span className="material-symbols-outlined text-sm">arrow_upward</span>
            <span>+12.4% vs mês anterior</span>
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
              {isPrivacyModeActive ? MASK_DIGITS : '184.212'}
            </span>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#E63946]">
            <span className="material-symbols-outlined text-sm">arrow_downward</span>
            <span>-2.1% otimização de custo</span>
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
              1.248
            </span>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="bg-[#1A1A72] h-full w-[85%] rounded-full"></div>
            </div>
            <span className="font-data-mono text-xs text-slate-500 font-semibold">85% META</span>
          </div>
        </div>

        {/* Card: OS Atrasadas (Critical) */}
        <div
          onClick={() => onNavigateToTab('crm')}
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
              24
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
                Comparação semanal de receitas e despesas operacionais (Maio/2024)
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

          {/* SVG Bar Chart */}
          <div className="relative h-64 w-full flex items-end justify-between gap-6 pt-8">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40">
              <div className="border-t border-slate-200 w-full"></div>
              <div className="border-t border-slate-200 w-full"></div>
              <div className="border-t border-slate-200 w-full"></div>
              <div className="border-t border-dashed border-slate-200 w-full"></div>
            </div>

            {/* Chart Bars (S01 to S05) */}
            {[
              { week: 'Semana 1', rec: '70%', desp: '30%' },
              { week: 'Semana 2', rec: '85%', desp: '40%' },
              { week: 'Semana 3', rec: '60%', desp: '55%' },
              { week: 'Semana 4', rec: '95%', desp: '25%' },
              { week: 'Semana 5', rec: '75%', desp: '45%' },
            ].map((bar, idx) => (
              <div key={idx} className="flex-1 flex flex-col justify-end gap-1.5 group relative z-10">
                <div
                  className="w-full bg-emerald-600 hover:bg-emerald-500 transition-all rounded-t-md shadow-sm"
                  style={{ height: bar.rec }}
                  title={`Receita ${bar.week}: ${maskMoney(`R$ ${(parseInt(bar.rec) * 1200).toLocaleString()}`)}`}
                ></div>
                <div
                  className="w-full bg-[#E63946] hover:bg-[#a51515] transition-all rounded-t-md shadow-sm"
                  style={{ height: bar.desp }}
                  title={`Despesa ${bar.week}: ${maskMoney(`R$ ${(parseInt(bar.desp) * 1000).toLocaleString()}`)}`}
                ></div>
                <span className="text-center font-data-mono text-xs text-slate-500 mt-2 font-medium">
                  {bar.week}
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
                14 clientes apresentaram inconsistências preventivas ou manutenções atrasadas neste trimestre.
              </p>
            </div>

            <button
              onClick={() => onNavigateToTab('auditoria')}
              className="mt-6 w-full py-2.5 bg-[#E63946] hover:bg-[#a51515] text-white rounded-lg font-semibold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-md"
            >
              <span>Executar Auditoria NBR 17240</span>
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </div>

          {/* Field Maintenance Status */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Manutenção de Campo em Tempo Real
            </h4>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between bg-amber-50/70 p-3 rounded-lg border border-amber-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                  <span className="text-xs font-bold text-slate-900">Equipe Alfa (Catuaí)</span>
                </div>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full uppercase">EM ROTA</span>
              </div>
              <div className="flex items-center justify-between bg-emerald-50/70 p-3 rounded-lg border border-emerald-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                  <span className="text-xs font-bold text-slate-900">Equipe Beta (Norte Shop)</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full uppercase">EM ATENDIMENTO</span>
              </div>
            </div>
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
            onClick={() => onNavigateToTab('financeiro')}
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
