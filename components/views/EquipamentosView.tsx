'use client';

import React, { useState } from 'react';
import { ClientEquipment } from '@/lib/types';

interface EquipamentosViewProps {
  equipmentList: ClientEquipment[];
  onAddEquipment: (eq: ClientEquipment) => void;
}

export const EquipamentosView: React.FC<EquipamentosViewProps> = ({
  equipmentList,
  onAddEquipment,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [selectedQrEquipment, setSelectedQrEquipment] = useState<ClientEquipment | null>(null);
  const [clientName, setClientName] = useState('Catuaí Shopping Londrina');
  const [centralModel, setCentralModel] = useState('Notifier AFP-3030');
  const [serialBP, setSerialBP] = useState('BP-2024-9981-90');

  const handleCreateEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    const timestamp = Date.now().toString().slice(-3);
    onAddEquipment({
      id: `EQ-SDAI-${timestamp}`,
      clientName,
      location: 'Praça de Alimentação - Nível 1',
      centralModel,
      loopNumber: 'Laço 01',
      detectorPoint: 'Detector Óptico #042',
      serialBP,
      installationDate: '24 MAI 2024',
      lastMaintenance: '24 MAI 2024',
      nextMaintenance: '24 AGO 2024',
      status: 'OPERACIONAL',
    });
    setShowModal(false);
  };

  return (
    <div className="flex flex-col w-full p-4 md:p-8 gap-5 md:gap-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Módulo de Rastreabilidade de Ativos
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Equipamentos &amp; Dispositivos de Clientes (Série BP)
          </h1>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-[#E63946] hover:bg-[#a51515] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 uppercase tracking-wide"
        >
          <span className="material-symbols-outlined text-base">add</span> Cadastrar Ativo
        </button>
      </div>

      {/* Equipment Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 text-white text-xs font-bold uppercase tracking-wider flex justify-between items-center">
          <span>Árvore de Dispositivos SDAI &amp; CFTV nos Clientes</span>
          <span className="font-data-mono text-slate-400 font-normal">SÉRIE BP RASTREADA</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <th className="p-4">ID Ativo / Série BP</th>
                <th className="p-4">Cliente / Localização</th>
                <th className="p-4">Modelo / Laço / Ponto</th>
                <th className="p-4">Datas de Manutenção</th>
                <th className="p-4 text-center">Status Operacional</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {equipmentList.map((eq) => (
                <tr key={eq.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4">
                    <span className="font-data-mono font-bold text-[#E63946]">{eq.id}</span> <br />
                    <span className="font-data-mono text-[11px] font-bold text-slate-900 bg-amber-100 px-2 py-0.5 rounded-md mt-1 inline-block">
                      {eq.serialBP}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="font-bold text-slate-900 uppercase text-xs">{eq.clientName}</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">{eq.location}</p>
                  </td>
                  <td className="p-4">
                    <span className="font-semibold text-slate-900">{eq.centralModel}</span> <br />
                    <span className="text-[11px] text-slate-500 font-data-mono">{eq.loopNumber} — {eq.detectorPoint}</span>
                  </td>
                  <td className="p-4 font-data-mono">
                    <span className="text-slate-600">Última: {eq.lastMaintenance}</span> <br />
                    <span className="text-emerald-700 font-bold">Próxima: {eq.nextMaintenance}</span>
                  </td>
                  <td className="p-4 text-center">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        eq.status === 'OPERACIONAL'
                          ? 'bg-emerald-100 text-emerald-800'
                          : eq.status === 'ALERTA'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {eq.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => setSelectedQrEquipment(eq)}
                      className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors text-slate-700 font-semibold text-xs inline-flex items-center gap-1"
                      title="Gerar Etiqueta QR Série BP"
                    >
                      <span className="material-symbols-outlined text-base">qr_code_2</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add Equipment */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-xl border border-slate-200 p-6 shadow-2xl relative">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold">
              ✕
            </button>
            <h3 className="text-lg font-bold text-slate-900 uppercase mb-4">Cadastrar Ativo de Cliente</h3>
            <form onSubmit={handleCreateEquipment} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase">Razão Social do Cliente</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase">Modelo Central / Dispositivo</label>
                <input
                  type="text"
                  required
                  value={centralModel}
                  onChange={(e) => setCentralModel(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 font-data-mono focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase">Número de Série BP</label>
                <input
                  type="text"
                  required
                  value={serialBP}
                  onChange={(e) => setSerialBP(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 font-data-mono focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[#E63946] hover:bg-[#a51515] text-white py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
              >
                Salvar Ativo
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal QR Code Label Generator */}
      {selectedQrEquipment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full rounded-xl border border-slate-200 p-6 shadow-2xl relative text-center">
            <button onClick={() => setSelectedQrEquipment(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold">
              ✕
            </button>
            <h3 className="text-base font-bold text-slate-900 uppercase">Etiqueta de Campo Série BP</h3>
            <p className="text-xs text-slate-500 mt-1">Identificação Física do Ativo SDAI</p>

            <div className="my-5 p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center">
              <div className="w-32 h-32 bg-slate-900 text-white font-data-mono text-[9px] flex flex-col items-center justify-center p-2 rounded-lg shadow-inner">
                <span className="material-symbols-outlined text-[48px] text-amber-400 mb-1">qr_code_2</span>
                <span>{selectedQrEquipment.serialBP}</span>
              </div>
              <div className="mt-3 font-data-mono text-xs text-slate-900 font-bold">
                {selectedQrEquipment.serialBP}
              </div>
              <div className="text-[11px] text-slate-600 uppercase font-semibold mt-1">
                {selectedQrEquipment.clientName}
              </div>
              <div className="text-[10px] text-slate-400 font-data-mono">
                {selectedQrEquipment.centralModel} — {selectedQrEquipment.loopNumber}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  window.print();
                  setSelectedQrEquipment(null);
                }}
                className="flex-1 bg-[#E63946] hover:bg-[#a51515] text-white font-semibold py-2 rounded-lg text-xs uppercase"
              >
                Imprimir Etiqueta
              </button>
              <button
                onClick={() => setSelectedQrEquipment(null)}
                className="px-4 border border-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
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
