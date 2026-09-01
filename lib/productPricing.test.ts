import { describe, expect, it } from 'vitest';
import {
  calculateProfit, calculateMarkup, calculateMargin, productPricing,
  effectivePrice, isInformed, moneyOrDash, percentOrDash, ratioOrDash,
} from './productPricing';
import type { InventoryItem } from './types';

const item = (o: Partial<InventoryItem>): InventoryItem => ({ id: 'x', code: '', name: '', category: '', quantity: 0, minQuantity: 0, unitPrice: 0, supplier: '', location: '', ...o } as InventoryItem);

describe('productPricing — fórmulas', () => {
  it('lucro = preço − custo', () => {
    expect(calculateProfit(100, 150)).toBe(50);
  });
  it('markup = preço / custo (razão)', () => {
    expect(calculateMarkup(100, 250)).toBe(2.5);
  });
  it('margem = ((preço − custo) / preço) × 100', () => {
    expect(calculateMargin(100, 200)).toBe(50);
    expect(calculateMargin(60, 100)).toBe(40);
  });
});

describe('productPricing — null / zero (nunca NaN/Infinity/R$0)', () => {
  it('custo null → derivados null', () => {
    expect(calculateProfit(null, 150)).toBeNull();
    expect(calculateMarkup(null, 150)).toBeNull();
    expect(calculateMargin(null, 150)).toBeNull();
  });
  it('preço null → derivados null', () => {
    expect(calculateProfit(100, null)).toBeNull();
    expect(calculateMarkup(100, null)).toBeNull();
    expect(calculateMargin(100, null)).toBeNull();
  });
  it('custo 0 → markup/margem null (sem divisão por zero, sem Infinity)', () => {
    expect(calculateMarkup(0, 150)).toBeNull();
    expect(calculateMargin(0, 150)).toBeNull();
    expect(calculateProfit(0, 150)).toBeNull();
  });
  it('preço 0 → derivados null', () => {
    expect(calculateProfit(100, 0)).toBeNull();
    expect(calculateMargin(100, 0)).toBeNull();
  });
  it('isInformed rejeita null, 0, negativo, NaN', () => {
    expect(isInformed(10)).toBe(true);
    expect(isInformed(0)).toBe(false);
    expect(isInformed(-5)).toBe(false);
    expect(isInformed(null)).toBe(false);
    expect(isInformed(undefined)).toBe(false);
    expect(isInformed(NaN)).toBe(false);
  });
});

describe('productPricing — item e formatação', () => {
  it('effectivePrice usa salePrice senão unitPrice', () => {
    expect(effectivePrice(item({ salePrice: 200, unitPrice: 10 }))).toBe(200);
    expect(effectivePrice(item({ unitPrice: 10 }))).toBe(10);
    expect(effectivePrice(item({ unitPrice: 0 }))).toBeNull();
  });
  it('productPricing calcula pacote completo', () => {
    const p = productPricing(item({ costPrice: 100, salePrice: 250 }));
    expect(p).toEqual({ cost: 100, price: 250, profit: 150, markup: 2.5, margin: 60 });
  });
  it('productPricing com custo ausente', () => {
    const p = productPricing(item({ salePrice: 250 }));
    expect(p.cost).toBeNull();
    expect(p.profit).toBeNull();
    expect(p.markup).toBeNull();
    expect(p.margin).toBeNull();
    expect(p.price).toBe(250);
  });
  it('formatação: dash quando ausente, nunca R$ 0,00', () => {
    expect(moneyOrDash(null)).toBe('—');
    expect(moneyOrDash(0)).toBe('—');
    expect(moneyOrDash(1234.5)).toContain('1.234,50');
    expect(percentOrDash(null)).toBe('—');
    expect(percentOrDash(40)).toBe('40%');
    expect(ratioOrDash(null)).toBe('—');
    expect(ratioOrDash(2.5)).toBe('2,5×');
  });
});
