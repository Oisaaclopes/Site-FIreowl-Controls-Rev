// Motor compartilhado de registro de ponto — a MESMA regra usada no PontoView,
// extraída para reuso (Dashboard do técnico). NÃO é um segundo motor: o
// PontoView e o TechDashboard consomem estas funções; a persistência continua
// sendo o onAddPunch (handleAddPunch no CrmApp → insertPunch).

import { TimePunch } from './types';

export type PunchType = TimePunch['type'];

const pad2 = (n: number) => n.toString().padStart(2, '0');
const fmtClock = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

export const PUNCH_LABEL: Record<PunchType, string> = {
  ENTRADA: 'Registrar Entrada',
  PAUSA: 'Registrar Saída para Almoço',
  RETORNO: 'Registrar Retorno',
  SAIDA: 'Registrar Saída',
};

export const PUNCH_DONE: Record<PunchType, string> = {
  ENTRADA: 'Entrada registrada',
  PAUSA: 'Saída para almoço registrada',
  RETORNO: 'Retorno registrado',
  SAIDA: 'Saída registrada',
};

/** Próxima batida da sequência ENTRADA→PAUSA→RETORNO→SAIDA para HOJE. */
export function nextPunchType(punches: TimePunch[], employeeName: string, nowMs: number): PunchType | null {
  const todays = punches.filter((p) => p.employeeName === employeeName && p.at && sameDay(p.at!, nowMs));
  const has = (t: PunchType) => todays.some((p) => p.type === t);
  return !has('ENTRADA') ? 'ENTRADA' : !has('PAUSA') ? 'PAUSA' : !has('RETORNO') ? 'RETORNO' : !has('SAIDA') ? 'SAIDA' : null;
}

/** Constrói a batida (mesma estrutura do PontoView). Não inventa localização. */
export function buildPunch(
  type: PunchType,
  employeeName: string,
  coords?: { lat: number; lng: number; accuracy?: number }
): TimePunch {
  const d = new Date();
  const hasGps = !!coords;
  return {
    id: `p_${Date.now()}`,
    employeeName,
    timestamp: `${d.getDate()} ${d.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()} ${d.getFullYear()} | ${fmtClock(d)}`,
    type,
    locationStr: hasGps ? `${coords!.lat.toFixed(6)}, ${coords!.lng.toFixed(6)}` : 'Sem localização (GPS indisponível)',
    lat: hasGps ? coords!.lat : 0,
    lng: hasGps ? coords!.lng : 0,
    status: 'APROVADO',
    at: d.getTime(),
    accuracy: hasGps && coords!.accuracy ? Math.round(coords!.accuracy) : undefined,
  };
}

/**
 * Captura a posição (mesma config do PontoView: alta precisão, 15s). A permissão
 * de GPS é pedida SOMENTE aqui (no clique de bater ponto). Resolve null se
 * indisponível/negado — o chamador registra sem localização (não inventa).
 */
export function capturePunchPosition(): Promise<{ lat: number; lng: number; accuracy?: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}
