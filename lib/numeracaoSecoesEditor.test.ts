import { describe, expect, it } from 'vitest';
import { numeracaoPorPosicao } from './numeracaoSecoesEditor';

describe('numeracaoPorPosicao', () => {
  it('numera todas as seções ligadas, em sequência, sem pular', () => {
    const n = numeracaoPorPosicao(['visao', 'normas', 'escopo', 'itens', 'premissas', 'incluso', 'precos']);
    expect(Object.values(n)).toEqual(['01', '02', '03', '04', '05', '06', '07']);
    expect(n.visao).toBe('01');
    expect(n.normas).toBe('02');
  });

  it('desligar uma seção renumera as seguintes', () => {
    const n = numeracaoPorPosicao(['visao', 'escopo', 'itens']);
    expect(n).toEqual({ visao: '01', escopo: '02', itens: '03' });
  });

  it('mover um card muda o número (ordem do editor)', () => {
    const antes = numeracaoPorPosicao(['visao', 'escopo', 'premissas']);
    const depois = numeracaoPorPosicao(['visao', 'escopo', 'premissas'], ['premissas', 'visao', 'escopo']);
    expect(antes.premissas).toBe('03');
    expect(depois.premissas).toBe('01');
    expect(depois.visao).toBe('02');
  });

  it('Carta abre e Aceite fecha; Lista de Serviços conta como a seção de itens', () => {
    const n = numeracaoPorPosicao(['aceite', 'itensServicos', 'carta', 'visao']);
    expect(n.carta).toBe('01');
    expect(n.aceite).toBe(String(Object.keys(n).length).padStart(2, '0'));
    expect(n.itens).toBeDefined();
    expect(n.itensServicos).toBeUndefined();
  });
});
