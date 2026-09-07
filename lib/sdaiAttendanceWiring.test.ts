import { describe, expect, it } from 'vitest';
import type { Device, MaintenancePeriodPlan } from './types';
import type { SdaiDeviceResult } from './sdaiMaintenance';
import { PREVENTIVA_SDAI_CONTRATO_CODIGO } from './sdaiMaintenance';
import {
  attendancePlanDevices,
  buildAttendanceVerification,
  coverageInProgress,
  finalizationGate,
  resolveAttendanceTemplateCodigo,
  stableVerificationId,
} from './sdaiAttendanceWiring';

const plan = (ids: string[]): Pick<MaintenancePeriodPlan, 'programadosDeviceIds'> => ({ programadosDeviceIds: ids });

describe('resolveAttendanceTemplateCodigo (§3)', () => {
  it('usa o template da rotina; fallback SDAI contratual; undefined se indeterminado', () => {
    expect(resolveAttendanceTemplateCodigo({ templateCodigo: 'X', area: 'SDAI' })).toBe('X');
    expect(resolveAttendanceTemplateCodigo({ area: 'SDAI' })).toBe(PREVENTIVA_SDAI_CONTRATO_CODIGO);
    expect(resolveAttendanceTemplateCodigo({ area: 'CFTV' })).toBeUndefined();
  });
});

describe('idempotência (§10/§16)', () => {
  it('id da verificação é estável por (atendimento × device)', () => {
    expect(stableVerificationId('a1', 'd1')).toBe('av:a1:d1');
    expect(stableVerificationId('a1', 'd1')).toBe(stableVerificationId('a1', 'd1'));
    expect(stableVerificationId('a1', 'd1')).not.toBe(stableVerificationId('a2', 'd1'));
  });
  it('buildAttendanceVerification: aprovado→NORMAL com id estável; repetição = mesma linha', () => {
    const v1 = buildAttendanceVerification({ serviceAttendanceId: 'a1', deviceId: 'd1', result: 'TESTADO_APROVADO', clienteId: 'A' });
    const v2 = buildAttendanceVerification({ serviceAttendanceId: 'a1', deviceId: 'd1', result: 'TESTADO_APROVADO', clienteId: 'A' });
    expect(v1).toMatchObject({ id: 'av:a1:d1', condicao: 'NORMAL', source: 'ATENDIMENTO', serviceAttendanceId: 'a1' });
    expect(v1!.id).toBe(v2!.id); // replay/autosave não duplica (upsert por id)
  });
  it('REMOVIDO → null (não gera verificação falsa)', () => {
    expect(buildAttendanceVerification({ serviceAttendanceId: 'a1', deviceId: 'd1', result: 'REMOVIDO' })).toBeNull();
  });
});

describe('cobertura em andamento (§17)', () => {
  it('planejado x extra; conclusivos contam; derivado dos resultados', () => {
    const results = new Map<string, SdaiDeviceResult>([
      ['d1', 'TESTADO_APROVADO'],
      ['d2', 'TESTADO_FALHOU'],
      ['d3', 'NAO_LOCALIZADO'],   // planejado não testado
      ['dX', 'TESTADO_APROVADO'], // fora do plano → extra
    ]);
    const cov = coverageInProgress(plan(['d1', 'd2', 'd3']), results);
    expect(cov).toEqual({
      planejados: 3, testadosProgramados: 2, naoTestados: 1, testadosExtras: 1, aprovados: 2, falharam: 1,
    });
  });
  it('teste extra NÃO entra em programados', () => {
    const cov = coverageInProgress(plan(['d1']), new Map<string, SdaiDeviceResult>([['dX', 'TESTADO_APROVADO']]));
    expect(cov.planejados).toBe(1);
    expect(cov.testadosProgramados).toBe(0);
    expect(cov.testadosExtras).toBe(1);
  });
});

describe('portão de finalização (§18/§19)', () => {
  const base = { plan: plan(['d1', 'd2', 'd3']), centralRequired: false, centralChecklistDone: true, fotoGeralPresent: true, assinaturaPresent: true };
  const results = new Map<string, SdaiDeviceResult>([
    ['d1', 'TESTADO_APROVADO'], ['d2', 'TESTADO_FALHOU'], ['d3', 'NAO_LOCALIZADO'],
  ]);

  it('79/82 análogo: todos com estado (inclui não testado com motivo) → finaliza', () => {
    const g = finalizationGate({ ...base, resultsByDevice: results });
    expect(g.canFinalize).toBe(true);
    expect(g.issues).toHaveLength(0);
  });
  it('planejado sem NENHUM estado → bloqueia', () => {
    const parcial = new Map(results); parcial.delete('d3');
    const g = finalizationGate({ ...base, resultsByDevice: parcial });
    expect(g.canFinalize).toBe(false);
    expect(g.issues).toContainEqual({ code: 'PLANEJADO_SEM_ESTADO', deviceId: 'd3' });
  });
  it('checklist da central exigido e não concluído → bloqueia', () => {
    const g = finalizationGate({ ...base, resultsByDevice: results, centralRequired: true, centralChecklistDone: false });
    expect(g.canFinalize).toBe(false);
    expect(g.issues).toContainEqual({ code: 'CENTRAL_CHECKLIST_PENDENTE' });
  });
  it('foto geral e assinatura obrigatórias', () => {
    const g = finalizationGate({ ...base, resultsByDevice: results, fotoGeralPresent: false, assinaturaPresent: false });
    expect(g.issues).toContainEqual({ code: 'FOTO_GERAL_OBRIGATORIA' });
    expect(g.issues).toContainEqual({ code: 'ASSINATURA_OBRIGATORIA' });
  });
  it('falhas NÃO bloqueiam (resultado válido de manutenção)', () => {
    const todasFalha = new Map<string, SdaiDeviceResult>([['d1', 'TESTADO_FALHOU'], ['d2', 'TESTADO_FALHOU'], ['d3', 'TESTADO_FALHOU']]);
    expect(finalizationGate({ ...base, resultsByDevice: todasFalha }).canFinalize).toBe(true);
  });
});

describe('attendancePlanDevices (§4 — só planejados, sem duplicar)', () => {
  it('injeta apenas devices do plano', () => {
    const devices: Device[] = [
      { id: 'd1', clienteId: 'A', sistema: 'SDAI', status: 'ativo' },
      { id: 'd2', clienteId: 'A', sistema: 'SDAI', status: 'ativo' },
      { id: 'd3', clienteId: 'A', sistema: 'SDAI', status: 'ativo' },
    ];
    const full = { ...plan(['d1', 'd3']), contractId: 'C', periodStart: '2026-09-01', periodEnd: '2026-09-30', routines: [], devices: [], conflicts: [] } as unknown as MaintenancePeriodPlan;
    expect(attendancePlanDevices(full, devices).map((d) => d.id)).toEqual(['d1', 'd3']);
  });
});
