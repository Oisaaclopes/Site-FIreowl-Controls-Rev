import { describe, expect, it } from 'vitest';
import type { AssetMaintenancePolicy } from './types';
import {
  addPeriodicity,
  addMonthsCalendar,
  formatDateUTC,
  maintenanceStatus,
  nextMaintenanceDate,
  parseDateUTC,
  resolveEffectivePolicy,
  policySpecificity,
  type AssetPolicyContext,
} from './maintenancePolicies';

const mk = (p: Partial<AssetMaintenancePolicy> & Pick<AssetMaintenancePolicy, 'id' | 'escopo'>): AssetMaintenancePolicy => ({
  periodicidadeValor: 12, periodicidadeUnidade: 'MES', ativa: true, ...p,
});

// Ativo C, cliente A, contrato B, SDAI/Detector.
const ctx: AssetPolicyContext = { deviceId: 'C', clienteId: 'A', area: 'SDAI', tipoAtivo: 'Detector', grupo: 'Deteccao' };

describe('resolveEffectivePolicy — precedência ATIVO > CONTRATO > CLIENTE > PADRAO', () => {
  const padrao = mk({ id: 'p', escopo: 'PADRAO', area: 'SDAI', tipoAtivo: 'Detector', periodicidadeValor: 12 });
  const cliente = mk({ id: 'cl', escopo: 'CLIENTE', clienteId: 'A', area: 'SDAI', tipoAtivo: 'Detector', periodicidadeValor: 9 });
  const contrato = mk({ id: 'ct', escopo: 'CONTRATO', contractId: 'B', area: 'SDAI', tipoAtivo: 'Detector', periodicidadeValor: 6 });
  const ativo = mk({ id: 'at', escopo: 'ATIVO', deviceId: 'C', periodicidadeValor: 3 });

  it('ATIVO vence todos → 3 meses', () => {
    expect(resolveEffectivePolicy(ctx, 'B', [padrao, cliente, contrato, ativo])?.periodicidadeValor).toBe(3);
  });
  it('sem ATIVO → CONTRATO (6)', () => {
    expect(resolveEffectivePolicy(ctx, 'B', [padrao, cliente, contrato])?.periodicidadeValor).toBe(6);
  });
  it('sem CONTRATO → CLIENTE (9)', () => {
    expect(resolveEffectivePolicy(ctx, 'B', [padrao, cliente])?.periodicidadeValor).toBe(9);
  });
  it('sem CLIENTE → PADRAO (12)', () => {
    expect(resolveEffectivePolicy(ctx, 'B', [padrao])?.periodicidadeValor).toBe(12);
  });
  it('escopo domina a classificação (gap 1000 > bônus 600)', () => {
    // PADRAO super específico (area+grupo+tipo) NÃO supera CONTRATO só-contrato.
    const padraoMax = mk({ id: 'pmax', escopo: 'PADRAO', area: 'SDAI', grupo: 'Deteccao', tipoAtivo: 'Detector', periodicidadeValor: 99 });
    const contratoBase = mk({ id: 'cbase', escopo: 'CONTRATO', contractId: 'B', periodicidadeValor: 6 });
    expect(resolveEffectivePolicy(ctx, 'B', [padraoMax, contratoBase])?.periodicidadeValor).toBe(6);
  });
});

describe('resolveEffectivePolicy — especificidade dentro do mesmo escopo', () => {
  it('area+tipo vence area-only', () => {
    const areaOnly = mk({ id: 'a', escopo: 'PADRAO', area: 'SDAI', periodicidadeValor: 12 });
    const areaTipo = mk({ id: 'b', escopo: 'PADRAO', area: 'SDAI', tipoAtivo: 'Detector', periodicidadeValor: 10 });
    expect(resolveEffectivePolicy(ctx, 'B', [areaOnly, areaTipo])?.periodicidadeValor).toBe(10);
    expect(policySpecificity(areaTipo)).toBeGreaterThan(policySpecificity(areaOnly));
  });
});

describe('resolveEffectivePolicy — política inativa é ignorada', () => {
  it('ATIVO inativo cai para CONTRATO', () => {
    const ativoInativo = mk({ id: 'at', escopo: 'ATIVO', deviceId: 'C', periodicidadeValor: 3, ativa: false });
    const contrato = mk({ id: 'ct', escopo: 'CONTRATO', contractId: 'B', periodicidadeValor: 6 });
    expect(resolveEffectivePolicy(ctx, 'B', [ativoInativo, contrato])?.periodicidadeValor).toBe(6);
  });
});

describe('resolveEffectivePolicy — sem match', () => {
  it('nenhuma política casa → null (SEM_POLITICA)', () => {
    const outro = mk({ id: 'x', escopo: 'CONTRATO', contractId: 'OUTRO', periodicidadeValor: 6 });
    expect(resolveEffectivePolicy(ctx, 'B', [outro])).toBeNull();
  });
  it('curinga: PADRAO sem filtros casa qualquer ativo', () => {
    const global = mk({ id: 'g', escopo: 'PADRAO', periodicidadeValor: 24 });
    expect(resolveEffectivePolicy(ctx, 'B', [global])?.periodicidadeValor).toBe(24);
  });
});

describe('periodicidade — DIA/SEMANA duração fixa', () => {
  it('15 DIAS', () => {
    expect(formatDateUTC(addPeriodicity(parseDateUTC('2026-01-01'), 15, 'DIA'))).toBe('2026-01-16');
  });
  it('2 SEMANAS', () => {
    expect(formatDateUTC(addPeriodicity(parseDateUTC('2026-01-01'), 2, 'SEMANA'))).toBe('2026-01-15');
  });
});

describe('periodicidade — MES/ANO aritmética de calendário (fim de mês)', () => {
  it('31/01/2026 + 1 MES → 28/02/2026', () => {
    expect(formatDateUTC(addMonthsCalendar(parseDateUTC('2026-01-31'), 1))).toBe('2026-02-28');
  });
  it('31/01/2028 + 1 MES → 29/02/2028 (bissexto)', () => {
    expect(formatDateUTC(addMonthsCalendar(parseDateUTC('2028-01-31'), 1))).toBe('2028-02-29');
  });
  it('29/02/2028 + 1 ANO → 28/02/2029 (determinístico)', () => {
    expect(formatDateUTC(addPeriodicity(parseDateUTC('2028-02-29'), 1, 'ANO'))).toBe('2029-02-28');
  });
  it('31/12 + 1 MES → 31/01 (mês seguinte tem o dia)', () => {
    expect(formatDateUTC(addMonthsCalendar(parseDateUTC('2026-12-31'), 1))).toBe('2027-01-31');
  });
  it('nextMaintenanceDate 12 MES', () => {
    expect(nextMaintenanceDate('2025-05-10', { periodicidadeValor: 12, periodicidadeUnidade: 'MES' })).toBe('2026-05-10');
  });
});

describe('maintenanceStatus', () => {
  it('EM_DIA quando falta muito', () => {
    expect(maintenanceStatus('2026-05-10', '2026-03-01', 0, 30)).toBe('EM_DIA');
  });
  it('PROXIMO dentro da janela', () => {
    expect(maintenanceStatus('2026-05-10', '2026-05-01', 0, 30)).toBe('PROXIMO');
  });
  it('VENCIDO após o vencimento + carência', () => {
    expect(maintenanceStatus('2026-05-10', '2026-06-01', 0, 30)).toBe('VENCIDO');
  });
  it('carência mantém PROXIMO logo após o vencimento', () => {
    expect(maintenanceStatus('2026-05-10', '2026-05-12', 5, 30)).toBe('PROXIMO');
  });
});
