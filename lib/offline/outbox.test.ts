import { beforeEach, describe, expect, it, vi } from 'vitest';

// idb em memória para exercitar o fluxo real de enqueue/flush sem IndexedDB.
const mem = vi.hoisted(() => ({ store: new Map<string, any>() }));
vi.mock('./idb', () => ({
  STORE_OFFLINE_JOBS: 'offline_jobs',
  idbGetAll: async () => Array.from(mem.store.values()),
  idbUpdate: async (_s: string, id: string, reducer: (c: any) => any) => {
    const next = reducer(mem.store.get(id));
    if (next) mem.store.set(id, next);
    return next;
  },
  idbDelete: async (_s: string, id: string) => { mem.store.delete(id); },
}));

import {
  canProcessJob, enqueueOfflineJob, flushOfflineJobs, getOutboxOwner,
  listOfflineJobs, registerOfflineHandler, setOutboxOwner,
} from './outbox';

beforeEach(() => { mem.store.clear(); setOutboxOwner(undefined); });

describe('outbox — regra pura de ownership', () => {
  it('legado (sem dono) é processável por qualquer sessão', () => {
    expect(canProcessJob({ ownerUserId: undefined }, 'userA')).toBe(true);
    expect(canProcessJob({ ownerUserId: undefined }, undefined)).toBe(true);
  });
  it('job com dono só é processável pelo mesmo usuário', () => {
    expect(canProcessJob({ ownerUserId: 'userA' }, 'userA')).toBe(true);
    expect(canProcessJob({ ownerUserId: 'userA' }, 'userB')).toBe(false);
    expect(canProcessJob({ ownerUserId: 'userA' }, undefined)).toBe(false);
  });
});

describe('outbox — enqueue carimba o dono', () => {
  it('usa o dono corrente quando não informado; preserva ao reenfileirar', async () => {
    setOutboxOwner('userA');
    await enqueueOfflineJob({ domain: 'FIELD_PHOTO', entityClientUuid: 'p1', payload: { n: 1 } });
    expect((await listOfflineJobs())[0].ownerUserId).toBe('userA');
    // Reenfileirar a mesma entidade com outro usuário logado preserva o dono original.
    setOutboxOwner('userB');
    await enqueueOfflineJob({ domain: 'FIELD_PHOTO', entityClientUuid: 'p1', payload: { n: 2 } });
    const jobs = await listOfflineJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].ownerUserId).toBe('userA');
  });
  it('dono explícito vence o dono corrente (ex.: técnico da sessão de fotos)', async () => {
    setOutboxOwner('userB');
    await enqueueOfflineJob({ domain: 'FIELD_PHOTO', entityClientUuid: 'p2', payload: {}, ownerUserId: 'userA' });
    expect((await listOfflineJobs())[0].ownerUserId).toBe('userA');
  });
});

describe('outbox — flush não sincroniza trabalho de outro usuário', () => {
  it('processa os próprios jobs e os legados; ignora (sem apagar) os de outro dono', async () => {
    const processed: string[] = [];
    registerOfflineHandler('FIELD_PHOTO', async (job) => { processed.push(job.entityClientUuid); });

    // Job legado (sem dono): criado quando não há dono corrente.
    setOutboxOwner(undefined);
    await enqueueOfflineJob({ domain: 'FIELD_PHOTO', entityClientUuid: 'legado', payload: {} });
    // Jobs com dono explícito.
    await enqueueOfflineJob({ domain: 'FIELD_PHOTO', entityClientUuid: 'doB', payload: {}, ownerUserId: 'userB' });
    await enqueueOfflineJob({ domain: 'FIELD_PHOTO', entityClientUuid: 'doA', payload: {}, ownerUserId: 'userA' });

    // Sessão do usuário B sincroniza.
    setOutboxOwner('userB');
    const res = await flushOfflineJobs(() => true);

    expect(processed.sort()).toEqual(['doB', 'legado']); // não tocou no 'doA'
    expect(res.synced).toBe(2);
    // O job do usuário A permanece pendente no armazenamento (não foi apagado).
    const remaining = await listOfflineJobs();
    expect(remaining.map((j) => j.entityClientUuid)).toEqual(['doA']);
    expect(remaining[0].status).toBe('PENDING');
    expect(getOutboxOwner()).toBe('userB');
  });
});
