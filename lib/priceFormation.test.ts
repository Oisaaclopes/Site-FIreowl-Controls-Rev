import { describe, expect, it } from 'vitest';
import { computePricing, principalValue, markupOrDash, isPricingMode } from './priceFormation';

/* MELHORIA — formação de preço flexível (custo + 1 variável → demais). */

describe('computePricing — exemplos obrigatórios (§3/§33)', () => {
  it('A) custo 100 + venda 200 → lucro 100, margem 50%, markup 2×', () => {
    const r = computePricing(100, 'PRICE', 200);
    expect(r).toEqual({ cost: 100, price: 200, profit: 100, margin: 50, markup: 2, error: undefined });
  });

  it('B) custo 100 + margem 40% → venda ~166,67, lucro 66,67, markup 1,6667×', () => {
    const r = computePricing(100, 'MARGIN', 40);
    expect(r.price).toBe(166.67);
    expect(r.profit).toBe(66.67);
    expect(r.margin).toBe(40);
    expect(r.markup).toBe(1.6667);
  });

  it('C) custo 100 + markup 1,8 → venda 180, lucro 80, margem 44,44%', () => {
    const r = computePricing(100, 'MARKUP', 1.8);
    expect(r.price).toBe(180);
    expect(r.profit).toBe(80);
    expect(r.margin).toBe(44.44);
    expect(r.markup).toBe(1.8);
  });

  it('D) custo 100 + lucro 50 → venda 150, margem 33,33%, markup 1,5×', () => {
    const r = computePricing(100, 'PROFIT', 50);
    expect(r.price).toBe(150);
    expect(r.margin).toBe(33.33);
    expect(r.markup).toBe(1.5);
  });
});

describe('computePricing — margem não é acréscimo simples (§7/F)', () => {
  it('margem 40% NÃO resulta em 140 (acréscimo), e sim ~166,67', () => {
    expect(computePricing(100, 'MARGIN', 40).price).not.toBe(140);
    expect(computePricing(100, 'MARGIN', 40).price).toBe(166.67);
  });
});

describe('computePricing — troca de modo recalcula (§4/E)', () => {
  it('preço vindo da margem, relido como PRICE, reproduz a margem', () => {
    const byMargin = computePricing(100, 'MARGIN', 40);
    const asPrice = computePricing(100, 'PRICE', byMargin.price!);
    expect(asPrice.margin).toBe(40);
    expect(asPrice.markup).toBe(byMargin.markup);
  });
  it('principalValue devolve a variável do modo', () => {
    const r = computePricing(100, 'PRICE', 200);
    expect(principalValue('MARGIN', r)).toBe(50);
    expect(principalValue('MARKUP', r)).toBe(2);
    expect(principalValue('PROFIT', r)).toBe(100);
  });
});

describe('computePricing — validações (§10/G)', () => {
  it('margem 100% é rejeitada (evita divisão por zero)', () => {
    const r = computePricing(100, 'MARGIN', 100);
    expect(r.error).toBeTruthy();
    expect(r.price).toBeNull();
  });
  it('margem > 100% rejeitada; margem negativa rejeitada', () => {
    expect(computePricing(100, 'MARGIN', 150).error).toBeTruthy();
    expect(computePricing(100, 'MARGIN', -5).error).toBeTruthy();
  });
  it('markup ≤ 0 rejeitado', () => {
    expect(computePricing(100, 'MARKUP', 0).error).toBeTruthy();
    expect(computePricing(100, 'MARKUP', -1).error).toBeTruthy();
  });
});

describe('computePricing — custo base / null-safe (§5/H)', () => {
  it('custo ausente → tudo null (não calcula margem/markup/lucro)', () => {
    const r = computePricing(null, 'MARGIN', 40);
    expect(r).toEqual({ cost: null, price: null, profit: null, margin: null, markup: null });
  });
  it('custo zero não gera NaN/Infinity', () => {
    const r = computePricing(0, 'PRICE', 150);
    expect(Number.isFinite(r.price!)).toBe(true);
    expect(r.markup).toBeNull(); // preço/0 evitado
    expect(r.margin).toBe(100);
    expect(r.profit).toBe(150);
  });
  it('preço de venda negativo é ignorado', () => {
    expect(computePricing(100, 'PRICE', -10).price).toBeNull();
  });
});

describe('markupOrDash / isPricingMode (§11/I)', () => {
  it('markup até 4 casas sem zeros desnecessários', () => {
    expect(markupOrDash(1.6667)).toBe('1,6667×');
    expect(markupOrDash(1.5)).toBe('1,5×');
    expect(markupOrDash(2)).toBe('2×');
    expect(markupOrDash(null)).toBe('—');
  });
  it('isPricingMode valida os modos', () => {
    expect(isPricingMode('PRICE')).toBe(true);
    expect(isPricingMode('MARGIN')).toBe(true);
    expect(isPricingMode('foo')).toBe(false);
  });
});
