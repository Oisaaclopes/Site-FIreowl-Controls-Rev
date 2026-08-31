import { describe, expect, it } from 'vitest';
import { checkPassword, generateStrongPassword, PASSWORD_MIN } from './password';

describe('política e geração de senha', () => {
  it('senha gerada satisfaz todas as classes e o comprimento mínimo', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateStrongPassword();
      expect(pw.length).toBeGreaterThanOrEqual(12);
      expect(checkPassword(pw).ok).toBe(true);
    }
  });

  it('gerador não é determinístico (usa CSPRNG, não valor fixo)', () => {
    const set = new Set(Array.from({ length: 30 }, () => generateStrongPassword()));
    expect(set.size).toBe(30);
  });

  it('respeita comprimento solicitado (mínimo 12)', () => {
    expect(generateStrongPassword(20).length).toBe(20);
    expect(generateStrongPassword(8).length).toBe(12); // piso de segurança
  });

  it('checkPassword rejeita senhas fracas e aceita fortes', () => {
    expect(checkPassword('abc').ok).toBe(false);
    expect(checkPassword('alllowercase123!').ok).toBe(false); // sem maiúscula
    expect(checkPassword('ALLUPPER123!').ok).toBe(false);     // sem minúscula
    expect(checkPassword('NoDigits!!abc').ok).toBe(false);    // sem número
    expect(checkPassword('NoSymbol123abc').ok).toBe(false);   // sem símbolo
    expect(checkPassword('Curto1!a').ok).toBe(false);         // curto (< 10)
    const strong = checkPassword('Fireowl@2026x');
    expect(strong.ok).toBe(true);
    expect(strong.length && strong.upper && strong.lower && strong.digit && strong.symbol).toBe(true);
  });

  it('PASSWORD_MIN é pelo menos 10', () => {
    expect(PASSWORD_MIN).toBeGreaterThanOrEqual(10);
  });
});
