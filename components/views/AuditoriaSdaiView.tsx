'use client';

import React, { useState } from 'react';
import { AuditSDAI } from '@/lib/types';

interface AuditoriaSdaiViewProps {
  audit: AuditSDAI;
}

export const AuditoriaSdaiView: React.FC<AuditoriaSdaiViewProps> = ({ audit }) => {
  const [currentAudit, setCurrentAudit] = useState<AuditSDAI>(audit);
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="flex flex-col w-full p-8 gap-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Auditoria Especializada NBR 17240
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Auditoria &amp; Matriz de Risco SDAI
          </h1>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-[#ba1a1a] hover:bg-[#a51515] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm uppercase tracking-wide flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-base">assignment</span> Gerar Plano de Ação
        </button>
      </div>

      {/* Audit Score Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-[#0f172a] text-white p-5 rounded-xl border border-slate-800 shadow-md">
          <p className="text-xs font-semibold text-slate-400 uppercase">Conformidade NBR 17240</p>
          <h2 className="text-3xl font-bold text-emerald-400 mt-2">{currentAudit.compliancePercentage}%</h2>
          <p className="text-xs text-slate-300 mt-1 font-medium">Unidade Aprovada com Ressalvas</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Resumo de Não-Conformidades</p>
          <div className="flex gap-4 mt-3 font-data-mono text-xs font-bold">
            <span className="text-[#ba1a1a] bg-red-50 px-2.5 py-1 rounded">R1 Crítico: {currentAudit.riskCount.r1}</span>
            <span className="text-amber-700 bg-amber-50 px-2.5 py-1 rounded">R2 Alto: {currentAudit.riskCount.r2}</span>
            <span className="text-slate-700 bg-slate-100 px-2.5 py-1 rounded">R3 Médio: {currentAudit.riskCount.r3}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm font-data-mono text-xs space-y-1.5">
          <div><strong className="text-slate-900">CLIENTE AUDITADO:</strong> {currentAudit.clientName}</div>
          <div><strong className="text-slate-900">SETOR / UNIDADE:</strong> {currentAudit.unit}</div>
          <div><strong className="text-slate-900">DATA DA AUDITORIA:</strong> {currentAudit.auditDate}</div>
        </div>
      </div>

      {/* Audit Items Checklist Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 text-white text-xs font-bold uppercase tracking-wider">
          Itens Verificados — Checklist Normativo NBR 17240
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <th className="p-4">Categoria / Item Requisito</th>
                <th className="p-4">Requisito de Segurança</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4">Nível de Risco / Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {currentAudit.items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4 font-bold text-slate-900 uppercase">{item.category}</td>
                  <td className="p-4 text-slate-600">{item.requirement}</td>
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
                      <span className="font-bold text-[#ba1a1a] mr-2">RISCO {item.riskLevel} —</span>
                    )}
                    <span className="text-slate-600">{item.observation || 'Sem apontamentos de risco.'}</span>
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
          <div className="bg-white max-w-lg w-full rounded-xl border border-slate-200 p-6 shadow-2xl relative">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold">
              ✕
            </button>
            <h3 className="text-lg font-bold text-slate-900 uppercase mb-4">Plano de Ação NBR 17240</h3>

            <div className="bg-slate-50 p-4 rounded-lg space-y-2 text-xs font-data-mono border border-slate-200 mb-5">
              <div><strong className="text-slate-900">Ação 1:</strong> Substituição de bateria 24V central Catuaí (Prazo: 5 dias)</div>
              <div><strong className="text-slate-900">Ação 2:</strong> Desobstrução de detector óptico #042 (Prazo: Imediato)</div>
              <div><strong className="text-slate-900">Ação 3:</strong> Reprogramação de endereçamento Laço 02 (Prazo: 10 dias)</div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  alert('Plano de Ação NBR 17240 exportado em PDF com sucesso!');
                  setShowModal(false);
                }}
                className="flex-1 bg-[#ba1a1a] hover:bg-[#a51515] text-white font-semibold py-2.5 rounded-lg text-xs uppercase transition-colors"
              >
                Exportar PDF do Plano de Ação
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 border border-slate-200 text-slate-700 font-semibold rounded-lg text-xs hover:bg-slate-50 transition-colors"
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
