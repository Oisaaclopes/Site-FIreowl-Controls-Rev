import { describe, expect, it } from 'vitest';
import type { AssetMaintenancePolicy, Device, DeviceVerification } from './types';
import { classifyTestResult, computeMaintenanceCoverage, groupVerificationsByDevice } from './maintenanceCoverage';

const dev = (p: Partial<Device> & Pick<Device, 'id'>): Device => ({
  clienteId: 'A', sistema: 'SDAI', status: 'ativo', tipoAtivo: 'Detector', ...p,
});
const policy: AssetMaintenancePolicy = {
  id: 'p', escopo: 'PADRAO', area: 'SDAI', tipoAtivo: 'Detector',
  periodicidadeValor: 12, periodicidadeUnidade: 'MES', ativa: true,
};
const ver = (deviceId: string, verifiedAt: string, condicao: DeviceVerification['condicao']): DeviceVerification => ({
  id: `${deviceId}@${verifiedAt}`, deviceId, condicao, verifiedAt,
});

describe('classifyTestResult (normaliza condicao real da 0095, sem novo enum)', () => {
  it('APROVADO/FALHA/NAO_TESTADO', () => {
    expect(classifyTestResult('NORMAL')).toBe('APROVADO');
    expect(classifyTestResult('COM_AVARIA')).toBe('FALHA');
    expect(classifyTestResult('INOPERANTE')).toBe('FALHA');
    expect(classifyTestResult('INADEQUADO')).toBe('FALHA');
    expect(classifyTestResult('NAO_TESTADO')).toBe('NAO_TESTADO');
    expect(classifyTestResult('NAO_LOCALIZADO')).toBe('NAO_TESTADO');
    expect(classifyTestResult(undefined)).toBe('NAO_TESTADO');
  });
});

describe('cobertura — programados ≠ extras; base ≠ programados', () => {
  const start = '2026-09-01';
  const end = '2026-09-30';
  const devices = [
    dev({ id: 'd1' }), // programado testado (aprovado)
    dev({ id: 'd2' }), // programado testado (falha)
    dev({ id: 'd3' }), // programado NÃO testado
    dev({ id: 'd4' }), // com base, não vence neste mês → não programado, não testado
    dev({ id: 'd5' }), // sem histórico
    dev({ id: 'd6', tipoAtivo: 'Sirene' }), // sem política
    dev({ id: 'd7' }), // testado EXTRA (não previsto p/ o período)
  ];
  const verifs = [
    ver('d1', '2025-09-01', 'NORMAL'), ver('d1', '2026-09-05', 'NORMAL'),
    ver('d2', '2025-09-15', 'NORMAL'), ver('d2', '2026-09-20', 'COM_AVARIA'),
    ver('d3', '2025-08-01', 'NORMAL'),                        // vence 2026-08 → programado, não testado
    ver('d4', '2026-06-01', 'NORMAL'),                        // vence 2027-06 → não previsto
    ver('d7', '2026-05-01', 'NORMAL'), ver('d7', '2026-09-08', 'NORMAL'), // vence 2027-05 → extra
  ];
  const cov = computeMaintenanceCoverage(devices, [policy], groupVerificationsByDevice(verifs), {
    contractId: null, periodStart: start, periodEnd: end,
  });

  it('contagens separam programado x extra', () => {
    expect(cov.totalBase).toBe(7);
    expect(cov.totalComPolitica).toBe(6);
    expect(cov.semPolitica).toBe(1);
    expect(cov.semHistorico).toBe(1);            // d5
    expect(cov.primeiroTestePendente).toBe(1);   // d5
    expect(cov.programadosPeriodo).toBe(3);      // d1,d2,d3 (d7 é extra; d4/d5 não previstos)
    expect(cov.testadosProgramadosPeriodo).toBe(2); // d1,d2
    expect(cov.naoTestadosPeriodo).toBe(1);      // d3
    expect(cov.testadosExtrasPeriodo).toBe(1);   // d7
    expect(cov.testadosTotaisPeriodo).toBe(3);   // 2 + 1
    expect(cov.aprovadosPeriodo).toBe(2);        // d1,d7
    expect(cov.falharamPeriodo).toBe(1);         // d2
  });
  it('extra NÃO entra no denominador da cobertura contratual', () => {
    expect(cov.coberturaProgramadaPct).toBeCloseTo(2 / 3); // 2/3, não 3/3
    expect(cov.taxaAprovacaoPct).toBeCloseTo(2 / 3);       // aprovados/testadosTotais
  });
});

describe('cenário 80 programados + 76 testados + 20 extras → cobertura 95% (§6)', () => {
  const start = '2026-09-01';
  const end = '2026-09-30';
  const devices: Device[] = [];
  const verifs: DeviceVerification[] = [];
  // 80 programados (base conclusiva antiga → vencem dentro da janela); 76 testados.
  for (let i = 0; i < 80; i++) {
    const id = `P${i}`;
    devices.push(dev({ id }));
    verifs.push(ver(id, '2025-01-01', 'NORMAL')); // vence 2026-01-01 ≤ set → programado
    if (i < 76) verifs.push(ver(id, '2026-09-10', 'NORMAL')); // testado no período
  }
  // 20 extras (base recente → NÃO vencem na janela) mas testados no período.
  for (let i = 0; i < 20; i++) {
    const id = `E${i}`;
    devices.push(dev({ id }));
    verifs.push(ver(id, '2026-06-01', 'NORMAL')); // vence 2027-06 → não previsto
    verifs.push(ver(id, '2026-09-10', 'NORMAL')); // testado → extra
  }
  const cov = computeMaintenanceCoverage(devices, [policy], groupVerificationsByDevice(verifs), {
    contractId: null, periodStart: start, periodEnd: end,
  });

  it('métricas do exemplo', () => {
    expect(cov.programadosPeriodo).toBe(80);
    expect(cov.testadosProgramadosPeriodo).toBe(76);
    expect(cov.naoTestadosPeriodo).toBe(4);
    expect(cov.testadosExtrasPeriodo).toBe(20);
    expect(cov.testadosTotaisPeriodo).toBe(96);
    expect(cov.coberturaProgramadaPct).toBeCloseTo(0.95); // 76/80
  });
  it('teste extra NÃO aumenta programadosPeriodo (80, não 100)', () => {
    expect(cov.programadosPeriodo).toBe(80);
    expect(cov.programadosPeriodo).not.toBe(100);
  });
});

describe('SEM_HISTORICO não vira programado automaticamente (§2)', () => {
  it('com política, sem teste → semHistorico/primeiroTestePendente, fora de programados', () => {
    const cov = computeMaintenanceCoverage([dev({ id: 'novo' })], [policy], new Map(), {
      contractId: null, periodStart: '2026-09-01', periodEnd: '2026-09-30',
    });
    expect(cov.semHistorico).toBe(1);
    expect(cov.primeiroTestePendente).toBe(1);
    expect(cov.programadosPeriodo).toBe(0);
    expect(cov.testadosProgramadosPeriodo).toBe(0);
    expect(cov.coberturaProgramadaPct).toBeNull();
  });
});

describe('janela explícita: mensal vs acumulada (sem hard-code de ano)', () => {
  const devices = [dev({ id: 'x' })];
  const p3: AssetMaintenancePolicy = { ...policy, id: 'p3', periodicidadeValor: 3 };
  const g = groupVerificationsByDevice([
    ver('x', '2026-02-10', 'NORMAL'),
    ver('x', '2026-05-10', 'NORMAL'),
    ver('x', '2026-08-10', 'COM_AVARIA'),
  ]);

  it('mensal Agosto: base de maio vence em agosto → programado e testado (falha)', () => {
    const cov = computeMaintenanceCoverage(devices, [p3], g, { contractId: null, periodStart: '2026-08-01', periodEnd: '2026-08-31' });
    expect(cov.programadosPeriodo).toBe(1);
    expect(cov.testadosProgramadosPeriodo).toBe(1);
    expect(cov.falharamPeriodo).toBe(1);
  });
  it('mensal Setembro: base de agosto vence em novembro → NÃO programado', () => {
    const cov = computeMaintenanceCoverage(devices, [p3], g, { contractId: null, periodStart: '2026-09-01', periodEnd: '2026-09-30' });
    expect(cov.programadosPeriodo).toBe(0);
    expect(cov.testadosProgramadosPeriodo).toBe(0);
  });
});

describe('integração cobertura ← plano (plannedDeviceIds, §13)', () => {
  const start = '2026-09-01';
  const end = '2026-09-30';
  it('quando há plano, programados = plano (inclui SEM_HISTORICO planejado)', () => {
    const devices = [
      dev({ id: 'plan1' }),               // sem histórico, mas PLANEJADO
      dev({ id: 'dueNotPlanned' }),        // venceria, mas NÃO está no plano
    ];
    const verifs = [ver('dueNotPlanned', '2025-08-01', 'NORMAL')]; // vence 2026-08 (venceria)
    const cov = computeMaintenanceCoverage(devices, [policy], groupVerificationsByDevice(verifs), {
      contractId: null, periodStart: start, periodEnd: end, plannedDeviceIds: ['plan1'],
    });
    expect(cov.programadosPeriodo).toBe(1);          // só o do plano
    expect(cov.programadosPeriodo).not.toBe(2);      // heurística de vencimento NÃO domina
  });
  it('sem plano, mantém a heurística (compatibilidade)', () => {
    const devices = [dev({ id: 'due' })];
    const verifs = [ver('due', '2025-08-01', 'NORMAL')];
    const cov = computeMaintenanceCoverage(devices, [policy], groupVerificationsByDevice(verifs), {
      contractId: null, periodStart: start, periodEnd: end,
    });
    expect(cov.programadosPeriodo).toBe(1);
  });
});
