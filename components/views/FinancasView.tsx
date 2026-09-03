'use client';
import { showToast } from '@/components/ui/Feedback';

import React, { useState } from 'react';
import { FinancialTransaction } from '@/lib/types';
import { usePrivacy } from '@/lib/privacy';

interface FinancasViewProps {
  transactions: FinancialTransaction[];
  onAddTransaction?: (t: FinancialTransaction) => void;
}

const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export const FinancasView: React.FC<FinancasViewProps> = ({ transactions }) => {
  const { maskMoney } = usePrivacy();
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

  // Exporta o DRE + lançamentos numa janela nova (imprimir → salvar como PDF).
  const exportDRE = () => {
    const esc = (s: unknown) =>
      String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    const impostos = totalReceitas * 0.06;
    const receitaLiquida = totalReceitas * 0.94;
    const resultado = receitaLiquida - totalDespesas;
    const hoje = new Date().toLocaleDateString('pt-BR');

    const linhas = transactions
      .map(
        (t) => `<tr>
          <td style="padding:5px 8px;border:1px solid #ddd;font-family:monospace">${esc(t.id)}</td>
          <td style="padding:5px 8px;border:1px solid #ddd">${esc(t.type)}</td>
          <td style="padding:5px 8px;border:1px solid #ddd">${esc(t.clientOrVendor)}</td>
          <td style="padding:5px 8px;border:1px solid #ddd">${esc(t.description)}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;font-family:monospace">${esc(t.date)}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:right;font-family:monospace;color:${t.type === 'RECEITA' ? '#059669' : '#E63946'}">${t.type === 'RECEITA' ? '+' : '-'} ${brl(t.amount)}</td>
        </tr>`
      )
      .join('');

    const dreRow = (label: string, valor: string, bold = false, color = '#0f172a') =>
      `<tr>
        <td style="padding:6px 8px;${bold ? 'font-weight:bold;' : ''}">${esc(label)}</td>
        <td style="padding:6px 8px;text-align:right;font-family:monospace;${bold ? 'font-weight:bold;' : ''}color:${color}">${valor}</td>
      </tr>`;

    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
      <title>DRE — Fireowl Controls</title></head>
      <body style="font-family:Arial,sans-serif;color:#0f172a;padding:24px;max-width:900px;margin:0 auto">
        <h2 style="margin:0 0 4px">Demonstrativo do Resultado do Exercício (DRE Simplificado)</h2>
        <p style="margin:0 0 2px;font-size:13px">Fireowl Controls — Simples Nacional · Emitido em ${hoje}</p>
        <p style="margin:0 0 16px;font-size:13px">Margem operacional: <strong>${margemLucro}%</strong></p>

        <table style="border-collapse:collapse;width:100%;font-size:13px;margin-bottom:24px">
          ${dreRow('(+) Receita bruta de serviços', brl(totalReceitas), true, '#059669')}
          ${dreRow('(-) Impostos Simples Nacional Anexo III (6%)', '- ' + brl(impostos), false, '#E63946')}
          ${dreRow('(=) Receita líquida', brl(receitaLiquida), true)}
          ${dreRow('(-) Custos operacionais de campo & materiais', '- ' + brl(totalDespesas), false, '#E63946')}
          ${dreRow('(=) Resultado operacional líquido final', brl(resultado), true, resultado >= 0 ? '#059669' : '#E63946')}
        </table>

        <h3 style="margin:0 0 8px;font-size:14px">Lançamentos consolidados (${transactions.length})</h3>
        <table style="border-collapse:collapse;width:100%;font-size:12px">
          <thead><tr>${['Cód', 'Tipo', 'Cliente/Fornecedor', 'Descrição', 'Data', 'Valor']
            .map((h) => `<th style="padding:6px 8px;border:1px solid #ddd;background:#1A1A72;color:#fff;text-align:left">${h}</th>`)
            .join('')}</tr></thead>
          <tbody>${linhas || `<tr><td colspan="6" style="padding:16px;text-align:center;color:#888">Sem lançamentos</td></tr>`}</tbody>
        </table>
      </body></html>`;

    const w = window.open('', '_blank');
    if (!w) {
      showToast('Permita pop-ups para gerar o DRE.');
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div className="flex flex-col w-full p-4 md:p-8 gap-5 md:gap-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-border pb-5">
        <div>
          <span className="text-xs font-semibold text-fg-secondary uppercase tracking-wider">
            Consolidado Financeiro &amp; DRE (Simples Nacional)
          </span>
          <h1 className="text-2xl font-bold text-fg tracking-tight mt-0.5">
            Finanças &amp; Fluxo de Caixa Integrado
          </h1>
        </div>

        <button
          onClick={exportDRE}
          className="border border-border hover:bg-surface-2 text-fg-secondary font-semibold text-xs px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 uppercase"
        >
          <span className="material-symbols-outlined text-base">file_download</span> Baixar DRE Completo
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs font-semibold text-fg-secondary uppercase">Receita Bruta Acumulada</p>
          <h2 className="font-data-mono text-2xl font-bold text-emerald-600 mt-2">
            {maskMoney(brl(totalReceitas))}
          </h2>
          <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded mt-1 inline-block">
            ▲ +14.2% em relação ao mês anterior
          </span>
        </div>

        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs font-semibold text-fg-secondary uppercase">Despesas &amp; Custos Totais</p>
          <h2 className="font-data-mono text-2xl font-bold text-danger mt-2">
            {maskMoney(brl(totalDespesas))}
          </h2>
          <span className="text-[10px] text-fg-secondary font-semibold bg-surface-3 px-2 py-0.5 rounded mt-1 inline-block">
            Insumos, Folha &amp; Impostos
          </span>
        </div>

        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs font-semibold text-fg-secondary uppercase">Resultado Líquido (EBITDA)</p>
          <h2 className="font-data-mono text-2xl font-bold text-fg mt-2">
            {maskMoney(brl(lucroLiquido))}
          </h2>
          <span className="text-[10px] text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded mt-1 inline-block">
            Margem Operacional: {margemLucro}%
          </span>
        </div>

        <div className="bg-surface p-5 rounded-xl shadow-sm">
          <p className="text-xs font-semibold text-fg-secondary uppercase">Caixa Disponível em Conta</p>
          <h2 className="font-data-mono text-2xl font-bold text-emerald-600 mt-2">
            {maskMoney(brl(lucroLiquido + 85000))}
          </h2>
          <span className="text-[10px] text-fg-secondary font-semibold bg-surface-3 px-2 py-0.5 rounded mt-1 inline-block">
            Banco Bradesco (Sede)
          </span>
        </div>
      </div>

      {/* DRE Breakdown Box */}
      <div className="bg-surface p-6 rounded-xl border border-border shadow-sm">
        <h3 className="text-sm font-bold text-fg uppercase tracking-wider mb-4 border-b border-border pb-3">
          Demonstrativo do Resultado do Exercício (DRE Simplificado)
        </h3>
        <div className="space-y-3 text-xs font-data-mono">
          <div className="flex justify-between p-2 bg-surface-2 rounded">
            <span className="font-bold text-fg">(+) RECEITA BRUTA DE SERVIÇOS</span>
            <span className="font-bold text-emerald-700">{maskMoney(brl(totalReceitas))}</span>
          </div>
          <div className="flex justify-between p-2 pl-6 text-fg-secondary">
            <span>(-) Impostos Simples Nacional Anexo III (6%)</span>
            <span className="text-red-600">- {maskMoney(brl(totalReceitas * 0.06))}</span>
          </div>
          <div className="flex justify-between p-2 bg-surface-3 rounded font-semibold text-fg">
            <span>(=) RECEITA LÍQUIDA</span>
            <span>{maskMoney(brl(totalReceitas * 0.94))}</span>
          </div>
          <div className="flex justify-between p-2 pl-6 text-fg-secondary">
            <span>(-) Custos Operacionais de Campo &amp; Materiais</span>
            <span className="text-red-600">- {maskMoney(brl(totalDespesas))}</span>
          </div>
          <div className="flex justify-between p-3 bg-navy text-white rounded-lg font-bold text-sm">
            <span>(=) RESULTADO OPERACIONAL LÍQUIDO FINAL</span>
            <span className="text-emerald-300">{maskMoney(brl(totalReceitas * 0.94 - totalDespesas))}</span>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="bg-navy px-6 py-4 text-white text-xs font-bold uppercase tracking-wider flex justify-between items-center">
          <span>Lançamentos Consolidados do Período</span>
          <div className="flex gap-2 font-normal">
            {['TODOS', 'RECEITA', 'DESPESA'].map((st) => (
              <button
                key={st}
                onClick={() => setFilter(st as any)}
                className={`px-2.5 py-1 rounded text-[11px] ${
                  filter === st ? 'bg-surface text-fg font-bold' : 'text-fg-muted'
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
              <tr className="bg-surface-2 text-fg-secondary font-semibold uppercase tracking-wider border-b border-border">
                <th className="p-4">Cód / Ref</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Cliente / Fornecedor</th>
                <th className="p-4">Descrição do Lançamento</th>
                <th className="p-4">Data Emissão</th>
                <th className="p-4 text-right">Valor Total</th>
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
                  <td className="p-4 font-bold text-fg uppercase">{t.clientOrVendor}</td>
                  <td className="p-4 text-fg-secondary">{t.description}</td>
                  <td className="p-4 font-data-mono text-fg-secondary">{t.date}</td>
                  <td className={`p-4 text-right font-data-mono font-bold ${t.type === 'RECEITA' ? 'text-emerald-600' : 'text-danger'}`}>
                    {t.type === 'RECEITA' ? '+' : '-'} {maskMoney(brl(t.amount))}
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
