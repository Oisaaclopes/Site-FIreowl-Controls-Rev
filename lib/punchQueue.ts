// Fila local de batidas de ponto que NÃO chegaram ao servidor (sem internet,
// rede instável, timeout). Antes, a batida caía num localStorage que nunca era
// reenviado e sumia da tela na próxima recarga — "falso sucesso". Agora:
//  - a batida fica na fila (por usuário) e continua visível como pendente;
//  - a cada recarga autorizada a fila é conciliada com o servidor (se a batida
//    já chegou, é descartada — evita duplicar) e o restante é reenviado com o
//    HORÁRIO ORIGINAL da batida (punched_at = momento do clique).

import { TimePunch } from './types';

const KEY_PREFIX = 'fireowl_punch_queue:';
/** Tolerância para reconhecer a mesma batida já gravada no servidor. */
const SAME_PUNCH_MS = 1000;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const safeStorage = (): StorageLike | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

const keyOf = (owner: string | undefined) => `${KEY_PREFIX}${owner || 'anon'}`;

export function readPunchQueue(owner: string | undefined, storage: StorageLike | null = safeStorage()): TimePunch[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(keyOf(owner));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((p) => p && p.id && p.type && typeof p.at === 'number') : [];
  } catch {
    return [];
  }
}

function writePunchQueue(owner: string | undefined, list: TimePunch[], storage: StorageLike | null): void {
  if (!storage) return;
  try {
    if (list.length) storage.setItem(keyOf(owner), JSON.stringify(list));
    else storage.removeItem(keyOf(owner));
  } catch {
    /* armazenamento indisponível/cheio — a batida segue apenas em memória */
  }
}

export function enqueuePunch(owner: string | undefined, punch: TimePunch, storage: StorageLike | null = safeStorage()): void {
  const list = readPunchQueue(owner, storage).filter((p) => p.id !== punch.id);
  writePunchQueue(owner, [...list, { ...punch, pendingSync: true }], storage);
}

export function removeQueuedPunch(owner: string | undefined, id: string, storage: StorageLike | null = safeStorage()): void {
  writePunchQueue(owner, readPunchQueue(owner, storage).filter((p) => p.id !== id), storage);
}

/** A batida da fila já está no servidor (mesmo tipo, mesmo instante, mesmo dono)? */
export function isPunchSynced(queued: TimePunch, serverRows: TimePunch[]): boolean {
  return serverRows.some((r) =>
    !r.pendingSync
    && r.type === queued.type
    && r.at != null && queued.at != null
    && Math.abs(r.at - queued.at) < SAME_PUNCH_MS
    && (!queued.userId || !r.userId || r.userId === queued.userId));
}

/** Linhas do servidor + batidas ainda pendentes de envio (sem duplicar), mais recentes primeiro. */
export function mergeWithQueued(serverRows: TimePunch[], queued: TimePunch[]): TimePunch[] {
  const pending = queued
    .filter((q) => !isPunchSynced(q, serverRows))
    .map((q) => ({ ...q, pendingSync: true }));
  if (!pending.length) return serverRows;
  return [...serverRows, ...pending].sort((a, b) => (b.at || 0) - (a.at || 0));
}
