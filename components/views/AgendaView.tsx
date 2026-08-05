'use client';

import React, { useState } from 'react';
import { PedidoOS } from '@/lib/types';

interface AgendaViewProps {
  pedidosOS: PedidoOS[];
}

export const AgendaView: React.FC<AgendaViewProps> = ({ pedidosOS }) => {
  const [viewMode, setViewMode] = useState<'calendar' | 'kanban' | 'map'>('calendar');

  return (
    <div className="flex flex-col w-full p-4 md:p-8 gap-5 md:gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Despacho Técnico &amp; Escala de Campo
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Agenda de Atendimentos &amp; Manutenções
          </h1>
        </div>

        {/* View mode switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase transition-colors ${
              viewMode === 'calendar' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Calendário
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase transition-colors ${
              viewMode === 'kanban' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Kanban
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase transition-colors ${
              viewMode === 'map' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mapa de Rota
          </button>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-bold text-slate-900 uppercase">Maio 2024 — Escala Semanal Londrina</h3>
            <span className="text-xs font-bold text-[#E63946] bg-red-50 border border-red-200 px-3 py-1 rounded-full uppercase">
              Recorrência NBR 17240 Ativa
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2 font-data-mono text-center mb-2 font-bold text-xs text-slate-600">
            {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((d) => (
              <div key={d} className="bg-slate-50 py-2.5 rounded-lg border border-slate-200">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2 min-h-[350px]">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
              const hasOS = day === 24 || day === 22 || day === 20;
              return (
                <div
                  key={day}
                  className={`border rounded-lg p-2 min-h-[85px] flex flex-col justify-between font-data-mono text-xs transition-colors ${
                    day === 24 ? 'bg-red-50/60 border-2 border-[#E63946]' : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className={`font-bold ${day === 24 ? 'text-[#E63946]' : 'text-slate-700'}`}>{day}</span>
                    {day === 24 && <span className="text-[9px] bg-[#E63946] text-white px-1.5 py-0.5 rounded font-bold">HOJE</span>}
                  </div>
                  {hasOS && (
                    <div className="bg-slate-900 text-white p-1.5 rounded text-[10px] truncate font-medium shadow-sm">
                      OS SDAI Catuaí
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {['ABERTA', 'EM ANDAMENTO', 'CONCLUIDA', 'ATRASADA'].map((status) => (
            <div key={status} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-3">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase">{status}</h4>
                <span className="font-data-mono text-[10px] bg-slate-200 px-2 py-0.5 rounded-full font-bold text-slate-700">
                  {pedidosOS.filter((os) => os.status === status).length}
                </span>
              </div>
              <div className="space-y-3">
                {pedidosOS
                  .filter((os) => os.status === status)
                  .map((os) => (
                    <div key={os.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
                      <span className="font-data-mono text-[10px] text-[#E63946] font-bold">{os.id}</span>
                      <h5 className="font-bold text-xs uppercase text-slate-900 mt-1">{os.clientName}</h5>
                      <p className="text-xs text-slate-500 mt-1">{os.title}</p>
                      <div className="mt-3 font-data-mono text-[10px] text-slate-400 border-t border-slate-100 pt-2 flex justify-between items-center">
                        <span>Técnico: {os.technicianName}</span>
                        <span className="font-bold text-slate-800">R$ {os.value}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Map View */}
      {viewMode === 'map' && (
        <div
          className="bg-slate-100 p-8 rounded-xl border border-slate-200 shadow-sm min-h-[380px] flex flex-col justify-between relative overflow-hidden"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(26,26,114,0.08) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        >
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-widest bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> GPS Ativo — Londrina / PR
            </span>
            <h3 className="text-2xl font-bold uppercase mt-4 text-slate-900">
              Geolocalização &amp; Despacho em Tempo Real
            </h3>
          </div>

          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm font-data-mono text-xs space-y-3 z-10">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="text-amber-600 font-bold">● EQUIPE ALFA:</span>
              <span className="text-slate-700">Em atendimento no Catuaí Shopping (-23.5505, -46.6333)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-emerald-600 font-bold">● EQUIPE BETA:</span>
              <span className="text-slate-700">Em deslocamento para Londrina Norte Shopping (-23.5301, -46.6120)</span>
            </div>
          </div>

          <div className="text-right font-data-mono text-[10px] text-slate-400 z-10">
            SIS_ROUTER_GPS // ACTIVE_DISPATCH_PR
          </div>
        </div>
      )}
    </div>
  );
};
