'use client';
import { showToast } from '@/components/ui/Feedback';

import React, { useState } from 'react';
import { AuditSDAI } from '@/lib/types';

interface AuditoriaSdaiViewProps {
  audit: AuditSDAI;
}

export const AuditoriaSdaiView: React.FC<AuditoriaSdaiViewProps> = ({ audit }) => {
  const [currentAudit, setCurrentAudit] = useState<AuditSDAI>(audit);
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="flex flex-col w-full p-4 md:p-8 gap-5 md:gap-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-border pb-5">
        <div>
          <span className="text-xs font-semibold text-fg-secondary uppercase tracking-wider">
            Auditoria Especializada NBR 17240
          </span>
          <h1 className="text-2xl font-bold text-fg tracking-tight mt-0.5">
            Auditoria &amp; Matriz de Risco SDAI
          </h1>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-danger hover:bg-danger-hover text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm uppercase tracking-wide flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-base">assignment</span> Gerar Plano de Ação
        </button>
      </div>

      {/* Audit Score Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-[#0f172a] text-white p-5 rounded-xl border border-slate-800 shadow-md">
          <p className="text-xs font-semibold text-fg-muted uppercase">Conformidade NBR 17240</p>
          <h2 className="text-3xl font-bold text-emerald-400 mt-2">{currentAudit.compliancePercentage}%</h2>
          <p className="text-xs text-fg-muted mt-1 font-medium">Unidade Aprovada com Ressalvas</p>
        </div>

        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs font-semibold text-fg-secondary uppercase">Resumo de Não-Conformidades</p>
          <div className="flex gap-4 mt-3 font-data-mono text-xs font-bold">
            <span className="text-danger bg-red-50 px-2.5 py-1 rounded">R1 Crítico: {currentAudit.riskCount.r1}</span>
            <span className="text-amber-700 bg-amber-50 px-2.5 py-1 rounded">R2 Alto: {currentAudit.riskCount.r2}</span>
            <span className="text-fg-secondary bg-surface-3 px-2.5 py-1 rounded">R3 Médio: {currentAudit.riskCount.r3}</span>
          </div>
        </div>

        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm font-data-mono text-xs space-y-1.5">
          <div><strong className="text-fg">CLIENTE AUDITADO:</strong> {currentAudit.clientName}</div>
          <div><strong className="text-fg">SETOR / UNIDADE:</strong> {currentAudit.unit}</div>
          <div><strong className="text-fg">DATA DA AUDITORIA:</strong> {currentAudit.auditDate}</div>
        </div>
      </div>

      {/* Audit Items Checklist Table */}
      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 text-white text-xs font-bold uppercase tracking-wider">
          Itens Verificados — Checklist Normativo NBR 17240
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-2 text-fg-secondary font-semibold uppercase tracking-wider border-b border-border">
                <th className="p-4">Categoria / Item Requisito</th>
                <th className="p-4">Requisito de Segurança</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4">Nível de Risco / Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-medium text-fg-secondary">
              {currentAudit.items.map((item) => (
                <tr key={item.id} className="hover:bg-surface-2/80 transition-colors">
                  <td className="p-4 font-bold text-fg uppercase">{item.category}</td>
                  <td className="p-4 text-fg-secondary">{item.requirement}</td>
                  <td className="p-4 text-center">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        item.status === 'CONFORME'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="p-4">
                    {item.riskLevel && (
                      <span className="font-bold text-danger mr-2">RISCO {item.riskLevel} —</span>
                    )}
                    <span className="text-fg-secondary">{item.observation || 'Sem apontamentos de risco.'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Plan Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface max-w-lg w-full rounded-xl border border-border p-6 shadow-2xl relative">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-fg-muted hover:text-fg-secondary font-bold">
              ✕
            </button>
            <h3 className="text-lg font-bold text-fg uppercase mb-4">Plano de Ação NBR 17240</h3>

            <div className="bg-surface-2 p-4 rounded-lg space-y-2 text-xs font-data-mono border border-border mb-5">
              <div><strong className="text-fg">Ação 1:</strong> Substituição de bateria 24V central Catuaí (Prazo: 5 dias)</div>
              <div><strong className="text-fg">Ação 2:</strong> Desobstrução de detector óptico #042 (Prazo: Imediato)</div>
              <div><strong className="text-fg">Ação 3:</strong> Reprogramação de endereçamento Laço 02 (Prazo: 10 dias)</div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  showToast('Plano de Ação NBR 17240 exportado em PDF com sucesso!');
                  setShowModal(false);
                }}
                className="flex-1 bg-danger hover:bg-danger-hover text-white font-semibold py-2.5 rounded-lg text-xs uppercase transition-colors"
              >
                Exportar PDF do Plano de Ação
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 border border-border text-fg-secondary font-semibold rounded-lg text-xs hover:bg-surface-2 transition-colors"
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
