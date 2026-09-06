import { describe, expect, it } from 'vitest';
import type { AssetMaintenancePolicy, ContractRoutine, ContractRoutineExecution, Device } from './types';
import type { LastTestInfo } from './maintenanceAssets';
import { buildMaintenancePeriodPlan } from './maintenancePlan';
import { computeMaintenanceCoverage, groupVerificationsByDevice } from './maintenanceCoverage';

const dev = (id: string, over: Partial<Device> = {}): Device => ({
  id, clienteId: 'A', sistema: 'SDAI', status: 'ativo', tipoAtivo: 'Detector', ...over,
});
const polDetector: AssetMaintenancePolicy = { id: 'polD', escopo: 'PADRAO', area: 'SDAI', tipoAtivo: 'Detector', periodicidadeValor: 12, periodicidadeUnidade: 'MES', ativa: true };
const routineMensal: ContractRoutine = { id: 'rt', contractId: 'C', tipo: 'preventiva', area: 'SDAI', frequencia: 'mensal', ativo: true, templateCodigo: 'PREVENTIVA_SDAI' };
const mm = (m: number) => String(m).padStart(2, '0');
const execFor = (m: number): ContractRoutineExecution => ({ id: `ex-${m}`, contractId: 'C', routineId: 'rt', competencia: `2026-${mm(m)}`, status: 'os_gerada', dataProgramada: `2026-${mm(m)}-05` });

const planMonth = (devices: Device[], m: number, over: Partial<Parameters<typeof buildMaintenancePeriodPlan>[0]> = {}) =>
  buildMaintenancePeriodPlan({
    contractId: 'C', periodStart: `2026-${mm(m)}-01`, periodEnd: `2026-${mm(m)}-28`,
    routines: [routineMensal], executions: [execFor(m)], devices, policies: [polDetector],
    lastTests: new Map(), rotation: true, ...over,
  });

const semHist = (n: number) => Array.from({ length: n }, (_, i) => dev(`d${i}`));

describe('rodízio — distribuição de 240 SEM_HISTORICO em 12 execuções mensais', () => {
  const devices = semHist(240);

  it('cadência = 12; slot determinístico presente', () => {
    const p = planMonth(devices, 9);
    expect(p.devices[0].rotationTotalSlots).toBe(12);
    expect(typeof p.devices[0].rotationSlot).toBe('number');
  });

  it('não programa todos no mesmo mês (subconjunto ~20)', () => {
    const p = planMonth(devices, 9);
    const prog = p.programadosDeviceIds.length;
    expect(prog).toBeGreaterThan(0);
    expect(prog).toBeLessThan(240);
    // ~20 por execução, tolerância ampla (hash não exige balanceamento perfeito).
    expect(prog).toBeGreaterThanOrEqual(8);
    expect(prog).toBeLessThanOrEqual(40);
  });

  it('cobre TODOS os 240 exatamente uma vez ao longo dos 12 meses', () => {
    const count = new Map<string, number>();
    const perMonth: number[] = [];
    for (let m = 1; m <= 12; m++) {
      const ids = planMonth(devices, m).programadosDeviceIds;
      perMonth.push(ids.length);
      ids.forEach((id) => count.set(id, (count.get(id) ?? 0) + 1));
    }
    expect(count.size).toBe(240);                         // todos cobertos
    expect([...count.values()].every((c) => c === 1)).toBe(true); // exatamente uma vez
    expect(perMonth.reduce((a, b) => a + b, 0)).toBe(240);
    // Balanceado: nenhum mês vazio; amplitude controlada.
    expect(Math.min(...perMonth)).toBeGreaterThan(0);
    expect(Math.max(...perMonth) - Math.min(...perMonth)).toBeLessThanOrEqual(20);
  });

  it('mesma entrada → mesma distribuição (determinístico/estável)', () => {
    expect(planMonth(devices, 9).programadosDeviceIds.sort())
      .toEqual(planMonth(devices, 9).programadosDeviceIds.sort());
  });
});

describe('rodízio — divisão não exata (242/12)', () => {
  it('todos cobertos uma vez; meses equilibrados', () => {
    const devices = semHist(242);
    const count = new Map<string, number>();
    for (let m = 1; m <= 12; m++) planMonth(devices, m).programadosDeviceIds.forEach((id) => count.set(id, (count.get(id) ?? 0) + 1));
    expect(count.size).toBe(242);
    expect([...count.values()].every((c) => c === 1)).toBe(true);
  });
});

describe('rodízio — estabilidade ao adicionar device novo (§9)', () => {
  it('device novo não muda o slot dos já distribuídos', () => {
    const base = semHist(50);
    const slotsBefore = new Map(planMonth(base, 9).devices.map((a) => [a.deviceId, a.rotationSlot]));
    const withNew = [...base, dev('novo-x')];
    const after = new Map(planMonth(withNew, 9).devices.map((a) => [a.deviceId, a.rotationSlot]));
    for (const [id, slot] of slotsBefore) expect(after.get(id)).toBe(slot); // inalterados
    expect(after.has('novo-x')).toBe(true); // novo recebe posição determinística
  });
});

describe('rodízio — vencidos têm prioridade (§7)', () => {
  it('vencido entra mesmo fora do slot do rodízio', () => {
    const devices = [dev('venc'), ...semHist(20)];
    const lastTests = new Map<string, LastTestInfo>([['venc', { verifiedAt: '2024-01-01' }]]); // muito vencido
    const p = planMonth(devices, 9, { lastTests });
    const a = p.devices.find((x) => x.deviceId === 'venc')!;
    expect(a.planningStatus).toBe('PROGRAMADO_PERIODO');
    expect(a.reason).toBe('JA_VENCIDO_ANTES_DO_PERIODO');
    expect(p.programadosDeviceIds).toContain('venc');
  });
});

describe('rodízio — SEM_HISTORICO fora do slot é PENDENTE, não vira EXTRA retroativo (§6/§8)', () => {
  it('fora do slot → PRIMEIRO_TESTE_PENDENTE / RODIZIO_OUTRA_JANELA e fora dos programados', () => {
    const devices = semHist(240);
    const p = planMonth(devices, 9);
    const pend = p.devices.filter((a) => a.reason === 'RODIZIO_OUTRA_JANELA');
    expect(pend.length).toBeGreaterThan(0);
    pend.forEach((a) => {
      expect(a.planningStatus).toBe('PRIMEIRO_TESTE_PENDENTE');
      expect(p.programadosDeviceIds).not.toContain(a.deviceId);
    });
  });
});

describe('rodízio — device inativo sai do futuro (§10)', () => {
  it('removido/inativo não entra no plano', () => {
    const devices = [dev('ativo1'), dev('rem', { status: 'removido' }), dev('ina', { status: 'inativo' })];
    const p = planMonth(devices, 9);
    const ids = p.devices.map((a) => a.deviceId);
    expect(ids).toContain('ativo1');
    expect(ids).not.toContain('rem');
    expect(ids).not.toContain('ina');
  });
});

describe('rodízio — periodicidades diferentes por tipo geram cadências diferentes (§2)', () => {
  it('detector (12M) cadência 12; sirene (3M) cadência 3; central (1M) sem rodízio', () => {
    const polSirene: AssetMaintenancePolicy = { id: 'polS', escopo: 'PADRAO', area: 'SDAI', tipoAtivo: 'Sirene', periodicidadeValor: 3, periodicidadeUnidade: 'MES', ativa: true };
    const polCentral: AssetMaintenancePolicy = { id: 'polC', escopo: 'PADRAO', area: 'SDAI', tipoAtivo: 'Central', periodicidadeValor: 1, periodicidadeUnidade: 'MES', ativa: true };
    const devices = [dev('det'), dev('sir', { tipoAtivo: 'Sirene' }), dev('cen', { tipoAtivo: 'Central' })];
    const p = buildMaintenancePeriodPlan({
      contractId: 'C', periodStart: '2026-09-01', periodEnd: '2026-09-28',
      routines: [routineMensal], executions: [execFor(9)], devices,
      policies: [polDetector, polSirene, polCentral], lastTests: new Map(), rotation: true,
    });
    expect(p.devices.find((a) => a.deviceId === 'det')!.rotationTotalSlots).toBe(12);
    expect(p.devices.find((a) => a.deviceId === 'sir')!.rotationTotalSlots).toBe(3);
    // Central: cadência 1 → sem rodízio (undefined), sempre no 1º teste da visita.
    expect(p.devices.find((a) => a.deviceId === 'cen')!.rotationTotalSlots).toBeUndefined();
    expect(p.devices.find((a) => a.deviceId === 'cen')!.planningStatus).toBe('PROGRAMADO_PRIMEIRO_TESTE');
  });
});

describe('rodízio — conflito entre rotinas continua explícito (§11)', () => {
  it('duas rotinas agendadas → conflito; rodízio não mascara', () => {
    const r2 = { ...routineMensal, id: 'rt2' };
    const p = buildMaintenancePeriodPlan({
      contractId: 'C', periodStart: '2026-09-01', periodEnd: '2026-09-28',
      routines: [routineMensal, r2],
      executions: [execFor(9), { ...execFor(9), id: 'ex2', routineId: 'rt2' }],
      devices: [dev('x')], policies: [polDetector], lastTests: new Map(), rotation: true,
    });
    expect(p.conflicts).toEqual([{ deviceId: 'x', routineIds: ['rt', 'rt2'] }]);
    expect(p.devices[0].conflict).toBe(true);
    expect(p.devices[0].rotationSlot).toBeUndefined(); // conflito → não roteia (não escolhe)
  });
});

describe('rodízio → cobertura usa exatamente os ids planejados (§14)', () => {
  it('programadosPeriodo = |plano|; testado fora do plano vira EXTRA', () => {
    const devices = semHist(240);
    const p = planMonth(devices, 9);
    const planned = p.programadosDeviceIds;
    // Um planejado testado (aprovado) + um NÃO planejado testado (extra).
    const naoPlanejado = p.devices.find((a) => !planned.includes(a.deviceId))!.deviceId;
    const verifs = groupVerificationsByDevice([
      { id: 'v1', deviceId: planned[0], condicao: 'NORMAL', verifiedAt: '2026-09-10' },
      { id: 'v2', deviceId: naoPlanejado, condicao: 'NORMAL', verifiedAt: '2026-09-10' },
    ]);
    const cov = computeMaintenanceCoverage(devices, [polDetector], verifs, {
      contractId: 'C', periodStart: '2026-09-01', periodEnd: '2026-09-28', plannedDeviceIds: planned,
    });
    expect(cov.programadosPeriodo).toBe(planned.length);        // exatamente o plano
    expect(cov.testadosProgramadosPeriodo).toBe(1);             // o planejado testado
    expect(cov.testadosExtrasPeriodo).toBe(1);                  // o não planejado = extra
  });
});
