/* =====================================================================
 * Política e geração de senha (reset administrativo). Puro e testável.
 * Gerador usa CSPRNG (crypto.getRandomValues) — NUNCA Math.random (§B8).
 * ===================================================================== */

export const PASSWORD_MIN = 10;

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sem I/O (ambiguidade visual)
const LOWER = 'abcdefghijkmnpqrstuvwxyz'; // sem l
const DIGIT = '23456789';                 // sem 0/1
const SYMBOL = '!@#$%*?-_';

function secureInt(max: number): number {
  // Inteiro uniforme em [0, max) via rejeição de módulo enviesado.
  const c = (globalThis.crypto || (globalThis as unknown as { crypto: Crypto }).crypto);
  const limit = Math.floor(0xffffffff / max) * max;
  const buf = new Uint32Array(1);
  let x = 0;
  do { c.getRandomValues(buf); x = buf[0]; } while (x >= limit);
  return x % max;
}

const pick = (chars: string): string => chars[secureInt(chars.length)];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = secureInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Senha forte: garante ao menos 1 de cada classe; comprimento >= 12 por padrão. */
export function generateStrongPassword(length = 14): string {
  const size = Math.max(length, 12);
  const required = [pick(UPPER), pick(LOWER), pick(DIGIT), pick(SYMBOL)];
  const all = UPPER + LOWER + DIGIT + SYMBOL;
  const rest = Array.from({ length: size - required.length }, () => pick(all));
  return shuffle([...required, ...rest]).join('');
}

export interface PasswordCheck {
  ok: boolean;
  length: boolean;
  upper: boolean;
  lower: boolean;
  digit: boolean;
  symbol: boolean;
}

/** Validação de força (mín. comprimento + maiúscula + minúscula + número + símbolo). */
export function checkPassword(pw: string, min = PASSWORD_MIN): PasswordCheck {
  const length = pw.length >= min;
  const upper = /[A-Z]/.test(pw);
  const lower = /[a-z]/.test(pw);
  const digit = /[0-9]/.test(pw);
  const symbol = /[^A-Za-z0-9]/.test(pw);
  return { ok: length && upper && lower && digit && symbol, length, upper, lower, digit, symbol };
}
