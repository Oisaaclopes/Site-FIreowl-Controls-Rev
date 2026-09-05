import { beforeEach, describe, expect, it, vi } from 'vitest';

const fx = vi.hoisted(() => ({
  enqueueOfflineJob: vi.fn(),
  registerOfflineHandler: vi.fn(),
  listOfflineJobs: vi.fn(),
  upsertDevice: vi.fn(),
  addVerification: vi.fn(),
}));

vi.mock('./outbox', () => ({
  enqueueOfflineJob: fx.enqueueOfflineJob,
  registerOfflineHandler: fx.registerOfflineHandler,
  listOfflineJobs: fx.listOfflineJobs,
  getOutboxOwner: () => undefined,
  canProcessJob: () => true,
}));
vi.mock('../devices', () => ({ upsertDevice: fx.upsertDevice }));
vi.mock('../deviceVerifications', () => ({ addVerification: fx.addVerification }));

import { enqueueTechAsset } from './technicalBaseSync';

// Captura o handler registrado no IMPORT (antes de qualquer reset de mock).
const techHandlerCall = fx.registerOfflineHandler.mock.calls.find((c) => c[0] === 'TECH_ASSET');
const techHandler = techHandlerCall?.[1] as (job: any) => Promise<void>;

const device = (id: string) => ({ id, clienteId: 'c1', sistema: 'SDAI', status: 'ativo', technicalAttributes: {} } as any);

// Não reseta registerOfflineHandler (registro acontece só uma vez, no import).
beforeEach(() => { fx.enqueueOfflineJob.mockReset(); fx.upsertDevice.mockReset(); fx.addVerification.mockReset(); fx.listOfflineJobs.mockReset(); });

describe('enqueueTechAsset — chave estável para replay idempotente (§16)', () => {
  it('usa device.id como entityClientUuid e domínio TECH_ASSET', async () => {
    await enqueueTechAsset({ device: device('dev-1') });
    expect(fx.enqueueOfflineJob).toHaveBeenCalledTimes(1);
    const arg = fx.enqueueOfflineJob.mock.calls[0][0];
    expect(arg.domain).toBe('TECH_ASSET');
    expect(arg.entityClientUuid).toBe('dev-1');
  });

  it('reenfileirar o mesmo ativo coalesce na MESMA chave (não duplica)', async () => {
    await enqueueTechAsset({ device: device('dev-9') });
    await enqueueTechAsset({ device: device('dev-9') });
    const keys = fx.enqueueOfflineJob.mock.calls.map((c) => c[0].entityClientUuid);
    expect(new Set(keys).size).toBe(1);
  });
});

describe('handler TECH_ASSET — upsert do ativo antes da verificação', () => {
  it('registra o handler no import e ele faz upsert (idempotente) + verificação', async () => {
    expect(techHandler).toBeTruthy();
    const handler = techHandler;
    const order: string[] = [];
    fx.upsertDevice.mockImplementation(async () => { order.push('device'); });
    fx.addVerification.mockImplementation(async () => { order.push('verification'); });
    await handler({ payload: { device: device('dev-2'), verification: { id: 'v1', deviceId: 'dev-2', condicao: 'NORMAL' } } });
    expect(order).toEqual(['device', 'verification']);
    expect(fx.upsertDevice).toHaveBeenCalledWith(expect.objectContaining({ id: 'dev-2' }));
  });

  it('sem verificação, só faz upsert do ativo', async () => {
    const handler = techHandler;
    fx.upsertDevice.mockResolvedValue(undefined);
    await handler({ payload: { device: device('dev-3') } });
    expect(fx.upsertDevice).toHaveBeenCalledTimes(1);
    expect(fx.addVerification).not.toHaveBeenCalled();
  });
});
