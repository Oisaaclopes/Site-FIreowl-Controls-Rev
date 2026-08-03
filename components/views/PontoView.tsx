'use client';

import React, { useState } from 'react';
import { TimePunch } from '@/lib/types';
import { DataListRow, Badge } from '@/components/DataListRow';

interface PontoViewProps {
  punches: TimePunch[];
  onAddPunch: (punch: TimePunch) => void;
  currentUser?: string;
}

const typeBadge = (type: TimePunch['type']) =>
  type === 'ENTRADA' ? 'emerald' : type === 'PAUSA' ? 'amber' : type === 'SAIDA' ? 'red' : 'blue';
const statusBadgeColor = (status: TimePunch['status']) =>
  status === 'APROVADO' ? 'emerald' : status === 'PENDENTE' ? 'amber' : 'blue';

export const PontoView: React.FC<PontoViewProps> = ({ punches, onAddPunch, currentUser = 'Operador Fireowl' }) => {
  const [showFolhaModal, setShowFolhaModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [punching, setPunching] = useState(false);

  // Próxima batida do usuário logado: se a última foi ENTRADA/RETORNO → SAÍDA; senão → ENTRADA
  const lastPunch = punches.find((p) => p.employeeName === currentUser);
  const nextType: TimePunch['type'] =
    lastPunch && (lastPunch.type === 'ENTRADA' || lastPunch.type === 'RETORNO') ? 'SAIDA' : 'ENTRADA';
  const isEntrada = nextType === 'ENTRADA';

  const handleBaterPonto = () => {
    if (punching) return;
    setPunching(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => registerPunch(pos.coords.latitude, pos.coords.longitude),
        () => registerPunch(-23.5505, -46.6333),
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
      employeeName: currentUser,
      timestamp: formattedDate,
      type: nextType,
      locationStr: `Catuaí Londrina (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      lat,
      lng,
      status: 'APROVADO',
    };

    onAddPunch(newPunch);
    setToastMessage(`Ponto de ${nextType} registrado com sucesso para ${currentUser}!`);
    setPunching(false);
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

      {/* Clock-in Card — one-click (foco no técnico / celular) */}
      <div className="bg-white p-6 rounded-xl shadow-sm max-w-md mx-auto w-full text-center">
        <p className="text-lg font-bold text-slate-900">
          Olá, <span className="text-[#1A1A72]">{currentUser}</span> 👋
        </p>
        <p className="text-xs text-slate-500 mt-1">
          {isEntrada ? 'Pronto para iniciar o expediente?' : 'Bom trabalho! Encerrando o expediente?'}
        </p>

        {/* Indicativo de GPS / MTP 671 */}
        <div className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full">
          <span className="material-symbols-outlined text-sm">location_on</span>
          Localização e coordenadas GPS sincronizadas
        </div>

        {/* Botão grande one-click */}
        <button
          onClick={handleBaterPonto}
          disabled={punching}
          className={`mt-5 w-full rounded-2xl py-6 text-white font-bold uppercase tracking-wider text-sm transition-all shadow-md flex flex-col items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70 ${
            isEntrada ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#1A1A72] hover:bg-[#12124f]'
          }`}
        >
          <span className={`material-symbols-outlined text-4xl ${punching ? 'animate-spin' : ''}`}>
            {punching ? 'progress_activity' : isEntrada ? 'check_circle' : 'logout'}
          </span>
          {punching ? 'Registrando...' : isEntrada ? 'Registrar Entrada' : 'Registrar Saída'}
        </button>

        <p className="text-[10px] text-slate-400 mt-3 uppercase tracking-wider">
          Conformidade Portaria MTP 671/2021 · Registro com GPS
        </p>
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
