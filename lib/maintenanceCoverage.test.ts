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

describe('computeMaintenanceCoverage — base ≠ programados; cobertura = testados/programados', () => {
  const start = '2026-09-01';
  const end = '2026-09-30';
  const devices = [
    dev({ id: 'd1' }), // testado aprovado
    dev({ id: 'd2' }), // testado falha
    dev({ id: 'd3' }), // vencido, não testado
    dev({ id: 'd4' }), // em dia (não previsto neste mês)
    dev({ id: 'd5' }), // sem histórico
    dev({ id: 'd6', tipoAtivo: 'Sirene' }), // sem política
  ];
  const verifs = [
    ver('d1', '2025-09-01', 'NORMAL'), ver('d1', '2026-09-05', 'NORMAL'),
    ver('d2', '2025-09-15', 'NORMAL'), ver('d2', '2026-09-20', 'COM_AVARIA'),
    ver('d3', '2025-08-01', 'NORMAL'), // vence 2026-08-01, não testado em setembro
    ver('d4', '2026-06-01', 'NORMAL'), // vence 2027-06 → não previsto
  ];

  const cov = computeMaintenanceCoverage(devices, [policy], groupVerificationsByDevice(verifs), {
    contractId: null, periodStart: start, periodEnd: end,
  });

  it('contagens', () => {
    expect(cov.totalBase).toBe(6);
    expect(cov.totalComPolitica).toBe(5);
    expect(cov.semPolitica).toBe(1);
    expect(cov.semHistorico).toBe(1);           // d5
    expect(cov.programadosPeriodo).toBe(4);     // d1,d2,d3,d5 (d4 não previsto)
    expect(cov.testadosPeriodo).toBe(2);        // d1,d2
    expect(cov.aprovadosPeriodo).toBe(1);       // d1
    expect(cov.falharamPeriodo).toBe(1);        // d2
    expect(cov.naoTestadosPeriodo).toBe(2);     // d3,d5
  });
  it('percentuais e base ≠ programados (2/4, não 2/6)', () => {
    expect(cov.coberturaProgramadosPct).toBeCloseTo(0.5);   // 2/4
    expect(cov.coberturaBasePct).toBeCloseTo(0.4);          // 2/5
    expect(cov.aprovacaoPct).toBeCloseTo(0.5);              // 1/2
    expect(cov.programadosPeriodo).not.toBe(cov.totalBase); // 4 ≠ 6
  });
});

describe('cobertura mensal vs acumulada (janela explícita, sem hard-code de ano)', () => {
  const devices = [dev({ id: 'x' })];
  const verifs = [
    ver('x', '2026-02-10', 'NORMAL'),
    ver('x', '2026-05-10', 'NORMAL'),
    ver('x', '2026-08-10', 'COM_AVARIA'),
  ];
  const g = groupVerificationsByDevice(verifs);
  const p3: AssetMaintenancePolicy = { ...policy, id: 'p3', periodicidadeValor: 3 };

  it('acumulado Jan–Set: 1 programado, 1 testado (última = falha)', () => {
    const cov = computeMaintenanceCoverage(devices, [p3], g, { contractId: null, periodStart: '2026-01-01', periodEnd: '2026-09-30' });
    expect(cov.programadosPeriodo).toBe(1);
    expect(cov.testadosPeriodo).toBe(1);
    expect(cov.falharamPeriodo).toBe(1);
  });
  it('mensal Agosto: previsto e testado', () => {
    const cov = computeMaintenanceCoverage(devices, [p3], g, { contractId: null, periodStart: '2026-08-01', periodEnd: '2026-08-31' });
    expect(cov.programadosPeriodo).toBe(1);
    expect(cov.testadosPeriodo).toBe(1);
  });
  it('mensal Setembro: NÃO previsto (venceria em novembro) e não testado', () => {
    const cov = computeMaintenanceCoverage(devices, [p3], g, { contractId: null, periodStart: '2026-09-01', periodEnd: '2026-09-30' });
    expect(cov.programadosPeriodo).toBe(0);
    expect(cov.testadosPeriodo).toBe(0);
  });
});
