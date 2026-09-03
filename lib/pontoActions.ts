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

/** Rótulo curto do TIPO da próxima batida (para o texto "Próxima batida"). */
export const PUNCH_SHORT: Record<PunchType, string> = {
  ENTRADA: 'Entrada',
  PAUSA: 'Saída para almoço',
  RETORNO: 'Retorno do almoço',
  SAIDA: 'Saída',
};

export type PunchStatusKind = 'FORA' | 'TRABALHANDO' | 'ALMOCO' | 'ENCERRADA';

export interface PunchDayState {
  /** Batidas de HOJE do funcionário, ordenadas por horário (efetivas). */
  todays: TimePunch[];
  /** Marcas do dia (batidas efetivas — ajustes aprovados já vêm aplicados na fonte). */
  entrada?: TimePunch;
  almoco?: TimePunch;
  retorno?: TimePunch;
  saida?: TimePunch;
  /** Próxima batida esperada (null = jornada encerrada). */
  nextType: PunchType | null;
  statusKind: PunchStatusKind;
  statusLabel: string;
  /** Última marca relevante do dia (para exibição compacta). */
  lastRelevant?: TimePunch;
}

const STATUS_LABEL: Record<PunchStatusKind, string> = {
  FORA: 'Fora do expediente',
  TRABALHANDO: 'Em jornada',
  ALMOCO: 'Em almoço',
  ENCERRADA: 'Jornada encerrada',
};

/**
 * Estado canônico da jornada de HOJE — fonte única consumida por PontoView e
 * pelo Painel do Técnico. NÃO recalcula ponto nem regras de jornada: apenas
 * deriva o estado da sequência a partir das batidas efetivas recebidas.
 */
export function derivePunchState(punches: TimePunch[], employeeName: string, nowMs: number): PunchDayState {
  const todays = punches
    .filter((p) => p.employeeName === employeeName && p.at && sameDay(p.at!, nowMs))
    .sort((a, b) => (a.at || 0) - (b.at || 0));
  const byType = (t: PunchType) => todays.find((p) => p.type === t);
  const entrada = byType('ENTRADA');
  const almoco = byType('PAUSA');
  const retorno = byType('RETORNO');
  const saida = byType('SAIDA');
  const nextType = nextPunchType(punches, employeeName, nowMs);
  const statusKind: PunchStatusKind = !entrada
    ? 'FORA'
    : almoco && !retorno
    ? 'ALMOCO'
    : saida
    ? 'ENCERRADA'
    : 'TRABALHANDO';
  return {
    todays,
    entrada,
    almoco,
    retorno,
    saida,
    nextType,
    statusKind,
    statusLabel: STATUS_LABEL[statusKind],
    lastRelevant: saida || retorno || almoco || entrada,
  };
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
