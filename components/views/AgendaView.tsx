'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PedidoOS } from '@/lib/types';
import { fetchHolidays, Holiday } from '@/lib/holidays';
import { isSupabaseConfigured } from '@/lib/inventory';

interface AgendaViewProps {
  pedidosOS: PedidoOS[];
}

const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const MONTH_ABBR = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

const pad2 = (n: number) => String(n).padStart(2, '0');
const dateKey = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

/** Feriados nacionais de data fixa (fallback quando o Supabase não responde). */
function fixedNationalHolidays(year: number): Record<string, { name: string; type: string }> {
  const fixed: [number, number, string][] = [
    [1, 1, 'Confraternização Universal'],
    [4, 21, 'Tiradentes'],
    [5, 1, 'Dia do Trabalho'],
    [9, 7, 'Independência do Brasil'],
    [10, 12, 'Nossa Senhora Aparecida'],
    [11, 2, 'Finados'],
    [11, 15, 'Proclamação da República'],
    [11, 20, 'Consciência Negra'],
    [12, 25, 'Natal'],
  ];
  const map: Record<string, { name: string; type: string }> = {};
  fixed.forEach(([mo, day, name]) => {
    map[`${year}-${pad2(mo)}-${pad2(day)}`] = { name, type: 'Nacional' };
  });
  return map;
}

/** Extrai {day, month, year} de um scheduledDate livre, ex.: "24 MAI 2026 | 08:30". */
function parseScheduled(str: string): { day: number; month: number; year?: number } | null {
  const m = (str || '').match(/(\d{1,2})\s+([A-Za-z]{3,})\.?(?:\s+(\d{4}))?/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const abbr = m[2].toUpperCase().slice(0, 3);
  const month = MONTH_ABBR.indexOf(abbr);
  if (month < 0 || !day) return null;
  const year = m[3] ? parseInt(m[3], 10) : undefined;
  return { day, month, year };
}

export const AgendaView: React.FC<AgendaViewProps> = ({ pedidosOS }) => {
  const [viewMode, setViewMode] = useState<'calendar' | 'kanban' | 'map'>('calendar');

  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [holidays, setHolidays] = useState<Record<string, { name: string; type: string }>>({});

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Carrega feriados do Supabase; usa feriados fixos nacionais como base/fallback.
  useEffect(() => {
    setHolidays((prev) => ({ ...fixedNationalHolidays(year), ...prev }));
    if (!isSupabaseConfigured()) return;
    fetchHolidays()
      .then((rows: Holiday[]) => {
        setHolidays((prev) => {
          const map = { ...prev };
          rows.forEach((h) => {
            map[h.date] = { name: h.name, type: h.type };
          });
          return map;
        });
      })
      .catch((err) => console.warn('Agenda: falha ao carregar feriados.', err));
  }, [year]);

  // Grade do mês exibido (com preenchimento para alinhar os dias da semana).
  const grid = useMemo(() => {
    const firstWeekday = new Date(year, month, 1).getDay(); // 0=DOM
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  // OS agrupadas por dia do mês exibido (a partir do scheduledDate).
  const osByDay = useMemo(() => {
    const map: Record<number, PedidoOS[]> = {};
    pedidosOS.forEach((os) => {
      const p = parseScheduled(os.scheduledDate);
      if (!p || p.month !== month) return;
      if (p.year && p.year !== year) return;
      (map[p.day] = map[p.day] || []).push(os);
    });
    return map;
  }, [pedidosOS, year, month]);

  const monthHolidays = useMemo(
    () =>
      Object.entries(holidays)
        .filter(([k]) => k.startsWith(`${year}-${pad2(month + 1)}`))
        .map(([k, v]) => ({ day: parseInt(k.slice(-2), 10), ...v }))
        .sort((a, b) => a.day - b.day),
    [holidays, year, month]
  );

  const isToday = (d: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  const goPrevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const goNextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToday = () => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));

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
        <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6 shadow-sm">
          {/* Navegação do mês */}
          <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
            <div className="flex items-center gap-2">
              <button
                onClick={goPrevMonth}
                aria-label="Mês anterior"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              <h3 className="text-base font-bold text-slate-900 uppercase min-w-[170px] text-center">
                {MONTH_NAMES[month]} {year}
              </h3>
              <button
                onClick={goNextMonth}
                aria-label="Próximo mês"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
              <button
                onClick={goToday}
                className="ml-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Hoje
              </button>
            </div>

            {/* Legenda */}
            <div className="flex items-center gap-4 text-[11px] font-medium text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-red-100 border border-[#E63946]" /> Feriado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-white ring-2 ring-[#1A1A72]" /> Hoje
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-slate-900" /> OS agendada
              </span>
            </div>
          </div>

          {/* Cabeçalho dos dias da semana */}
          <div className="grid grid-cols-7 gap-1.5 md:gap-2 font-data-mono text-center mb-2 font-bold text-xs text-slate-600">
            {WEEKDAYS.map((d, i) => (
              <div
                key={d}
                className={`py-2.5 rounded-lg border ${
                  i === 0 || i === 6 ? 'bg-slate-100/80 border-slate-200 text-slate-500' : 'bg-slate-50 border-slate-200'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Grade do mês */}
          <div className="grid grid-cols-7 gap-1.5 md:gap-2">
            {grid.map((day, idx) => {
              if (day === null) {
                return <div key={`e-${idx}`} className="min-h-[70px] md:min-h-[92px] rounded-lg bg-slate-50/40" />;
              }
              const key = dateKey(year, month, day);
              const holiday = holidays[key];
              const todayFlag = isToday(day);
              const osList = osByDay[day] || [];
              const weekend = idx % 7 === 0 || idx % 7 === 6;
              return (
                <div
                  key={day}
                  title={holiday ? `Feriado: ${holiday.name}` : undefined}
                  className={`min-h-[70px] md:min-h-[92px] rounded-lg p-1.5 md:p-2 flex flex-col gap-1 font-data-mono text-xs transition-colors border ${
                    holiday
                      ? 'bg-red-50 border-2 border-[#E63946]/60'
                      : weekend
                      ? 'bg-slate-50/60 border-slate-200 hover:bg-slate-50'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  } ${todayFlag ? 'ring-2 ring-[#1A1A72] ring-offset-1' : ''}`}
                >
                  <div className="flex justify-between items-center">
                    <span className={`font-bold ${holiday ? 'text-[#E63946]' : todayFlag ? 'text-[#1A1A72]' : 'text-slate-700'}`}>
                      {pad2(day)}
                    </span>
                    {todayFlag && (
                      <span className="text-[9px] bg-[#1A1A72] text-white px-1.5 py-0.5 rounded font-bold">HOJE</span>
                    )}
                    {!todayFlag && holiday && (
                      <span className="material-symbols-outlined text-[14px] text-[#E63946]">flag</span>
                    )}
                  </div>

                  {/* Feriado em evidência */}
                  {holiday && (
                    <div className="bg-[#E63946] text-white px-1.5 py-0.5 rounded text-[9px] font-bold leading-tight truncate">
                      {holiday.name}
                    </div>
                  )}

                  {/* OS agendadas no dia */}
                  {osList.slice(0, 2).map((os) => (
                    <div
                      key={os.id}
                      title={`${os.id} — ${os.clientName}: ${os.title}`}
                      className="bg-slate-900 text-white px-1.5 py-0.5 rounded text-[9px] truncate font-medium shadow-sm"
                    >
                      {os.clientName}
                    </div>
                  ))}
                  {osList.length > 2 && (
                    <span className="text-[9px] text-slate-400 font-semibold">+{osList.length - 2} OS</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Feriados do mês — em destaque abaixo do calendário */}
          <div className="mt-5 border-t border-slate-100 pt-4">
            <h4 className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
              <span className="material-symbols-outlined text-base text-[#E63946]">event_busy</span>
              Feriados em {MONTH_NAMES[month]}
            </h4>
            {monthHolidays.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">Nenhum feriado neste mês.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {monthHolidays.map((h) => (
                  <span
                    key={h.day}
                    className="inline-flex items-center gap-1.5 bg-red-50 border border-[#E63946]/40 text-[#E63946] rounded-lg px-2.5 py-1 text-[11px] font-semibold"
                  >
                    <span className="font-data-mono font-bold">{pad2(h.day)}</span>
                    {h.name}
                    <span className="text-[9px] font-bold uppercase bg-white/70 text-[#E63946] rounded px-1.5 py-0.5">{h.type}</span>
                  </span>
                ))}
              </div>
            )}
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
                        <span className="font-bold text-slate-800">R$ {os.value.toLocaleString('pt-BR')}</span>
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
