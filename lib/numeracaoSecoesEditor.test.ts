import { describe, expect, it } from 'vitest';
import { numeracaoSecoesProposta } from './numeracaoSecoesEditor';

describe('numeracaoSecoesProposta', () => {
  it('com seleção: numera só as seções ligadas, na ordem do documento', () => {
    const n = numeracaoSecoesProposta(
      { nivelProposta: 'tecnica' },
      { selecao: new Set(['carta', 'visao', 'normas', 'escopo', 'itens', 'conclusao', 'aceite']), temMateriais: true, garantiaVisivel: true, showHistorico: false },
    );
    expect(n).toEqual({ carta: '01', visao: '02', normas: '03', escopo: '04', itens: '05', conclusao: '06', aceite: '07' });
  });

  it('respeita a ordem escolhida no editor (ordemSecoes)', () => {
    const n = numeracaoSecoesProposta(
      { ordemSecoes: ['escopo', 'visao'] },
      { selecao: new Set(['carta', 'visao', 'escopo', 'aceite']), temMateriais: false, garantiaVisivel: false, showHistorico: false },
    );
    expect(n).toEqual({ carta: '01', escopo: '02', visao: '03', aceite: '04' });
  });

  it('sem seleção: nível Simples tira a carta; histórico entra por padrão', () => {
    const n = numeracaoSecoesProposta({ nivelProposta: 'simples' }, { selecao: null, temMateriais: false, garantiaVisivel: true });
    expect(n.carta).toBeUndefined();
    expect(n.historico).toBe('01');
    expect(n.visao).toBe('02');
    expect(n.embalagem).toBeUndefined();
  });
});
