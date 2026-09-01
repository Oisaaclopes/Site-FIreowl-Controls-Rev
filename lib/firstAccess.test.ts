import { describe, expect, it } from 'vitest';
import { validateFirstAccessPasswords } from './firstAccess';

describe('primeiro acesso', () => {
  it('rejeita senha fraca', () => expect(validateFirstAccessPasswords('fraca', 'fraca')).toMatch(/requisitos/));
  it('rejeita confirmação divergente', () => expect(validateFirstAccessPasswords('Fireowl@2026x', 'Fireowl@2026y')).toMatch(/não coincidem/));
  it('aceita senha forte confirmada', () => expect(validateFirstAccessPasswords('Fireowl@2026x', 'Fireowl@2026x')).toBeNull());
});
