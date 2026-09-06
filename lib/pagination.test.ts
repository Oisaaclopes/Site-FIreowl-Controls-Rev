import { describe, expect, it } from 'vitest';
import { paginate, pageWindow, DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from './pagination';

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe('paginate — fatiamento correto (Bloco 1)', () => {
  it('24 itens + pageSize 15 → página 1 mostra 1–15', () => {
    const r = paginate(range(24), 1, 15);
    expect(r.pageItems).toEqual(range(15));
    expect(r.totalPages).toBe(2);
    expect(r.from).toBe(1); expect(r.to).toBe(15); expect(r.total).toBe(24);
  });

  it('24 itens + pageSize 15 → página 2 mostra 16–24 (9 itens)', () => {
    const r = paginate(range(24), 2, 15);
    expect(r.pageItems).toEqual([16, 17, 18, 19, 20, 21, 22, 23, 24]);
    expect(r.pageItems).toHaveLength(9);
    expect(r.from).toBe(16); expect(r.to).toBe(24);
  });

  it('24 itens + pageSize 30/50/100 → página única com todos os 24', () => {
    for (const size of [30, 50, 100]) {
      const r = paginate(range(24), 1, size);
      expect(r.pageItems).toHaveLength(24);
      expect(r.totalPages).toBe(1);
      expect(r.from).toBe(1); expect(r.to).toBe(24);
    }
  });

  it('47 itens + pageSize 15 → 4 páginas (última 46–47)', () => {
    expect(paginate(range(47), 1, 15).totalPages).toBe(4);
    const last = paginate(range(47), 4, 15);
    expect(last.pageItems).toEqual([46, 47]);
    expect(last.from).toBe(46); expect(last.to).toBe(47);
  });

  it('página fora do intervalo é clampeada (nunca > totalPages)', () => {
    const r = paginate(range(24), 99, 15);
    expect(r.safePage).toBe(2);
    expect(r.pageItems).toEqual([16, 17, 18, 19, 20, 21, 22, 23, 24]);
  });

  it('lista vazia → 1 página, from/to = 0', () => {
    const r = paginate([], 1, 15);
    expect(r.totalPages).toBe(1); expect(r.from).toBe(0); expect(r.to).toBe(0); expect(r.pageItems).toEqual([]);
  });

  it('constantes canônicas', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(15);
    expect(PAGE_SIZE_OPTIONS).toEqual([15, 30, 50, 100]);
  });
});

describe('pageWindow — barra numerada com reticências', () => {
  it('poucas páginas: sem reticências', () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
  });
  it('muitas páginas no meio: reticências dos dois lados', () => {
    expect(pageWindow(5, 10)).toEqual([1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]);
  });
  it('início: sem reticência à esquerda', () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, 'ellipsis', 10]);
  });
  it('fim: sem reticência à direita', () => {
    expect(pageWindow(10, 10)).toEqual([1, 'ellipsis', 9, 10]);
  });
  it('1 página → [1]', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
  });
});
