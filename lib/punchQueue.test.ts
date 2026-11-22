import { describe, expect, it } from 'vitest';
import { enqueuePunch, isPunchSynced, mergeWithQueued, readPunchQueue, removeQueuedPunch } from './punchQueue';
import { TimePunch } from './types';

const memStorage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
};

const punch = (over: Partial<TimePunch>): TimePunch => ({
  id: 'p_1', userId: 'u1', employeeName: 'Ana', timestamp: '', type: 'ENTRADA',
  locationStr: '', lat: 0, lng: 0, status: 'APROVADO', at: 1_700_000_000_000, ...over,
});

describe('punchQueue', () => {
  it('enfileira por usuário e remove após envio', () => {
    const s = memStorage();
    enqueuePunch('u1', punch({}), s);
    enqueuePunch('u2', punch({ id: 'p_2', userId: 'u2' }), s);
    expect(readPunchQueue('u1', s).map((p) => p.id)).toEqual(['p_1']);
    expect(readPunchQueue('u1', s)[0].pendingSync).toBe(true);
    removeQueuedPunch('u1', 'p_1', s);
    expect(readPunchQueue('u1', s)).toEqual([]);
    expect(readPunchQueue('u2', s)).toHaveLength(1);
  });

  it('não duplica o mesmo id na fila', () => {
    const s = memStorage();
    enqueuePunch('u1', punch({}), s);
    enqueuePunch('u1', punch({}), s);
    expect(readPunchQueue('u1', s)).toHaveLength(1);
  });

  it('reconhece a batida já gravada no servidor (mesmo tipo/instante/dono)', () => {
    const q = punch({});
    expect(isPunchSynced(q, [punch({ id: '99', at: q.at! + 300 })])).toBe(true);
    expect(isPunchSynced(q, [punch({ id: '99', type: 'SAIDA' })])).toBe(false);
    expect(isPunchSynced(q, [punch({ id: '99', userId: 'u2' })])).toBe(false);
    expect(isPunchSynced(q, [punch({ id: '99', at: q.at! + 60_000 })])).toBe(false);
  });

  it('mantém pendentes visíveis após recarga e descarta as já sincronizadas', () => {
    const server = [punch({ id: '10', at: 1_700_000_100_000, type: 'SAIDA' })];
    const queued = [punch({ id: 'p_a' }), punch({ id: 'p_b', type: 'SAIDA', at: 1_700_000_100_200 })];
    const merged = mergeWithQueued(server, queued);
    expect(merged.map((p) => p.id)).toEqual(['10', 'p_a']);
    expect(merged.find((p) => p.id === 'p_a')?.pendingSync).toBe(true);
  });
});
