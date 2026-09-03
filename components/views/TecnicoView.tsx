'use client';
import { showToast } from '@/components/ui/Feedback';

import React, { useState } from 'react';
import { TechnicalReportSDAI } from '@/lib/types';

interface TecnicoViewProps {
  report: TechnicalReportSDAI;
  onUpdateReport?: (updated: TechnicalReportSDAI) => void;
}

export const TecnicoView: React.FC<TecnicoViewProps> = ({
  report,
  onUpdateReport,
}) => {
  const [currentReport, setCurrentReport] = useState<TechnicalReportSDAI>(report);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [clientName, setClientName] = useState(currentReport.clientName);
  const [centralCode, setCentralCode] = useState(currentReport.centralCode);
  const [occurrenceDesc, setOccurrenceDesc] = useState(currentReport.occurrenceDesc);

  const toggleChecklistItem = (index: number) => {
    const updatedChecklist = [...currentReport.checklist];
    const currentStatus = updatedChecklist[index].status;
    updatedChecklist[index].status = currentStatus === 'OK' || currentStatus === '100%' ? 'FALHA' : 'OK';

    const updated = {
      ...currentReport,
      checklist: updatedChecklist,
      updatedAt: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
    };
    setCurrentReport(updated);
    if (onUpdateReport) onUpdateReport(updated);
  };

  const handleSaveReport = () => {
    const updated = {
      ...currentReport,
      clientName,
      centralCode,
      occurrenceDesc,
      updatedAt: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
    };
    setCurrentReport(updated);
    if (onUpdateReport) onUpdateReport(updated);
    showToast('Relatório Técnico SDAI salvo com sucesso!');
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-surface-2">
      {/* Header Stats */}
      <div className="px-8 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface border-b border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-xs font-semibold text-fg-secondary uppercase tracking-wider">
              Auditoria &amp; Relatório Técnico SDAI
            </span>
          </div>
          <h1 className="text-2xl font-bold text-fg tracking-tight">
            Relatório de Inspeção NBR 17240
          </h1>
          <div className="font-data-mono text-xs text-fg-secondary flex gap-4 mt-1 font-medium">
            <span>REF: {currentReport.id}</span>
            <span>GPS: {currentReport.coordStr}</span>
            <span className="text-danger font-bold">STATUS: {currentReport.status}</span>
          </div>
        </div>

        <div className="flex gap-6">
          <div className="text-right">
            <p className="text-[10px] font-semibold text-fg-muted uppercase">Dispositivos Testados</p>
            <p className="text-3xl font-bold text-fg mt-0.5">{currentReport.devicesCount}</p>
          </div>
          <div className="text-right border-l border-border pl-6">
            <p className="text-[10px] font-semibold text-fg-muted uppercase">Falhas Críticas</p>
            <p className="text-3xl font-bold text-danger mt-0.5">0{currentReport.criticalFailures}</p>
          </div>
        </div>
      </div>

      {/* Main Form Content */}
      <div className="p-8 grid grid-cols-12 gap-6 flex-1">
        {/* Technical Form & Photos */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <div className="bg-surface p-6 rounded-xl border border-border shadow-sm">
            <h3 className="text-base font-bold text-fg uppercase tracking-wide mb-5 border-b border-border pb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-fg-secondary">analytics</span>
              Parâmetros de Inspeção Técnico-Operacional
            </h3>

            <form className="grid grid-cols-2 gap-4" onSubmit={(e) => e.preventDefault()}>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-fg-secondary uppercase mb-1">
                  Cliente / Unidade
                </label>
                <input
                  className="w-full border border-border rounded-lg p-2.5 text-xs font-bold text-fg uppercase focus:outline-none focus:ring-2 focus:ring-danger/20"
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-fg-secondary uppercase mb-1">
                  Código da Central de Alarme
                </label>
                <input
                  className="w-full border border-border rounded-lg p-2.5 text-xs font-data-mono font-bold text-fg uppercase focus:outline-none focus:ring-2 focus:ring-danger/20"
                  type="text"
                  value={centralCode}
                  onChange={(e) => setCentralCode(e.target.value)}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-fg-secondary uppercase mb-1">
                  Diagnóstico Técnico &amp; Ocorrência
                </label>
                <textarea
                  className="w-full border border-border rounded-lg p-3 text-xs text-fg leading-relaxed focus:outline-none focus:ring-2 focus:ring-danger/20"
                  rows={3}
                  value={occurrenceDesc}
                  onChange={(e) => setOccurrenceDesc(e.target.value)}
                />
              </div>
            </form>
          </div>

          {/* Photos Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {currentReport.photos.map((photo) => (
              <div key={photo.id} className="aspect-video relative rounded-xl overflow-hidden bg-slate-900 border border-border group shadow-sm">
                {/* eslint-disable-next-html-element-suppress */}
                <img
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  src={photo.url}
                  alt={photo.label}
                />
                <div className="absolute top-3 left-3 px-2.5 py-1 bg-slate-900/90 text-white font-data-mono text-[10px] rounded font-bold backdrop-blur-sm">
                  {photo.tag}
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-sm p-3 text-white">
                  <p className="text-xs font-semibold uppercase">{photo.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar Checklist */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-[#0f172a] text-white p-6 rounded-xl border border-slate-800 shadow-xl">
            <h4 className="text-sm font-bold uppercase mb-4 tracking-wider border-b border-slate-800 pb-2">
              Checklist NBR 17240 (Clique para alternar)
            </h4>

            <ul className="space-y-3">
              {currentReport.checklist.map((chk, idx) => (
                <li
                  key={idx}
                  onClick={() => toggleChecklistItem(idx)}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/60 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                        chk.status === 'FALHA' ? 'border-danger bg-red-950' : 'border-emerald-500 bg-emerald-950'
                      }`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          chk.status === 'FALHA' ? 'bg-danger' : 'bg-emerald-500'
                        }`}
                      ></div>
                    </div>
                    <span className="text-xs text-slate-200">{chk.item}</span>
                  </div>
                  <span
                    className={`font-data-mono text-xs font-bold ${
                      chk.status === 'FALHA' ? 'text-danger' : 'text-emerald-400'
                    }`}
                  >
                    {chk.status}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-6 pt-4 border-t border-slate-800">
              <p className="text-[10px] text-fg-muted mb-1 uppercase font-semibold">
                Assinatura do Responsável Técnico
              </p>
              <div className="h-14 border border-slate-800 rounded-lg bg-slate-900/50 flex items-center justify-center italic text-fg-muted text-xs">
                {currentReport.inspectorName} — CREA {currentReport.creaRegister}
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border p-5 rounded-xl shadow-sm space-y-2 font-data-mono text-xs">
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-fg-secondary">MODELO:</span>
              <span className="text-fg font-bold">{currentReport.specs.model}</span>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-fg-secondary">CAPACIDADE:</span>
              <span className="text-fg">{currentReport.specs.capacity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-secondary">PROTOCOLO:</span>
              <span className="text-fg">{currentReport.specs.protocol}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Bar */}
      <div className="px-8 py-4 bg-surface border-t border-border flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveReport}
            className="bg-danger hover:bg-danger-hover text-white font-semibold px-5 py-2.5 rounded-lg text-xs uppercase tracking-wider transition-colors shadow-sm flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">save</span>
            Salvar Relatório
          </button>
          <button
            onClick={() => setShowPdfModal(true)}
            className="border border-border hover:bg-surface-2 text-fg-secondary font-semibold px-4 py-2.5 rounded-lg text-xs uppercase transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">print</span>
            Gerar PDF
          </button>
        </div>

        <span className="font-data-mono text-xs text-fg-muted">
          Auto-Save: {currentReport.updatedAt}
        </span>
      </div>

      {/* PDF Export Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-2xl rounded-xl border border-border p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowPdfModal(false)}
              className="absolute top-4 right-4 text-fg-muted hover:text-fg-secondary font-bold"
            >
              ✕
            </button>

            <div className="border-b border-border pb-3 mb-4">
              <h2 className="text-xl font-bold text-fg uppercase">Laudo Técnico de Inspeção SDAI</h2>
              <p className="font-data-mono text-xs text-danger font-bold mt-0.5">FIREOWL CONTROLS — REF: {currentReport.id}</p>
            </div>

            <div className="space-y-4 text-xs font-medium text-fg-secondary">
              <div className="bg-surface-2 p-4 rounded-lg border border-border font-data-mono space-y-1">
                <div><strong className="text-fg">CLIENTE:</strong> {clientName}</div>
                <div><strong className="text-fg">CENTRAL:</strong> {centralCode}</div>
                <div><strong className="text-fg">RESPONSÁVEL:</strong> {currentReport.inspectorName} ({currentReport.creaRegister})</div>
              </div>

              <div>
                <h4 className="font-bold text-fg uppercase mb-1">Diagnóstico da Inspeção:</h4>
                <p className="text-fg-secondary leading-relaxed">{occurrenceDesc}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 my-3">
                {currentReport.photos.map((p) => (
                  <div key={p.id} className="border border-border p-1 rounded-lg bg-surface-2">
                    {/* eslint-disable-next-html-element-suppress */}
                    <img src={p.url} alt={p.label} className="w-full h-28 object-cover rounded" />
                    <p className="font-data-mono text-[10px] text-fg mt-1 font-bold">{p.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <div className="text-xs font-data-mono text-fg-secondary">
                  <p className="font-bold text-fg">Validação NBR 17240</p>
                  <p>SDAI-8892-CREA-PR</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      window.print();
                      setShowPdfModal(false);
                    }}
                    className="bg-danger hover:bg-danger-hover text-white font-semibold px-5 py-2 rounded-lg text-xs uppercase"
                  >
                    Imprimir Documento PDF
                  </button>
                  <button
                    onClick={() => setShowPdfModal(false)}
                    className="px-4 border border-border text-fg-secondary font-semibold rounded-lg text-xs"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
