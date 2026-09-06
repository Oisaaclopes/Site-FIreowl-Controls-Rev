import { describe, expect, it } from 'vitest';
import type { ContractRoutineExecution, Pendencia, ServiceAttendance } from './types';
import {
  attendancesInWindow,
  bucketPendencias,
  executionsInWindow,
  formatRevisao,
  inWindow,
  nextRevisaoLabel,
  parseRevisao,
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
