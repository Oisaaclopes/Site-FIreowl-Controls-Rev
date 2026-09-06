import { describe, expect, it } from 'vitest';
import type {
  ContractRoutineExecution,
  Device,
  DeviceVerification,
  MaintenanceCoverage,
  Pendencia,
  ServiceAttendance,
} from './types';
import type { FieldPhoto } from './fieldPhotos';
import {
  attendancesInWindow,
  bucketPendencias,
  buildMaintenanceReportSnapshot,
  executionsInWindow,
  formatRevisao,
  inWindow,
  nextRevisaoLabel,
  parseRevisao,
  type MaintenanceConsolidation,
} from './maintenanceReports';

describe('revisões R00/R01/R02', () => {
  it('parse/format', () => {
    expect(parseRevisao('R00')).toBe(0);
    expect(parseRevisao('R01')).toBe(1);
    expect(parseRevisao('R10')).toBe(10);
    expect(formatRevisao(0)).toBe('R00');
    expect(formatRevisao(2)).toBe('R02');
    expect(formatRevisao(100)).toBe('R100');
  });
  it('próxima revisão', () => {
    expect(nextRevisaoLabel('R00')).toBe('R01');
    expect(nextRevisaoLabel('R01')).toBe('R02');
    expect(nextRevisaoLabel('R09')).toBe('R10');
  });
  it('revisão inválida lança', () => {
    expect(() => parseRevisao('R0')).toThrow();
    expect(() => parseRevisao('X01')).toThrow();
    expect(() => formatRevisao(-1)).toThrow();
  });
});

describe('inWindow / executionsInWindow / attendancesInWindow (por data, não por competência)', () => {
  const start = '2026-09-01';
  const end = '2026-09-30';

  it('inWindow compara só a parte de data', () => {
    expect(inWindow('2026-09-15T13:00:00Z', start, end)).toBe(true);
    expect(inWindow('2026-08-31', start, end)).toBe(false);
    expect(inWindow(undefined, start, end)).toBe(false);
  });

  it('execuções: mensal e trimestral entram pela DATA PROGRAMADA (não pela string)', () => {
    const execs: ContractRoutineExecution[] = [
      { id: 'sdai', contractId: 'C', routineId: 'r1', competencia: '2026-09', status: 'os_gerada', dataProgramada: '2026-09-03' },
      { id: 'cftv', contractId: 'C', routineId: 'r2', competencia: '2026-Q3', status: 'os_gerada', dataProgramada: '2026-09-10' },
      { id: 'cftv-jul', contractId: 'C', routineId: 'r2', competencia: '2026-Q3', status: 'executado', dataProgramada: '2026-07-15' },
      { id: 'sem-data', contractId: 'C', routineId: 'r3', competencia: '2026-09', status: 'previsto' },
    ];
    const inw = executionsInWindow(execs, start, end).map((e) => e.id);
    expect(inw).toContain('sdai');
    expect(inw).toContain('cftv');       // trimestral entra porque a data caiu em setembro
    expect(inw).not.toContain('cftv-jul'); // trimestral de julho NÃO entra em setembro
    expect(inw).not.toContain('sem-data'); // sem data_programada não ancora
  });

  it('atendimentos entram pela started_at', () => {
    const atts: ServiceAttendance[] = [
      { id: 'a1', workOrderId: 'os1', status: 'FINALIZADO', startedAt: '2026-09-05T08:00:00Z' },
      { id: 'a2', workOrderId: 'os2', status: 'FINALIZADO', startedAt: '2026-10-02T08:00:00Z' },
    ];
    expect(attendancesInWindow(atts, start, end).map((a) => a.id)).toEqual(['a1']);
  });
});

describe('bucketPendencias — abertas/anteriores/resolvidas (entidade persistente, §17)', () => {
  const start = '2026-09-01';
  const end = '2026-09-30';
  const p = (id: string, criadaEm?: string, resolvidaEm?: string, status: Pendencia['status'] = 'aberta'): Pendencia => ({
    id, status, criadaEm, resolvidaEm,
  });

  it('separa corretamente as três lentes', () => {
    const pends: Pendencia[] = [
      p('anterior', '2026-08-15'),                                  // anterior ainda aberta
      p('nova', '2026-09-05'),                                      // aberta no período
      p('resolvida', '2026-08-01', '2026-09-10', 'corrigida'),      // resolvida no período (não é "anterior aberta")
      p('nova-e-resolvida', '2026-09-03', '2026-09-20', 'corrigida'), // aberta E resolvida no período
      p('cancelada', '2026-09-04', undefined, 'cancelada'),          // ignorada
    ];
    const b = bucketPendencias(pends, start, end);
    expect(b.abertasNoPeriodo.map((x) => x.id).sort()).toEqual(['nova', 'nova-e-resolvida']);
    expect(b.anterioresAbertas.map((x) => x.id)).toEqual(['anterior']);
    expect(b.resolvidasNoPeriodo.map((x) => x.id).sort()).toEqual(['nova-e-resolvida', 'resolvida']);
  });

  it('mesma pendência atravessa meses sem duplicar (só muda de lente)', () => {
    const pend = p('PEND-001', '2026-08-15');
    // agosto: aberta no período de agosto
    const ago = bucketPendencias([pend], '2026-08-01', '2026-08-31');
    expect(ago.abertasNoPeriodo.map((x) => x.id)).toEqual(['PEND-001']);
    // setembro: a MESMA pendência agora é "anterior ainda aberta"
    const set = bucketPendencias([pend], start, end);
    expect(set.anterioresAbertas.map((x) => x.id)).toEqual(['PEND-001']);
    expect(set.abertasNoPeriodo).toHaveLength(0);
  });
});

describe('buildMaintenanceReportSnapshot — congela dados do momento (§5–§9)', () => {
  const coverage: MaintenanceCoverage = {
    periodStart: '2026-09-01', periodEnd: '2026-09-30', totalBase: 1, totalComPolitica: 1,
    semPolitica: 0, semHistorico: 0, programadosPeriodo: 1, testadosPeriodo: 1, aprovadosPeriodo: 1,
    falharamPeriodo: 0, naoTestadosPeriodo: 0, coberturaProgramadosPct: 1, coberturaBasePct: 1, aprovacaoPct: 1,
  };
  const photo: FieldPhoto = {
    id: 'f1', sessionId: 's1', clientId: 'A', storagePathOriginal: 'field/orig.jpg',
    capturadoEm: '2026-09-03T09:00:00Z', clientUuid: 'u1', syncStatus: 'sincronizado',
    deviceId: 'd1', serviceAttendanceId: 'a1', evidenceMoment: 'DEPOIS', notaRapida: 'ok',
  };
  const test1: DeviceVerification = { id: 'v1', deviceId: 'd1', condicao: 'NORMAL', verifiedAt: '2026-09-03', serviceAttendanceId: 'a1' };
  const consolidation: MaintenanceConsolidation = {
    contratoId: 'C', clienteId: 'A', periodStart: '2026-09-01', periodEnd: '2026-09-30',
    executions: [{ id: 'e1', contractId: 'C', routineId: 'r1', competencia: '2026-09', status: 'os_gerada', dataProgramada: '2026-09-03' }],
    attendances: [{ id: 'a1', workOrderId: 'os1', status: 'FINALIZADO', technicianId: 't1', startedAt: '2026-09-03T08:00:00Z', result: 'RESOLVIDO' }],
    sistemas: ['SDAI'],
    testes: [test1],
    pendencias: {
      abertasNoPeriodo: [{ id: 'PN', status: 'aberta', criadaEm: '2026-09-05' }],
      anterioresAbertas: [{ id: 'PA', status: 'aberta', criadaEm: '2026-08-01' }],
      resolvidasNoPeriodo: [{ id: 'PR', status: 'corrigida', criadaEm: '2026-08-01', resolvidaEm: '2026-09-10' }],
    },
    fotos: [photo],
    membership: { attendanceIds: ['a1'], executionIds: ['e1'], osIds: ['os1'] },
  };
  const device = (): Device => ({
    id: 'd1', clienteId: 'A', sistema: 'SDAI', status: 'ativo',
    localizacao: 'Detector Sala ADM', tipoAtivo: 'Detector', endereco: '046',
    central: 'C1', laco: 'L1', fabricante: 'X', modelo: 'Y', technicalIdentifier: '046', condicao: 'NORMAL',
  });

  it('congela nome/localização e resultado do teste', () => {
    const devices = [device()];
    const snap = buildMaintenanceReportSnapshot({ consolidation, devices, coverage, revisao: 'R00', fechadoEm: '2026-09-30T12:00:00Z' });
    expect(snap.ativos).toHaveLength(1);
    expect(snap.ativos[0].descricao).toBe('Detector Sala ADM');
    expect(snap.ativos[0].resultadoTeste).toBe('APROVADO');
    expect(snap.ativos[0].dataTeste).toBe('2026-09-03');
    expect(snap.testes[0].resultado).toBe('APROVADO');
    expect(snap.cobertura.testadosPeriodo).toBe(1);
    expect(snap.conclusao).toBeUndefined(); // não inventa conclusão (§5)
  });

  it('preserva as 3 lentes de pendências e a membership', () => {
    const snap = buildMaintenanceReportSnapshot({ consolidation, devices: [device()], coverage, revisao: 'R00', fechadoEm: 'now' });
    expect(snap.pendencias.novasNoPeriodo.map((p) => p.id)).toEqual(['PN']);
    expect(snap.pendencias.anterioresAbertas.map((p) => p.id)).toEqual(['PA']);
    expect(snap.pendencias.resolvidasNoPeriodo.map((p) => p.id)).toEqual(['PR']);
    expect(snap.membership.attendanceIds).toEqual(['a1']);
    expect(snap.membership.executionIds).toEqual(['e1']);
    expect(snap.membership.deviceVerificationIds).toEqual(['v1']);
    expect(snap.membership.pendenciaIds.sort()).toEqual(['PA', 'PN', 'PR']);
    expect(snap.membership.deviceIds).toEqual(['d1']);
    expect(snap.fotos[0].fieldPhotoId).toBe('f1');
    expect(snap.fotos[0].storagePath).toBe('field/orig.jpg'); // só referência, não duplica arquivo
  });

  it('NÃO depende de mutações posteriores da Base nem da consolidação (§9/§11)', () => {
    const devices = [device()];
    const snap = buildMaintenanceReportSnapshot({ consolidation, devices, coverage, revisao: 'R00', fechadoEm: 'now' });
    // Renomeia o ativo na Base DEPOIS de fechar → snapshot inalterado.
    devices[0].localizacao = 'Detector Sala Financeiro';
    // Muta a membership de origem DEPOIS → snapshot inalterado (cópia, não referência).
    consolidation.membership.attendanceIds.push('INTRUSO');
    expect(snap.ativos[0].descricao).toBe('Detector Sala ADM');
    expect(snap.membership.attendanceIds).toEqual(['a1']);
  });
});
