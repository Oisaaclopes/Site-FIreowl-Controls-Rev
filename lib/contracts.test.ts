import { describe, expect, it } from 'vitest';
import { friendlyContractRef, nextContractNumero } from './contracts';

describe('friendlyContractRef', () => {
  it('usa o número estruturado quando presente', () => {
    expect(friendlyContractRef({ id: 'CTR-FOWL-mtagk3x4', numero: 'CTR-FWL-103' })).toBe('CTR-FWL-103');
  });

  it('deriva um código curto e estável do id (sem expor o id interno)', () => {
    const ref = friendlyContractRef({ id: 'CTR-FOWL-mtagk3x4' });
    expect(ref).toMatch(/^CTR-FWL-\d{3}$/);
    // Determinístico: mesmo id → mesma referência.
    expect(friendlyContractRef({ id: 'CTR-FOWL-mtagk3x4' })).toBe(ref);
  });

  it('não revela ordem/sequência (não vira 001)', () => {
    expect(friendlyContractRef({ id: 'CTR-FOWL-abc' })).not.toContain('001');
  });
});

describe('nextContractNumero', () => {
  it('começa em 101 quando não há números', () => {
    expect(nextContractNumero([])).toBe('CTR-FWL-101');
    expect(nextContractNumero([{ numero: undefined }, { numero: '' }])).toBe('CTR-FWL-101');
  });

  it('incrementa a partir do maior número existente no padrão', () => {
    expect(nextContractNumero([{ numero: 'CTR-FWL-101' }, { numero: 'CTR-FWL-107' }, { numero: 'outro' }])).toBe('CTR-FWL-108');
  });
});
