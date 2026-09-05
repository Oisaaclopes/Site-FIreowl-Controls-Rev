import { describe, expect, it } from 'vitest';
import { allocateProportional, finalUnitCost, weightedAverageCost } from './supplyCost';

describe('allocateProportional — rateio proporcional ao valor (§5)', () => {
  it('D) frete rateado proporcional ao valor da mercadoria', () => {
    // Item A 1000, B 500, frete 150 → A 100, B 50
    expect(allocateProportional([1000, 500], 150)).toEqual([100, 50]);
  });
  it('E) outros custos usam a mesma regra', () => {
    expect(allocateProportional([1000, 500], 30)).toEqual([20, 10]);
  });
  it('resto de centavos vai para o último item (soma bate)', () => {
    const a = allocateProportional([1, 1, 1], 10); // 3.33 + 3.33 + 3.34
    expect(a.reduce((x, y) => x + y, 0)).toBeCloseTo(10, 2);
    expect(a[2]).toBeCloseTo(3.34, 2);
  });
  it('total zero → tudo zero; valores zero → divisão igual', () => {
    expect(allocateProportional([1000, 500], 0)).toEqual([0, 0]);
    expect(allocateProportional([0, 0], 10)).toEqual([5, 5]);
  });
});

describe('finalUnitCost — mercadoria + rateio por unidade (§8)', () => {
  it('custo produto + frete rateado por unidade', () => {
    // custo 235.59; frete alloc 24.80 em 2 un → +12.40; outros 0
    expect(finalUnitCost(235.59, 24.8, 0, 2)).toBeCloseTo(247.99, 2);
  });
  it('sem rateio → custo do produto', () => {
    expect(finalUnitCost(235.59, 0, 0, 8)).toBeCloseTo(235.59, 2);
  });
});

describe('weightedAverageCost — custo médio ponderado (§11)', () => {
  it('H) saldo anterior zero → custo = custo da entrada', () => {
    expect(weightedAverageCost(0, null, 3, 250)).toBe(250);
    expect(weightedAverageCost(0, 999, 3, 250)).toBe(250); // sem saldo, ignora custo anterior
  });
  it('I) saldo anterior existente → média ponderada', () => {
    // 2×200 + 3×250 = 1150 / 5 = 230
    expect(weightedAverageCost(2, 200, 3, 250)).toBe(230);
  });
  it('entrada zero mantém custo anterior', () => {
    expect(weightedAverageCost(5, 230, 0, 999)).toBe(230);
  });
});
