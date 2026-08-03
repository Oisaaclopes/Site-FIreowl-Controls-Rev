'use client';

import React, { useState } from 'react';
import { TimePunch } from '@/lib/types';

interface PontoViewProps {
  punches: TimePunch[];
  onAddPunch: (punch: TimePunch) => void;
}

export const PontoView: React.FC<PontoViewProps> = ({ punches, onAddPunch }) => {
  const [punchType, setPunchType] = useState<'ENTRADA' | 'PAUSA' | 'RETORNO' | 'SAIDA'>('ENTRADA');
  const [techName, setTechName] = useState('Eng. Ricardo M.');
  const [showFolhaModal, setShowFolhaModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleBaterPonto = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          registerPunch(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          registerPunch(-23.5505, -46.6333);
        },
        { timeout: 3000 }
      );
    } else {
      registerPunch(-23.5505, -46.6333);
    }
  };

  const registerPunch = (lat: number, lng: number) => {
    const now = new Date();
    const formattedDate = `${now.getDate()} MAI ${now.getFullYear()} | ${now
      .getHours()
      .toString()
      .padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now
      .getSeconds()
      .toString()
      .padStart(2, '0')}`;

    const newPunch: TimePunch = {
      id: `p_${Date.now()}`,
      employeeName: techName,
      timestamp: formattedDate,
      type: punchType,
      locationStr: `Catuaí Londrina (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      lat,
      lng,
      status: 'APROVADO',
    };

    onAddPunch(newPunch);
    setToastMessage(`Ponto de ${punchType} registrado com sucesso para ${techName}!`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="flex flex-col w-full p-8 gap-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-600 text-white p-4 rounded-xl shadow-lg flex items-center justify-between font-semibold text-xs transition-all">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">check_circle</span>
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Conformidade Trabalhista (Portaria MTP 671/2021)
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Ponto Eletrônico &amp; Espelho de Frequência
          </h1>
        </div>

        <button
          onClick={() => setShowFolhaModal(true)}
          className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 uppercase"
        >
          <span className="material-symbols-outlined text-base">print</span> Espelho de Ponto (PDF)
        </button>
      </div>

      {/* Clock-in Terminal Card */}
      <div className="bg-[#0f172a] text-white p-6 rounded-xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
          <div>
            <span className="text-[10px] font-bold text-[#ba1a1a] bg-red-950/60 border border-red-800/50 px-2.5 py-1 rounded-full uppercase tracking-wider">
              Terminal de Batida com GPS Verificado
            </span>
            <h2 className="text-xl font-bold uppercase mt-3">Registrar Ponto do Técnico Operacional</h2>
            <p className="text-xs text-slate-300 mt-1">
              Registro instantâneo de entrada, pausas de refeição e saída das equipes externas.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            <select
              value={techName}
              onChange={(e) => setTechName(e.target.value)}
              className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg text-xs font-medium text-white focus:outline-none w-full sm:w-auto"
            >
              <option value="Eng. Ricardo M.">Eng. Ricardo M. (CREA 4289)</option>
              <option value="Carlos Silva">Carlos Silva (Técnico Senior)</option>
              <option value="Amanda Souza">Amanda Souza (Técnica Operacional)</option>
            </select>

            <select
              value={punchType}
              onChange={(e) => setPunchType(e.target.value as any)}
              className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg text-xs font-medium text-white focus:outline-none w-full sm:w-auto"
            >
              <option value="ENTRADA">ENTRADA</option>
              <option value="PAUSA">PAUSA REFEIÇÃO</option>
              <option value="RETORNO">RETORNO PAUSA</option>
              <option value="SAIDA">SAÍDA</option>
            </select>

            <button
              onClick={handleBaterPonto}
              className="w-full sm:w-auto bg-[#ba1a1a] hover:bg-[#a51515] text-white font-semibold text-xs px-6 py-2.5 rounded-lg uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">touch_app</span>
              Bater Ponto Agora
            </button>
          </div>
        </div>
      </div>

      {/* Punch Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 text-white text-xs font-bold uppercase tracking-wider">
          Registros Recentes de Frequência
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <th className="p-4">Funcionário</th>
                <th className="p-4">Data &amp; Hora Servidor</th>
                <th className="p-4">Tipo de Batida</th>
                <th className="p-4">Coordenadas GPS</th>
                <th className="p-4 text-center">Status MTP 671</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {punches.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4 font-bold text-slate-900">{p.employeeName}</td>
                  <td className="p-4 font-data-mono text-[#ba1a1a] font-bold">{p.timestamp}</td>
                  <td className="p-4">
                    <span className="bg-slate-900 text-white px-2.5 py-0.5 rounded text-[10px] font-bold">
                      {p.type}
                    </span>
                  </td>
                  <td className="p-4 font-data-mono text-slate-500">{p.locationStr}</td>
                  <td className="p-4 text-center">
                    <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Espelho de Ponto */}
      {showFolhaModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-xl w-full rounded-xl border border-slate-200 p-6 shadow-2xl relative">
            <button onClick={() => setShowFolhaModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold">
              ✕
            </button>
            <h3 className="text-lg font-bold text-slate-900 uppercase mb-4">Espelho de Ponto Mensal</h3>
            <div className="font-data-mono text-xs space-y-2.5 bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
              <div><strong className="text-slate-900">NOME:</strong> Eng. Ricardo M. (CLT - Técnico Fireowl)</div>
              <div><strong className="text-slate-900">PERÍODO:</strong> 01 MAIO 2024 A 31 MAIO 2024</div>
              <div><strong className="text-slate-900">TOTAL HORAS TRABALHADAS:</strong> 176 HORAS</div>
              <div><strong className="text-slate-900">SALDO BANCO DE HORAS:</strong> +12h 30min</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  window.print();
                  setShowFolhaModal(false);
                }}
                className="flex-1 bg-[#ba1a1a] hover:bg-[#a51515] text-white font-semibold py-2.5 rounded-lg text-xs uppercase"
              >
                Imprimir Folha de Ponto
              </button>
              <button
                onClick={() => setShowFolhaModal(false)}
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
