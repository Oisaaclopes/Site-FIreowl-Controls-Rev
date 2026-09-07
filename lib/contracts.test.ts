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

describe('nextContractNumero (padrão CTR-AAAA-NNN)', () => {
  const y2026 = new Date('2026-06-15T00:00:00Z');
  it('começa em 001 no ano quando não há números do ano', () => {
    expect(nextContractNumero([], y2026)).toBe('CTR-2026-001');
    expect(nextContractNumero([{ numero: undefined }, { numero: '' }], y2026)).toBe('CTR-2026-001');
  });
  it('incrementa a partir do maior número DO ANO', () => {
    expect(nextContractNumero([{ numero: 'CTR-2026-001' }, { numero: 'CTR-2026-007' }], y2026)).toBe('CTR-2026-008');
  });
  it('ignora números legados CTR-FWL-* (padrão abandonado)', () => {
    expect(nextContractNumero([{ numero: 'CTR-FWL-107' }, { numero: 'CTR-FWL-999' }], y2026)).toBe('CTR-2026-001');
  });
  it('sequência é por ano (não mistura anos)', () => {
    const list = [{ numero: 'CTR-2025-050' }, { numero: 'CTR-2026-002' }];
    expect(nextContractNumero(list, y2026)).toBe('CTR-2026-003');
    expect(nextContractNumero(list, new Date('2025-06-15T12:00:00Z'))).toBe('CTR-2025-051');
  });
});
