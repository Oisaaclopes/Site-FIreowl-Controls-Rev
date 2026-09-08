import { beforeEach, describe, expect, it, vi } from 'vitest';

const fx = vi.hoisted(() => ({
  createReport: vi.fn(), fetchReportByClientUuid: vi.fn(), resetChildren: vi.fn(),
  updateReport: vi.fn(), upsertAnswer: vi.fn(), insertMedia: vi.fn(), attachSnapshot: vi.fn(),
  uploadPhoto: vi.fn(), uploadSignature: vi.fn(), insertSignature: vi.fn(),
  fetchPendencias: vi.fn(), insertPendencia: vi.fn(), replaceRequirements: vi.fn(),
  upsertOccurrence: vi.fn(), createOrReusePendencia: vi.fn(),
  idbGet: vi.fn(), idbPut: vi.fn(), idbDelete: vi.fn(), removeOfflineJob: vi.fn(),
}));

vi.mock('../reports', () => ({
  createReport: fx.createReport, fetchReportByClientUuid: fx.fetchReportByClientUuid,
  resetIncompleteReportChildren: fx.resetChildren, updateReport: fx.updateReport,
  upsertAnswer: fx.upsertAnswer, insertMedia: fx.insertMedia, attachTemplateSnapshot: fx.attachSnapshot,
}));
vi.mock('../reportMedia', () => ({ uploadReportPhoto: fx.uploadPhoto }));
vi.mock('../signatures', () => ({ uploadSignaturePng: fx.uploadSignature, insertSignature: fx.insertSignature }));
vi.mock('../pendencias', () => ({ fetchPendenciasForReconciliation: fx.fetchPendencias, insertPendencia: fx.insertPendencia, updatePendenciaStatus: vi.fn() }));
vi.mock('../surveyRequirements', () => ({ replaceSurveyRequirements: fx.replaceRequirements }));
vi.mock('../ordensServico', () => ({ updateOrdemServicoStatus: vi.fn() }));
vi.mock('../devices', () => ({ marcarTesteFuncional: vi.fn() }));
vi.mock('../ciclos', () => ({ fetchCicloAtivo: vi.fn(), registrarTestesNoCiclo: vi.fn() }));
vi.mock('../deviceOccurrences', () => ({ upsertDeviceOccurrence: fx.upsertOccurrence, resolveOccurrencesByPendenciaId: vi.fn(), OCCURRENCE_LABEL: { FAULT: 'Em falha', DISABLED: 'Desabilitado', ALARM: 'Em alarme' } }));
vi.mock('../sdaiAttendanceWiring', () => ({ createOrReuseDevicePendencia: fx.createOrReusePendencia }));
vi.mock('./fieldPhotoSync', () => ({}));
vi.mock('./idb', () => ({
  STORE_OUTBOX: 'report_outbox', STORE_REPORT_TOMBSTONES: 'report_tombstones',
  idbAvailable: () => true, idbGetAll: async () => [], idbDelete: fx.idbDelete, idbGet: fx.idbGet, idbPut: fx.idbPut,
}));
vi.mock('./outbox', () => ({
  canProcessJob: () => true, enqueueOfflineJob: vi.fn(), flushOfflineJobs: vi.fn(), getOutboxOwner: vi.fn(),
  listOfflineJobs: async () => [], registerOfflineHandler: vi.fn(), removeOfflineJob: fx.removeOfflineJob,
}));

import { cancelReportBundle, persistReportBundle, ReportBundle, stableBundleUuid } from './reportSync';

const report = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', templateCodigo: 'LEV_SDAI', tipo: 'LEVANTAMENTO' as const, status: 'rascunho' as const };
const bundle = (): ReportBundle => ({
  clientUuid: '11111111-1111-4111-8111-111111111111', createdAt: '2026-09-02T10:00:00Z',
  report: { templateCodigo: 'LEV_SDAI', tipo: 'LEVANTAMENTO', templateVersion: 1, templateSnapshot: { codigo: 'LEV_SDAI', nome: 'Levantamento', tipo: 'LEVANTAMENTO', secoes: [] } },
  answers: [{ secao: 'A', fieldKey: 'campo', valor: 'ok' }], pendencias: [], media: [], signatures: [], pendCount: 0,
});

beforeEach(() => {
  vi.clearAllMocks();
  fx.createReport.mockResolvedValue(report);
  fx.attachSnapshot.mockResolvedValue(true);
  fx.updateReport.mockImplementation(async (value) => value);
  fx.upsertAnswer.mockImplementation(async (value) => value);
  fx.replaceRequirements.mockResolvedValue(undefined);
  fx.fetchPendencias.mockResolvedValue([]);
  fx.createOrReusePendencia.mockResolvedValue({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', status: 'aberta' });
  fx.upsertOccurrence.mockImplementation(async (value) => value);
});

describe('persistReportBundle', () => {
  it('cria report, confirma snapshot e persiste children antes de finalizar', async () => {
    const result = await persistReportBundle(bundle());
    expect(result.reportId).toBe(report.id);
    expect(fx.attachSnapshot).toHaveBeenCalledWith(report.id, 1, expect.any(Object));
    expect(fx.upsertAnswer).toHaveBeenCalledOnce();
    expect(fx.updateReport).toHaveBeenCalledWith(expect.objectContaining({ status: 'finalizado' }));
    expect(fx.upsertAnswer.mock.invocationCallOrder[0]).toBeLessThan(fx.updateReport.mock.invocationCallOrder[0]);
  });

  it('retoma report existente, limpa children parciais e não cria outro report', async () => {
    fx.createReport.mockRejectedValueOnce(Object.assign(new Error('duplicate client_uuid'), { code: '23505' }));
    fx.fetchReportByClientUuid.mockResolvedValue(report);
    const result = await persistReportBundle(bundle());
    expect(result).toEqual({ reportId: report.id, duplicate: true });
    expect(fx.resetChildren).toHaveBeenCalledWith(report.id);
    expect(fx.upsertAnswer).toHaveBeenCalledOnce();
    expect(fx.updateReport).toHaveBeenCalledWith(expect.objectContaining({ status: 'finalizado' }));
  });

  it('mantém a tentativa rejeitada quando um child obrigatório falha', async () => {
    fx.upsertAnswer.mockRejectedValueOnce(new Error('child indisponível'));
    await expect(persistReportBundle(bundle())).rejects.toThrow('child indisponível');
    expect(fx.updateReport).not.toHaveBeenCalled();
  });

  it('gera identidades estáveis e distintas para children', () => {
    const first = stableBundleUuid(bundle().clientUuid, 'answer', 0);
    expect(first).toBe(stableBundleUuid(bundle().clientUuid, 'answer', 0));
    expect(first).not.toBe(stableBundleUuid(bundle().clientUuid, 'answer', 1));
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('retry offline usa a mesma identidade e dedupe_key da ocorrência', async () => {
    const b = bundle();
    b.occurrences = [{ occurrenceType: 'DISABLED', deviceId: 'dev-1', address: '41' }];
    await persistReportBundle(b);
    await persistReportBundle(b);
    expect(fx.upsertOccurrence).toHaveBeenCalledTimes(2);
    const first = fx.upsertOccurrence.mock.calls[0][0];
    const retry = fx.upsertOccurrence.mock.calls[1][0];
    expect(retry.id).toBe(first.id);
    expect(retry.dedupeKey).toBe(first.dedupeKey);
  });

  it('delete confirmado grava tombstone e remove as duas versões da fila local', async () => {
    await cancelReportBundle(bundle().clientUuid);
    expect(fx.idbPut).toHaveBeenCalledWith('report_tombstones', expect.objectContaining({ clientUuid: bundle().clientUuid }), bundle().clientUuid);
    expect(fx.removeOfflineJob).toHaveBeenCalledWith(`REPORT:${bundle().clientUuid}`);
    expect(fx.idbDelete).toHaveBeenCalledWith('report_outbox', bundle().clientUuid);
  });
});
