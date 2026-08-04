'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { TimePunch } from '@/lib/types';
import { DataListRow, Badge } from '@/components/DataListRow';

interface PontoViewProps {
  punches: TimePunch[];
  onAddPunch: (punch: TimePunch) => void;
  currentUser?: string;
}

// Escala fixa (poderia vir do cadastro do funcionário)
const SCALE = { start: '08:00', end: '17:48', lunchStart: '12:00', lunchEnd: '13:00' };

type PunchType = TimePunch['type'];

const NEXT_INFO: Record<PunchType, { label: string; icon: string; classes: string }> = {
  ENTRADA: { label: 'Registrar Entrada', icon: 'login', classes: 'bg-emerald-600 hover:bg-emerald-700' },
  PAUSA: { label: 'Registrar Saída para Almoço', icon: 'restaurant', classes: 'bg-amber-500 hover:bg-amber-600' },
  RETORNO: { label: 'Registrar Retorno', icon: 'login', classes: 'bg-[#1A1A72] hover:bg-[#12124f]' },
  SAIDA: { label: 'Registrar Saída', icon: 'logout', classes: 'bg-[#E63946] hover:bg-[#a51515]' },
};

const FEEDBACK_LABEL: Record<PunchType, string> = {
  ENTRADA: 'Entrada registrada',
  PAUSA: 'Saída para almoço registrada',
  RETORNO: 'Retorno registrado',
  SAIDA: 'Saída registrada',
};

const pad2 = (n: number) => n.toString().padStart(2, '0');
const fmtClock = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
const fmtHM = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();
const fmtDuration = (ms: number) => {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  return `${pad2(Math.floor(totalMin / 60))}h${pad2(totalMin % 60)}min`;
};
const friendlyDate = (d: Date) =>
  d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });

export const PontoView: React.FC<PontoViewProps> = ({ punches, onAddPunch, currentUser = 'Operador Fireowl' }) => {
  const [now, setNow] = useState(() => new Date());
  const [punching, setPunching] = useState(false);
  const [feedback, setFeedback] = useState<{ label: string; time: string } | null>(null);
  const [online, setOnline] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [showEspelho, setShowEspelho] = useState(false);

  // Relógio em tempo real
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Indicador de sincronização (online/offline)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  // Batidas de HOJE do usuário logado (apenas registros com epoch)
  const nowMs = now.getTime();
  const todays = useMemo(
    () =>
      punches
        .filter((p) => p.employeeName === currentUser && p.at && sameDay(p.at, nowMs))
        .sort((a, b) => (a.at || 0) - (b.at || 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [punches, currentUser, new Date(nowMs).toDateString()]
  );

  const byType = (t: PunchType) => todays.find((p) => p.type === t);
  const entrada = byType('ENTRADA');
  const almoco = byType('PAUSA');
  const retorno = byType('RETORNO');
  const saida = byType('SAIDA');

  // Próxima batida da sequência
  const nextType: PunchType | null = !entrada
    ? 'ENTRADA'
    : !almoco
    ? 'PAUSA'
    : !retorno
    ? 'RETORNO'
    : !saida
    ? 'SAIDA'
    : null;

  // Horas trabalhadas (manhã + tarde)
  let workedMs = 0;
  if (entrada?.at) {
    const aEnd = almoco?.at ?? saida?.at ?? nowMs;
    workedMs += Math.max(0, aEnd - entrada.at);
  }
  if (retorno?.at) {
    const bEnd = saida?.at ?? nowMs;
    workedMs += Math.max(0, bEnd - retorno.at);
  }

  // Status da jornada
  const status = !entrada
    ? { label: 'Fora do expediente', dot: 'bg-blue-500', badge: 'blue' as const }
    : almoco && !retorno
    ? { label: 'Em almoço', dot: 'bg-amber-500', badge: 'amber' as const }
    : saida
    ? { label: 'Jornada encerrada', dot: 'bg-slate-400', badge: 'slate' as const }
    : { label: 'Trabalhando', dot: 'bg-emerald-500', badge: 'emerald' as const };

  const punchTime = (p?: TimePunch) => (p?.at ? fmtHM(new Date(p.at)) : '--');

  const handleBaterPonto = () => {
    if (punching || !nextType) return;
    setPunching(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => registerPunch(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
        () => registerPunch(-23.2981, -51.1434, undefined),
        { timeout: 3000, enableHighAccuracy: true }
      );
    } else {
      registerPunch(-23.2981, -51.1434, undefined);
    }
  };

  const registerPunch = (lat: number, lng: number, accuracy?: number) => {
    if (!nextType) {
      setPunching(false);
      return;
    }
    const d = new Date();
    const newPunch: TimePunch = {
      id: `p_${Date.now()}`,
      employeeName: currentUser,
      timestamp: `${d.getDate()} ${d.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()} ${d.getFullYear()} | ${fmtClock(d)}`,
      type: nextType,
      locationStr: `Catuaí Shopping — Londrina/PR (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      lat,
      lng,
      status: 'APROVADO',
      at: d.getTime(),
      accuracy: accuracy ? Math.round(accuracy) : undefined,
    };
    onAddPunch(newPunch);
    setLastSync(d);
    setFeedback({ label: FEEDBACK_LABEL[nextType], time: fmtClock(d) });
    setPunching(false);
    setTimeout(() => setFeedback(null), 2000);
  };

  const mapsUrl = (p: TimePunch) => `https://www.google.com/maps?q=${p.lat},${p.lng}`;

  // Estimativas da semana (ilustrativas — dependem de histórico persistido)
  const week = { previstas: '44h', realizadas: '31h', extras: '2h15', banco: '+1h48', atrasos: 0 };

  const shortcut = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="flex flex-col w-full p-8 gap-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Conformidade Trabalhista (Portaria MTP 671/2021)
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Ponto Eletrônico &amp; Espelho de Frequência
          </h1>
        </div>

        {/* Relógio grande + sincronização */}
        <div className="text-right">
          <p className="font-data-mono text-3xl font-bold text-slate-900 tabular-nums leading-none">{fmtClock(now)}</p>
          <div className="flex items-center justify-end gap-3 mt-1.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Horário oficial</span>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase ${
                online ? 'text-emerald-600' : 'text-amber-600'
              }`}
              title={
                online
                  ? lastSync
                    ? `Última sincronização ${fmtClock(lastSync)}`
                    : 'Conectado'
                  : 'Sem conexão — registros ficam salvos localmente'
              }
            >
              <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {online ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Atalhos rápidos */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'card-jornada', label: 'Registrar', icon: 'touch_app' },
          { id: 'card-timeline', label: 'Histórico', icon: 'timeline' },
          { id: 'card-banco', label: 'Banco de Horas', icon: 'savings' },
          { id: 'card-registros', label: 'Registros', icon: 'fact_check' },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => shortcut(s.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-[#1A1A72] hover:text-[#1A1A72] text-xs font-semibold transition-colors"
          >
            <span className="material-symbols-outlined text-base">{s.icon}</span>
            {s.label}
          </button>
        ))}
        <button
          onClick={() => setShowEspelho(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A1A72] text-white hover:bg-[#12124f] text-xs font-semibold transition-colors ml-auto"
        >
          <span className="material-symbols-outlined text-base">description</span>
          Meu Espelho
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ===== Card da Jornada + Botão inteligente ===== */}
        <div id="card-jornada" className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6 relative overflow-hidden">
          {/* Feedback pós-batida */}
          {feedback && (
            <div className="absolute inset-0 z-20 bg-white/95 flex flex-col items-center justify-center gap-2 animate-[fadeIn_0.15s_ease-out]">
              <span className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl">check</span>
              </span>
              <p className="font-bold text-slate-900">{feedback.label}</p>
              <p className="font-data-mono text-lg text-slate-700">{feedback.time}</p>
              <p className="text-xs text-emerald-600 font-semibold">Bom trabalho!</p>
            </div>
          )}

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-bold text-slate-900">
                {greeting}, <span className="text-[#1A1A72]">{currentUser}</span> 👋
              </p>
              <p className="text-xs text-slate-500 capitalize mt-0.5">{friendlyDate(now)}</p>
            </div>
            <Badge color={status.badge}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot} inline-block mr-1`} />
              {status.label}
            </Badge>
          </div>

          {/* Marcos da jornada */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {[
              { label: 'Entrada', p: entrada },
              { label: 'Almoço', p: almoco },
              { label: 'Retorno', p: retorno },
              { label: 'Saída', p: saida },
            ].map((slot) => (
              <div key={slot.label} className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">{slot.label}</p>
                <p className={`font-data-mono text-lg font-bold mt-0.5 ${slot.p ? 'text-slate-900' : 'text-slate-300'}`}>
                  {punchTime(slot.p)}
                </p>
              </div>
            ))}
          </div>

          {/* Previsto x trabalhado */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-xs">
            <span className="text-slate-500">
              Jornada prevista: <strong className="text-slate-800 font-data-mono">{SCALE.start} às {SCALE.end}</strong>
            </span>
            <span className="text-slate-500">
              Horas trabalhadas: <strong className="text-[#1A1A72] font-data-mono">{fmtDuration(workedMs)}</strong>
            </span>
          </div>

          {/* Botão inteligente */}
          <button
            onClick={handleBaterPonto}
            disabled={punching || !nextType}
            className={`mt-5 w-full rounded-2xl py-6 text-white font-bold uppercase tracking-wider text-sm transition-all shadow-md flex flex-col items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70 ${
              nextType ? NEXT_INFO[nextType].classes : 'bg-slate-400'
            }`}
          >
            <span className={`material-symbols-outlined text-4xl ${punching ? 'animate-spin' : ''}`}>
              {punching ? 'progress_activity' : nextType ? NEXT_INFO[nextType].icon : 'task_alt'}
            </span>
            {punching ? 'Registrando...' : nextType ? NEXT_INFO[nextType].label : 'Jornada encerrada'}
          </button>

          <p className="text-[10px] text-slate-400 mt-3 text-center flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-sm">location_on</span>
            Localização e coordenadas GPS sincronizadas · MTP 671/2021
          </p>
        </div>

        {/* ===== Coluna lateral: Escala + Semana + Banco ===== */}
        <div className="flex flex-col gap-6">
          {/* Escala */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Sua escala</h4>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-500">Seg a Sex</span>
              <span className="font-data-mono font-bold text-slate-900">{SCALE.start} às {SCALE.end}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Almoço</span>
              <span className="font-data-mono font-bold text-slate-900">{SCALE.lunchStart} às {SCALE.lunchEnd}</span>
            </div>
          </div>

          {/* Resumo da semana */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Esta semana</h4>
            <div className="space-y-2 text-xs">
              {[
                { k: 'Horas previstas', v: week.previstas, c: 'text-slate-900' },
                { k: 'Horas realizadas', v: week.realizadas, c: 'text-[#1A1A72]' },
                { k: 'Horas extras', v: week.extras, c: 'text-emerald-600' },
                { k: 'Atrasos', v: String(week.atrasos), c: 'text-slate-900' },
              ].map((r) => (
                <div key={r.k} className="flex items-center justify-between">
                  <span className="text-slate-500">{r.k}</span>
                  <span className={`font-data-mono font-bold ${r.c}`}>{r.v}</span>
                </div>
              ))}
            </div>
            <p className="text-[9px] text-slate-400 mt-2">* estimativa — requer histórico persistido</p>
          </div>

          {/* Banco de horas */}
          <div id="card-banco" className="bg-[#1A1A72] text-white rounded-xl shadow-sm p-5">
            <h4 className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Banco de horas</h4>
            <p className="font-data-mono text-3xl font-bold text-emerald-300 mt-1">{week.banco}</p>
            <p className="text-[10px] text-white/60 mt-1">Último fechamento: 31/07</p>
          </div>
        </div>
      </div>

      {/* ===== Timeline de hoje ===== */}
      <div id="card-timeline" className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Hoje</h3>
        {todays.length === 0 ? (
          <p className="text-xs text-slate-400">Nenhuma batida registrada hoje.</p>
        ) : (
          <ol className="relative border-l-2 border-slate-100 ml-2 space-y-4">
            {todays.map((p) => (
              <li key={p.id} className="ml-4 relative">
                <span className="absolute -left-[1.42rem] top-1 w-3 h-3 rounded-full bg-[#1A1A72] ring-4 ring-white" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-data-mono font-bold text-slate-900">{p.at ? fmtHM(new Date(p.at)) : '--'}</p>
                    <p className="text-[11px] text-slate-500">
                      {p.type === 'ENTRADA'
                        ? 'Entrada'
                        : p.type === 'PAUSA'
                        ? 'Saída para almoço'
                        : p.type === 'RETORNO'
                        ? 'Retorno'
                        : 'Saída'}
                    </p>
                  </div>
                  <a
                    href={mapsUrl(p)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-[#1A1A72] font-semibold hover:underline flex items-center gap-0.5"
                  >
                    <span className="material-symbols-outlined text-sm">map</span> ver no mapa
                  </a>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* ===== Registros recentes ===== */}
      <div id="card-registros">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Registros recentes de frequência</h3>
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
                  <>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-slate-400">location_on</span>
                      Catuaí Shopping · Londrina/PR
                    </span>
                    {p.accuracy ? <span className="text-slate-400">Precisão ~{p.accuracy}m</span> : null}
                    <a
                      href={mapsUrl(p)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#1A1A72] font-semibold hover:underline"
                    >
                      ver no mapa
                    </a>
                  </>
                }
                center={
                  <div className="text-left md:text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Data &amp; hora</p>
                    <p className="font-data-mono text-slate-700 font-semibold">{p.timestamp}</p>
                  </div>
                }
                right={
                  <>
                    <Badge color={p.type === 'ENTRADA' ? 'emerald' : p.type === 'PAUSA' ? 'amber' : p.type === 'SAIDA' ? 'red' : 'blue'}>
                      {p.type}
                    </Badge>
                    <Badge color={p.status === 'APROVADO' ? 'emerald' : p.status === 'PENDENTE' ? 'amber' : 'blue'} outline>
                      MTP 671: {p.status}
                    </Badge>
                  </>
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal Meu Espelho de Ponto */}
      {showEspelho && (
        <div className="fixed inset-0 z-50 bg-[#1A1A72]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-xl w-full rounded-xl border border-slate-200 p-6 shadow-2xl relative">
            <button onClick={() => setShowEspelho(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold text-xl">
              ✕
            </button>
            <h3 className="font-display text-lg font-bold text-[#1A1A72] uppercase mb-4">Meu Espelho de Ponto</h3>
            <div className="font-data-mono text-xs space-y-2.5 bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
              <div><strong className="text-slate-900">NOME:</strong> {currentUser}</div>
              <div><strong className="text-slate-900">PERÍODO:</strong> 01 A 31 (mês atual)</div>
              <div><strong className="text-slate-900">JORNADA:</strong> {SCALE.start} às {SCALE.end} (almoço {SCALE.lunchStart}–{SCALE.lunchEnd})</div>
              <div><strong className="text-slate-900">BANCO DE HORAS:</strong> {week.banco}</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  window.print();
                  setShowEspelho(false);
                }}
                className="flex-1 bg-[#E63946] hover:bg-[#a51515] text-white font-semibold py-2.5 rounded-lg text-xs uppercase"
              >
                Imprimir / PDF
              </button>
              <button
                onClick={() => setShowEspelho(false)}
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
