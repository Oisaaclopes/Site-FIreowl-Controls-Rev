import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ surveys: vi.fn(), devices: vi.fn(), checks: vi.fn(), jobs: vi.fn(), photos: vi.fn(), signed: vi.fn(), write: vi.fn() }));
vi.mock('./technicalSurveys', () => ({ fetchSurveys: api.surveys, upsertSurvey: api.write, finalizeSurvey: api.write }));
vi.mock('./devices', () => ({ fetchDevices: api.devices, upsertDevice: api.write }));
vi.mock('./deviceVerifications', () => ({ fetchVerificationsForSurvey: api.checks, addVerification: api.write }));
vi.mock('./offline/outbox', () => ({ listOfflineJobs: api.jobs, enqueueOfflineJob: api.write }));
vi.mock('./fieldPhotos', () => ({ listFieldPhotosBySession: api.photos, createFieldPhotoSession: api.write }));
vi.mock('./fieldPhotoStorage', () => ({ signedFieldPhotoUrls: api.signed }));
vi.mock('./supabaseClient', () => ({ getSupabaseClient: () => { throw new Error('No unexpected database query'); } }));
import { restoreSurveyNavigation } from './surveyNavigation';

const input = { id: 's1', clientId: 'c1', area: 'SDAI', owner: 'A' };
const device = { id: 'd1', clienteId: 'c1', sourceSurveyId: 's1', modelo: 'saved' };
beforeEach(() => {
  vi.clearAllMocks();
  api.surveys.mockResolvedValue([{ id: 's1', clienteId: 'c1', area: 'SDAI', mode: 'COMPLETO', status: 'EM_ANDAMENTO' }]);
  api.devices.mockResolvedValue([device]); api.checks.mockResolvedValue([]); api.jobs.mockResolvedValue([]);
  api.photos.mockResolvedValue([]); api.signed.mockResolvedValue({});
});

describe('survey restoration reads canonical data and existing outbox', () => {
  it('reopens the same survey and mode without creating anything', async () => {
    const restored = await restoreSurveyNavigation(input);
    expect(restored?.survey).toMatchObject({ id: 's1', mode: 'COMPLETO' });
    expect(api.surveys).toHaveBeenCalledWith('c1', 'SDAI');
    expect(api.write).not.toHaveBeenCalled();
  });
  it('merges the saved offline equipment by ID, never duplicating it', async () => {
    api.jobs.mockResolvedValue([{ domain: 'TECH_ASSET', ownerUserId: 'A', payload: { device: { ...device, modelo: 'offline' }, verification: { id: 'v1', deviceId: 'd1', surveyId: 's1', reconciliation: 'NOVO' } } }]);
    const restored = await restoreSurveyNavigation(input);
    expect(restored?.devices).toEqual([{ ...device, modelo: 'offline' }]);
    expect(restored?.verifications).toHaveLength(1);
    expect(api.write).not.toHaveBeenCalled();
  });
  it('never reads another user draft into the restored equipment', async () => {
    api.jobs.mockResolvedValue([{ domain: 'TECH_ASSET', ownerUserId: 'B', payload: { device: { ...device, modelo: 'private' } } }]);
    expect((await restoreSurveyNavigation(input))?.devices).toEqual([device]);
  });
  it.each(['FINALIZADO', 'CANCELADO'])('does not reopen %s', async (status) => {
    api.surveys.mockResolvedValue([{ id: 's1', status }]);
    expect(await restoreSurveyNavigation(input)).toBeNull();
    expect(api.devices).not.toHaveBeenCalled();
  });
  it('missing or inaccessible survey has no descendant reads', async () => {
    api.surveys.mockResolvedValue([]);
    expect(await restoreSurveyNavigation(input)).toBeNull();
    expect(api.jobs).not.toHaveBeenCalled();
  });
  it('reuses the photo session and blobs in the outbox without enqueueing', async () => {
    const session = { id: 'f1', clientId: 'c1', tecnicoId: 'A' };
    const blob = new Blob(['photo']);
    api.jobs.mockResolvedValue([{ domain: 'FIELD_PHOTO', ownerUserId: 'A', payload: { session, original: blob, photo: { deviceId: 'd1', technicalSurveyId: 's1', clientId: 'c1', clientUuid: 'photo1' } } }]);
    const restored = await restoreSurveyNavigation({ ...input, sessionId: 'f1' });
    expect(restored?.session).toEqual(session);
    expect(restored?.previews.d1).toHaveLength(1);
    expect(api.write).not.toHaveBeenCalled();
    restored?.localUrls.forEach((url) => URL.revokeObjectURL(url));
  });
});
