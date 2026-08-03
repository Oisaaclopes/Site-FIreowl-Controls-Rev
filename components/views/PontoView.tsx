'use client';

import React, { useState } from 'react';
import { TimePunch } from '@/lib/types';
import { DataListRow, Badge } from '@/components/DataListRow';

interface PontoViewProps {
  punches: TimePunch[];
  onAddPunch: (punch: TimePunch) => void;
}

const typeBadge = (type: TimePunch['type']) =>
  type === 'ENTRADA' ? 'emerald' : type === 'PAUSA' ? 'amber' : type === 'SAIDA' ? 'red' : 'blue';
const statusBadgeColor = (status: TimePunch['status']) =>
  status === 'APROVADO' ? 'emerald' : status === 'PENDENTE' ? 'amber' : 'blue';

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

      {/* Clock-in Terminal Card (dashboard claro) */}
      <div className="bg-white p-6 rounded-xl shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Terminal de Batida com GPS Verificado
            </span>
            <h2 className="text-lg font-bold text-slate-900 uppercase mt-3">Registrar Ponto do Técnico Operacional</h2>
            <p className="text-xs text-slate-500 mt-1">
              Registro instantâneo de entrada, pausas de refeição e saída das equipes externas.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full lg:w-auto">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase text-slate-400">Técnico</label>
              <select
                value={techName}
                onChange={(e) => setTechName(e.target.value)}
                className="bg-white border border-slate-200 p-2.5 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20 w-full sm:w-56"
              >
                <option value="Eng. Ricardo M.">Eng. Ricardo M. (CREA 4289)</option>
                <option value="Carlos Silva">Carlos Silva (Técnico Senior)</option>
                <option value="Amanda Souza">Amanda Souza (Técnica Operacional)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase text-slate-400">Tipo de batida</label>
              <select
                value={punchType}
                onChange={(e) => setPunchType(e.target.value as any)}
                className="bg-white border border-slate-200 p-2.5 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20 w-full sm:w-44"
              >
                <option value="ENTRADA">ENTRADA</option>
                <option value="PAUSA">PAUSA REFEIÇÃO</option>
                <option value="RETORNO">RETORNO PAUSA</option>
                <option value="SAIDA">SAÍDA</option>
              </select>
            </div>

            <button
              onClick={handleBaterPonto}
              className="w-full sm:w-auto bg-[#1A1A72] hover:bg-[#12124f] text-white font-semibold text-xs px-6 py-2.5 rounded-lg uppercase tracking-wider transition-colors shadow-sm flex items-center justify-center gap-2 self-end"
            >
              <span className="material-symbols-outlined text-lg">touch_app</span>
              Bater Ponto Agora
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Frequência (DataListRow) */}
      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Registros Recentes de Frequência
        </h3>
        {punches.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm py-16 text-center text-slate-400">
            <span className="material-symbols-outlined text-4xl text-slate-300">schedule</span>
            <p className="mt-2 text-sm font-bold text-slate-500 uppercase tracking-wider">Nenhuma batida registrada</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {punches.map((p) => (
              <DataListRow
                key={p.id}
                leading={
                  <span className="w-10 h-10 rounded-full bg-[#1A1A72]/10 text-[#1A1A72] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-lg">person</span>
                  </span>
                }
                title={p.employeeName}
                meta={
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-slate-400">location_on</span>
                    <span className="font-data-mono">{p.locationStr}</span>
                  </span>
                }
                center={
                  <div className="text-left md:text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Data &amp; hora</p>
                    <p className="font-data-mono text-slate-700 font-semibold">{p.timestamp}</p>
                  </div>
                }
                right={
                  <>
                    <Badge color={typeBadge(p.type)}>{p.type}</Badge>
                    <Badge color={statusBadgeColor(p.status)} outline>
                      MTP 671: {p.status}
                    </Badge>
                  </>
                }
              />
            ))}
          </div>
        )}
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
                className="flex-1 bg-[#E63946] hover:bg-[#a51515] text-white font-semibold py-2.5 rounded-lg text-xs uppercase"
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
