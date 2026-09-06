import { describe, expect, it } from 'vitest';
import type { AssetMaintenancePolicy, ContractRoutine, ContractRoutineExecution, Device } from './types';
import type { LastTestInfo } from './maintenanceAssets';
import { buildMaintenancePeriodPlan, resolveRoutineAssets } from './maintenancePlan';

const START = '2026-09-01';
const END = '2026-09-30';

const dev = (p: Partial<Device> & Pick<Device, 'id'>): Device => ({
  clienteId: 'A', sistema: 'SDAI', status: 'ativo', tipoAtivo: 'Detector', ...p,
});
const policyDetector: AssetMaintenancePolicy = {
  id: 'pol', escopo: 'PADRAO', area: 'SDAI', tipoAtivo: 'Detector',
  periodicidadeValor: 12, periodicidadeUnidade: 'MES', ativa: true,
};
const routine = (p: Partial<ContractRoutine> & Pick<ContractRoutine, 'id'>): ContractRoutine => ({
  contractId: 'C', tipo: 'preventiva', area: 'SDAI', ativo: true, templateCodigo: 'PREVENTIVA_SDAI', ...p,
});
const exec = (p: Partial<ContractRoutineExecution> & Pick<ContractRoutineExecution, 'id' | 'routineId'>): ContractRoutineExecution => ({
  contractId: 'C', competencia: '2026-09', status: 'os_gerada', dataProgramada: '2026-09-03', ...p,
});
const last = (pairs: Array<[string, string]>): Map<string, LastTestInfo> =>
  new Map(pairs.map(([id, d]) => [id, { verifiedAt: d } as LastTestInfo]));

const plan = (over: Partial<Parameters<typeof buildMaintenancePeriodPlan>[0]>) =>
  buildMaintenancePeriodPlan({
    contractId: 'C', periodStart: START, periodEnd: END,
    routines: [routine({ id: 'rt' })], executions: [exec({ id: 'ex', routineId: 'rt' })],
    devices: [], policies: [policyDetector], lastTests: new Map(), ...over,
  });

const byId = (p: ReturnType<typeof buildMaintenancePeriodPlan>, id: string) => p.devices.find((a) => a.deviceId === id)!;

describe('resolveRoutineAssets — por área canônica (sem taxonomia paralela)', () => {
  it('filtra por sistema e status ativo', () => {
    const devices = [dev({ id: 'a' }), dev({ id: 'b', sistema: 'CFTV' }), dev({ id: 'c', status: 'removido' })];
    expect(resolveRoutineAssets(routine({ id: 'rt', area: 'SDAI' }), devices).map((d) => d.id)).toEqual(['a']);
  });
  it('area nula → todas', () => {
    const devices = [dev({ id: 'a' }), dev({ id: 'b', sistema: 'CFTV' })];
    expect(resolveRoutineAssets(routine({ id: 'rt', area: undefined }), devices).map((d) => d.id).sort()).toEqual(['a', 'b']);
  });
});

describe('buildMaintenancePeriodPlan — classificação de planejamento', () => {
  const devices = [
    dev({ id: 'dueIn' }),        // vence 2026-09-15
    dev({ id: 'overdue' }),      // vence 2026-06-01 (antes da janela)
    dev({ id: 'after' }),        // vence 2027-06-01
    dev({ id: 'semHist' }),      // sem teste
    dev({ id: 'semPol', tipoAtivo: 'Sirene' }), // sem política
  ];
  const lastTests = last([
    ['dueIn', '2025-09-15'],
    ['overdue', '2025-06-01'],
    ['after', '2026-06-01'],
  ]);
  const p = plan({ devices, lastTests });

  it('vence dentro da janela + rotina agendada → PROGRAMADO_PERIODO', () => {
    expect(byId(p, 'dueIn').planningStatus).toBe('PROGRAMADO_PERIODO');
    expect(byId(p, 'dueIn').reason).toBe('PERIODICIDADE_VENCE_NO_PERIODO');
  });
  it('vencido antes da janela → PROGRAMADO_PERIODO / JA_VENCIDO_ANTES_DO_PERIODO', () => {
    expect(byId(p, 'overdue').planningStatus).toBe('PROGRAMADO_PERIODO');
    expect(byId(p, 'overdue').reason).toBe('JA_VENCIDO_ANTES_DO_PERIODO');
  });
  it('vence após a janela → NAO_PROGRAMADO / FORA_DA_JANELA', () => {
    expect(byId(p, 'after').planningStatus).toBe('NAO_PROGRAMADO');
    expect(byId(p, 'after').reason).toBe('FORA_DA_JANELA');
  });
  it('SEM_HISTORICO com rotina agendada → PROGRAMADO_PRIMEIRO_TESTE + data planejada', () => {
    const a = byId(p, 'semHist');
    expect(a.technicalStatus).toBe('SEM_HISTORICO');
    expect(a.planningStatus).toBe('PROGRAMADO_PRIMEIRO_TESTE');
    expect(a.reason).toBe('PRIMEIRO_TESTE_PLANEJADO');
    expect(a.plannedFirstTest).toBe('2026-09-03'); // = data_programada da execução (não inventada)
  });
  it('SEM_POLITICA → NAO_PROGRAMADO / SEM_POLITICA', () => {
    expect(byId(p, 'semPol').planningStatus).toBe('NAO_PROGRAMADO');
    expect(byId(p, 'semPol').reason).toBe('SEM_POLITICA');
  });
  it('programadosDeviceIds = só os efetivamente planejados', () => {
    expect([...p.programadosDeviceIds].sort()).toEqual(['dueIn', 'overdue', 'semHist']);
  });
  it('template resolvido da rotina', () => {
    expect(byId(p, 'dueIn').templateCodigo).toBe('PREVENTIVA_SDAI');
  });
});

describe('SEM_HISTORICO sem execução no período → não entra nos programados (§6)', () => {
  it('rotina não agendada (sem execução na janela) → PRIMEIRO_TESTE_PENDENTE', () => {
    const p = plan({ devices: [dev({ id: 'novo' })], executions: [], lastTests: new Map() });
    const a = byId(p, 'novo');
    expect(a.technicalStatus).toBe('SEM_HISTORICO');
    expect(a.planningStatus).toBe('PRIMEIRO_TESTE_PENDENTE');
    expect(a.reason).toBe('ROTINA_NAO_PROGRAMADA_NO_PERIODO');
    expect(p.programadosDeviceIds).not.toContain('novo');
  });
});

describe('conflito entre rotinas para o mesmo device (§11)', () => {
  it('duas rotinas agendadas cobrindo o mesmo ativo → conflito explícito, sem escolher', () => {
    const routines = [routine({ id: 'r1' }), routine({ id: 'r2' })];
    const executions = [exec({ id: 'e1', routineId: 'r1' }), exec({ id: 'e2', routineId: 'r2' })];
    const p = buildMaintenancePeriodPlan({
      contractId: 'C', periodStart: START, periodEnd: END, routines, executions,
      devices: [dev({ id: 'x' })], policies: [policyDetector], lastTests: new Map(),
    });
    expect(p.conflicts).toEqual([{ deviceId: 'x', routineIds: ['r1', 'r2'] }]);
    const a = byId(p, 'x');
    expect(a.conflict).toBe(true);
    expect(a.routineId).toBeUndefined();          // não escolhe silenciosamente
    expect(a.planningStatus).toBe('PROGRAMADO_PRIMEIRO_TESTE'); // ainda é programado
  });
});

describe('membership por data (não por competência) e sem duplicar device', () => {
  it('rotina trimestral (competência Q3) agenda pela DATA na janela', () => {
    const p = plan({
      routines: [routine({ id: 'rtri', frequencia: 'trimestral', area: 'SDAI' })],
      executions: [exec({ id: 'et', routineId: 'rtri', competencia: '2026-Q3', dataProgramada: '2026-09-10' })],
      devices: [dev({ id: 'd1' })], lastTests: last([['d1', '2025-09-01']]),
    });
    expect(p.routines[0].scheduledInPeriod).toBe(true);
    expect(byId(p, 'd1').planningStatus).toBe('PROGRAMADO_PERIODO');
  });
  it('device aplicável a 2 rotinas aparece UMA vez', () => {
    const routines = [routine({ id: 'r1' }), routine({ id: 'r2' })];
    const p = buildMaintenancePeriodPlan({
      contractId: 'C', periodStart: START, periodEnd: END, routines,
      executions: [exec({ id: 'e1', routineId: 'r1' })], // só r1 agendada → sem conflito
      devices: [dev({ id: 'x' })], policies: [policyDetector], lastTests: last([['x', '2025-09-15']]),
    });
    expect(p.devices.filter((a) => a.deviceId === 'x')).toHaveLength(1);
    expect(byId(p, 'x').routineId).toBe('r1');
  });
});

describe('mensal + trimestral no mesmo contrato', () => {
  it('duas rotinas de áreas distintas no período', () => {
    const p = buildMaintenancePeriodPlan({
      contractId: 'C', periodStart: START, periodEnd: END,
      routines: [routine({ id: 'sdai', area: 'SDAI', frequencia: 'mensal' }), routine({ id: 'cftv', area: 'CFTV', frequencia: 'trimestral' })],
      executions: [exec({ id: 'e1', routineId: 'sdai' }), exec({ id: 'e2', routineId: 'cftv', competencia: '2026-Q3', dataProgramada: '2026-09-12' })],
      devices: [dev({ id: 'sA' }), dev({ id: 'cB', sistema: 'CFTV', tipoAtivo: 'Camera' })],
      policies: [policyDetector, { id: 'polC', escopo: 'PADRAO', area: 'CFTV', tipoAtivo: 'Camera', periodicidadeValor: 6, periodicidadeUnidade: 'MES', ativa: true }],
      lastTests: last([['sA', '2025-09-15'], ['cB', '2026-01-01']]),
    });
    expect(p.routines.map((r) => r.scheduledInPeriod)).toEqual([true, true]);
    expect(byId(p, 'sA').sistema).toBe('SDAI');
    expect(byId(p, 'cB').sistema).toBe('CFTV');
    expect(byId(p, 'cB').planningStatus).toBe('PROGRAMADO_PERIODO'); // 2026-01+6M=2026-07 ≤ set
  });
});

describe('precedência de política preservada no plano', () => {
  it('override de ATIVO (3M) muda o próximo teste', () => {
    const p = plan({
      devices: [dev({ id: 'd1' })],
      policies: [policyDetector, { id: 'polAtivo', escopo: 'ATIVO', deviceId: 'd1', periodicidadeValor: 3, periodicidadeUnidade: 'MES', ativa: true }],
      lastTests: last([['d1', '2026-08-01']]),
    });
    // 2026-08-01 + 3M = 2026-11-01 (após set) → NAO_PROGRAMADO/FORA_DA_JANELA e policy do ativo
    expect(byId(p, 'd1').effectivePolicyId).toBe('polAtivo');
    expect(byId(p, 'd1').nextTestAt).toBe('2026-11-01');
    expect(byId(p, 'd1').planningStatus).toBe('NAO_PROGRAMADO');
  });
});
