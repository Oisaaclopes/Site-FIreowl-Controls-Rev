import { describe, it, expect } from 'vitest';
import {
  SECAO_KEYS,
  SECOES_NATIVAS_ORCAMENTO,
  alternarSecao,
  ehSecaoPadrao,
  igualAoPadrao,
  normalizarSecoes,
  secoesEfetivas,
  secoesExtras,
  secoesPadraoDoTipo,
  secoesPersonalizadas,
  secoesSelecionadas,
} from './documentoSecoes';
import { montarEstruturaProposta } from './propostaEstrutura';

describe('secoesPadraoDoTipo — padrão pré-definido por Tipo de Pedido', () => {
  it('Orçamento e Fornecimento vêm com as seções enxutas do orçamento', () => {
    const orc = secoesPadraoDoTipo('orcamento');
    expect(orc).toEqual(normalizarSecoes(SECOES_NATIVAS_ORCAMENTO));
    expect(secoesPadraoDoTipo('fornecimento')).toEqual(orc);
    expect(orc).not.toContain('entregaveis');
    expect(orc).toContain('escopo');
    expect(orc).not.toContain('carta');
    expect(orc).toContain('premissas');
  });

  it('Proposta e Serviço vêm com todas as seções', () => {
    expect(secoesPadraoDoTipo('proposta')).toEqual(SECAO_KEYS);
    expect(secoesPadraoDoTipo('servico')).toEqual(SECAO_KEYS);
  });

  it('Proposta respeita cláusulas desligadas pelas flags antigas', () => {
    const s = secoesPadraoDoTipo('proposta', { incluirMultas: false, incluirSeguranca: false });
    expect(s).not.toContain('multas');
    expect(s).not.toContain('seguranca');
    expect(s).toContain('limitacao');
  });

  it('Laudo vem com objetivo, itens e parecer', () => {
    expect(secoesPadraoDoTipo('laudo')).toEqual(['visao', 'itens', 'conclusao']);
  });

  it('Personalizado começa sem nenhuma seção', () => {
    expect(secoesPadraoDoTipo('personalizado')).toEqual([]);
  });

  it('sem tipo = proposta completa (documento histórico)', () => {
    expect(secoesPadraoDoTipo(undefined)).toEqual(SECAO_KEYS);
    expect(secoesPadraoDoTipo('')).toEqual(SECAO_KEYS);
  });
});

describe('seleção explícita × legado', () => {
  it('pedido antigo (sem secoesDocumento) não é personalizado → null', () => {
    expect(secoesPersonalizadas({})).toBe(false);
    expect(secoesSelecionadas({})).toBeNull();
    expect(secoesSelecionadas(undefined)).toBeNull();
  });

  it('lista vazia é uma seleção explícita (Personalizado do zero)', () => {
    expect(secoesPersonalizadas({ secoesDocumento: [] })).toBe(true);
    expect(secoesSelecionadas({ secoesDocumento: [] })?.size).toBe(0);
  });

  it('descarta chaves desconhecidas e repetidas, mantendo a ordem canônica', () => {
    expect(normalizarSecoes(['garantia', 'xpto', 'premissas', 'garantia'])).toEqual(['premissas', 'garantia']);
  });

  it('secoesEfetivas usa a seleção quando existe, senão o padrão do tipo', () => {
    expect(secoesEfetivas({ pedidoTipo: 'orcamento' })).toEqual(secoesPadraoDoTipo('orcamento'));
    expect(secoesEfetivas({ pedidoTipo: 'orcamento', secoesDocumento: ['premissas'] })).toEqual(['premissas']);
  });
});

describe('alternarSecao / destaque', () => {
  it('liga premissas… e entregáveis num Orçamento', () => {
    const base = secoesPadraoDoTipo('orcamento');
    const next = alternarSecao(base, 'entregaveis');
    expect(next).toContain('entregaveis');
    expect(next.indexOf('entregaveis')).toBeGreaterThan(next.indexOf('itens'));
  });

  it('tira seções de uma Proposta', () => {
    const next = alternarSecao(secoesPadraoDoTipo('proposta'), 'garantia', false);
    expect(next).not.toContain('garantia');
    expect(alternarSecao(next, 'garantia', false)).toEqual(next);
  });

  it('destaca as seções pré-definidas do tipo', () => {
    expect(ehSecaoPadrao('orcamento', 'precos')).toBe(true);
    expect(ehSecaoPadrao('orcamento', 'carta')).toBe(false);
    expect(ehSecaoPadrao('personalizado', 'precos')).toBe(false);
  });

  it('igualAoPadrao reconhece a seleção padrão em qualquer ordem', () => {
    const pad = [...secoesPadraoDoTipo('orcamento')].reverse();
    expect(igualAoPadrao(pad, 'orcamento')).toBe(true);
    expect(igualAoPadrao(alternarSecao(pad, 'carta'), 'orcamento')).toBe(false);
  });

  it('secoesExtras lista o que o gerador não desenha nativamente', () => {
    const sel = new Set(alternarSecao(secoesPadraoDoTipo('orcamento'), 'entregaveis'));
    expect(secoesExtras(sel, SECOES_NATIVAS_ORCAMENTO)).toEqual(['entregaveis']);
  });
});

describe('estrutura da proposta × seleção', () => {
  const ctx = { cartaVisivel: true, historicoVisivel: true, temMateriais: true, garantiaVisivel: true };

  it('sem seleção a estrutura é a histórica (sem entregáveis/incluso separados)', () => {
    const e = montarEstruturaProposta({}, ctx);
    expect(e.map((s) => s.key)).not.toContain('entregaveis');
    expect(e.map((s) => s.key)).not.toContain('incluso');
    expect(e.every((s) => s.visible)).toBe(true);
  });

  it('com seleção, a visibilidade segue os toggles', () => {
    const e = montarEstruturaProposta({ incluirMultas: false }, { ...ctx, selecao: new Set(['premissas', 'entregaveis', 'multas']) });
    const vis = e.filter((s) => s.visible).map((s) => s.key);
    expect(vis).toEqual(['premissas', 'entregaveis', 'multas']);
  });

  it('garantia selecionada sem conteúdo não aparece', () => {
    const e = montarEstruturaProposta({}, { ...ctx, garantiaVisivel: false, selecao: new Set(['garantia']) });
    expect(e.filter((s) => s.visible)).toEqual([]);
  });
});
