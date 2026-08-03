'use client';

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
    alert('Relatório Técnico SDAI salvo com sucesso!');
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      {/* Header Stats */}
      <div className="px-8 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border-b border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Auditoria &amp; Relatório Técnico SDAI
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Relatório de Inspeção NBR 17240
          </h1>
          <div className="font-data-mono text-xs text-slate-500 flex gap-4 mt-1 font-medium">
            <span>REF: {currentReport.id}</span>
            <span>GPS: {currentReport.coordStr}</span>
            <span className="text-[#E63946] font-bold">STATUS: {currentReport.status}</span>
          </div>
        </div>

        <div className="flex gap-6">
          <div className="text-right">
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Dispositivos Testados</p>
            <p className="text-3xl font-bold text-slate-900 mt-0.5">{currentReport.devicesCount}</p>
          </div>
          <div className="text-right border-l border-slate-200 pl-6">
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Falhas Críticas</p>
            <p className="text-3xl font-bold text-[#E63946] mt-0.5">0{currentReport.criticalFailures}</p>
          </div>
        </div>
      </div>

      {/* Main Form Content */}
      <div className="p-8 grid grid-cols-12 gap-6 flex-1">
        {/* Technical Form & Photos */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide mb-5 border-b border-slate-100 pb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-700">analytics</span>
              Parâmetros de Inspeção Técnico-Operacional
            </h3>

            <form className="grid grid-cols-2 gap-4" onSubmit={(e) => e.preventDefault()}>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Cliente / Unidade
                </label>
                <input
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Código da Central de Alarme
                </label>
                <input
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-data-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                  type="text"
                  value={centralCode}
                  onChange={(e) => setCentralCode(e.target.value)}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Diagnóstico Técnico &amp; Ocorrência
                </label>
                <textarea
                  className="w-full border border-slate-200 rounded-lg p-3 text-xs text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
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
              <div key={photo.id} className="aspect-video relative rounded-xl overflow-hidden bg-slate-900 border border-slate-200 group shadow-sm">
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
                        chk.status === 'FALHA' ? 'border-[#E63946] bg-red-950' : 'border-emerald-500 bg-emerald-950'
                      }`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          chk.status === 'FALHA' ? 'bg-[#E63946]' : 'bg-emerald-500'
                        }`}
                      ></div>
                    </div>
                    <span className="text-xs text-slate-200">{chk.item}</span>
                  </div>
                  <span
                    className={`font-data-mono text-xs font-bold ${
                      chk.status === 'FALHA' ? 'text-[#E63946]' : 'text-emerald-400'
                    }`}
                  >
                    {chk.status}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-6 pt-4 border-t border-slate-800">
              <p className="text-[10px] text-slate-400 mb-1 uppercase font-semibold">
                Assinatura do Responsável Técnico
              </p>
              <div className="h-14 border border-slate-800 rounded-lg bg-slate-900/50 flex items-center justify-center italic text-slate-300 text-xs">
                {currentReport.inspectorName} — CREA {currentReport.creaRegister}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm space-y-2 font-data-mono text-xs">
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">MODELO:</span>
              <span className="text-slate-900 font-bold">{currentReport.specs.model}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">CAPACIDADE:</span>
              <span className="text-slate-900">{currentReport.specs.capacity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">PROTOCOLO:</span>
              <span className="text-slate-900">{currentReport.specs.protocol}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Bar */}
      <div className="px-8 py-4 bg-white border-t border-slate-200 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveReport}
            className="bg-[#E63946] hover:bg-[#a51515] text-white font-semibold px-5 py-2.5 rounded-lg text-xs uppercase tracking-wider transition-colors shadow-sm flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">save</span>
            Salvar Relatório
          </button>
          <button
            onClick={() => setShowPdfModal(true)}
            className="border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2.5 rounded-lg text-xs uppercase transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">print</span>
            Gerar PDF
          </button>
        </div>

        <span className="font-data-mono text-xs text-slate-400">
          Auto-Save: {currentReport.updatedAt}
        </span>
      </div>

      {/* PDF Export Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl border border-slate-200 p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowPdfModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold"
            >
              ✕
            </button>

            <div className="border-b border-slate-200 pb-3 mb-4">
              <h2 className="text-xl font-bold text-slate-900 uppercase">Laudo Técnico de Inspeção SDAI</h2>
              <p className="font-data-mono text-xs text-[#E63946] font-bold mt-0.5">FIREOWL CONTROLS — REF: {currentReport.id}</p>
            </div>

            <div className="space-y-4 text-xs font-medium text-slate-700">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 font-data-mono space-y-1">
                <div><strong className="text-slate-900">CLIENTE:</strong> {clientName}</div>
                <div><strong className="text-slate-900">CENTRAL:</strong> {centralCode}</div>
                <div><strong className="text-slate-900">RESPONSÁVEL:</strong> {currentReport.inspectorName} ({currentReport.creaRegister})</div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 uppercase mb-1">Diagnóstico da Inspeção:</h4>
                <p className="text-slate-600 leading-relaxed">{occurrenceDesc}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 my-3">
                {currentReport.photos.map((p) => (
                  <div key={p.id} className="border border-slate-200 p-1 rounded-lg bg-slate-50">
                    {/* eslint-disable-next-html-element-suppress */}
                    <img src={p.url} alt={p.label} className="w-full h-28 object-cover rounded" />
                    <p className="font-data-mono text-[10px] text-slate-900 mt-1 font-bold">{p.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                <div className="text-xs font-data-mono text-slate-500">
                  <p className="font-bold text-slate-900">Validação NBR 17240</p>
                  <p>SDAI-8892-CREA-PR</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      window.print();
                      setShowPdfModal(false);
                    }}
                    className="bg-[#E63946] hover:bg-[#a51515] text-white font-semibold px-5 py-2 rounded-lg text-xs uppercase"
                  >
                    Imprimir Documento PDF
                  </button>
                  <button
                    onClick={() => setShowPdfModal(false)}
                    className="px-4 border border-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
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
