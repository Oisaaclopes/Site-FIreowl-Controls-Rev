import { beforeEach, describe, expect, it, vi } from 'vitest';

const fx = vi.hoisted(() => ({ listOfflineJobs: vi.fn() }));

// Dependências pesadas isoladas: só exercitamos os helpers puros/de leitura.
vi.mock('../fieldPhotos', () => ({}));
vi.mock('../fieldPhotoStorage', () => ({}));
vi.mock('../fieldPhotoEvidence', () => ({}));
vi.mock('../fieldPhotoComparisons', () => ({}));
vi.mock('../fieldPhotoGeo', () => ({}));
vi.mock('./outbox', () => ({
  registerOfflineHandler: vi.fn(),
  enqueueOfflineJob: vi.fn(),
  getOutboxOwner: vi.fn(),
  canProcessJob: () => true,
  listOfflineJobs: fx.listOfflineJobs,
}));

import { fieldPhotoJobStates, friendlyFieldPhotoSyncError } from './fieldPhotoSync';

const job = (uuid: string, status: string, lastError?: string, attempts = 0) => ({
  id: `FIELD_PHOTO:${uuid}`, domain: 'FIELD_PHOTO', entityClientUuid: uuid, status, lastError, attempts,
});

beforeEach(() => { fx.listOfflineJobs.mockReset(); });

describe('fieldPhotoJobStates', () => {
  it('mapeia apenas as fotos pedidas que ainda estão na outbox', async () => {
    fx.listOfflineJobs.mockResolvedValue([
      job('a', 'ERROR', 'row-level security violation', 2),
      job('b', 'PENDING'),
      job('c', 'PENDING'),
    ]);
    const states = await fieldPhotoJobStates(['a', 'b', 'z']);
    expect(states.get('a')).toEqual({ status: 'ERROR', lastError: 'row-level security violation', attempts: 2 });
    expect(states.get('b')?.status).toBe('PENDING');
    // 'z' não está na fila (saiu = sincronizada) e 'c' não foi pedida.
    expect(states.has('z')).toBe(false);
    expect(states.has('c')).toBe(false);
  });

  it('não consulta a outbox quando não há fotos', async () => {
    const states = await fieldPhotoJobStates([]);
    expect(states.size).toBe(0);
    expect(fx.listOfflineJobs).not.toHaveBeenCalled();
  });
});

describe('friendlyFieldPhotoSyncError', () => {
  it('traduz falha de RLS/permissão para orientação de escopo', () => {
    expect(friendlyFieldPhotoSyncError('new row violates row-level security policy')).toMatch(/acesso a Fotos de Campo/i);
    expect(friendlyFieldPhotoSyncError('403 not authorized')).toMatch(/administrador/i);
  });
  it('traduz falha de rede preservando a promessa de reenvio', () => {
    expect(friendlyFieldPhotoSyncError('Failed to fetch (network)')).toMatch(/reenviada automaticamente/i);
  });
  it('mensagem genérica não afirma sucesso', () => {
    const msg = friendlyFieldPhotoSyncError(undefined);
    expect(msg).toMatch(/tentado novamente/i);
    expect(msg).not.toMatch(/sincroniz/i);
  });
});
