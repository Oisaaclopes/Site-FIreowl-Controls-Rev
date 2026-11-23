import { describe, expect, it } from 'vitest';
import { numeracaoSecoesProposta, numeracaoSecoesOrcamento } from './numeracaoSecoesEditor';

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

describe('numeracaoSecoesOrcamento', () => {
  it('sem seleção própria: números fixos do layout histórico', () => {
    const n = numeracaoSecoesOrcamento({ objetivo: 'Manutenção', equipmentItems: [] } as never);
    expect(n.visao).toBe('01');
    expect(n.itens).toBe('02');
    expect(n.validade).toBe('08');
  });

  it('com seleção: só seções ligadas e com conteúdo, em sequência', () => {
    const n = numeracaoSecoesOrcamento({
      secoesDocumento: ['visao', 'itens', 'itensServicos', 'premissas', 'precos', 'validade'],
      objetivo: 'Manutenção corretiva',
      premissas: [],
      equipmentItems: [{ tipo: 'servico', descricao: 'x', quantidade: 1, precoUnitario: 1 }],
    } as never);
    expect(n).toEqual({ visao: '01', itens: '02', precos: '03', validade: '04' });
  });
});
