import { describe, it, expect } from 'vitest';
import {
  SECAO_KEYS,
  SECOES_NATIVAS_ORCAMENTO,
  alternarSecao,
  atualizarPadraoEmpresa,
  mesmasSecoes,
  padraoEmpresaDoTipo,
  padraoReferenciaDoTipo,
  ehSecaoPadrao,
  igualAoPadrao,
  normalizarSecoes,
  secoesEfetivas,
  secoesExtras,
  secoesPadraoDoTipo,
  secoesPersonalizadas,
  secoesSelecionadas,
  moverSecao,
  ordenarSecoes,
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

  it('Laudo vem com objetivo, normas, itens (materiais e serviços) e parecer', () => {
    expect(secoesPadraoDoTipo('laudo')).toEqual(['visao', 'normas', 'itens', 'itensServicos', 'conclusao']);
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

describe('padrão da empresa × padrão do sistema × seleção', () => {
  it('sem padrão salvo, a referência é o padrão do sistema', () => {
    expect(padraoEmpresaDoTipo('orcamento', {})).toBeNull();
    expect(padraoReferenciaDoTipo('orcamento', undefined)).toEqual(secoesPadraoDoTipo('orcamento'));
  });

  it('padrão salvo da empresa vira a referência do tipo (normalizado)', () => {
    const empresa = { orcamento: ['premissas', 'carta', 'xpto', 'carta'] };
    expect(padraoEmpresaDoTipo('orcamento', empresa)).toEqual(['carta', 'premissas']);
    expect(padraoReferenciaDoTipo('orcamento', empresa)).toEqual(['carta', 'premissas']);
    // outros tipos seguem no padrão do sistema
    expect(padraoReferenciaDoTipo('proposta', empresa)).toEqual(SECAO_KEYS);
  });

  it('padrão salvo vazio é válido (tipo começa todo em Não)', () => {
    expect(padraoReferenciaDoTipo('orcamento', { orcamento: [] })).toEqual([]);
  });

  it('salvar grava a lista; restaurar remove a chave', () => {
    const salvo = atualizarPadraoEmpresa({}, 'orcamento', ['premissas', 'itens']);
    expect(salvo).toEqual({ orcamento: ['itens', 'premissas'] });
    expect(atualizarPadraoEmpresa(salvo, 'orcamento', null)).toEqual({});
  });

  it('salvar igual ao padrão do sistema não guarda redundância', () => {
    expect(atualizarPadraoEmpresa({ laudo: ['visao'] }, 'orcamento', secoesPadraoDoTipo('orcamento'))).toEqual({ laudo: ['visao'] });
  });

  it('mesmasSecoes ignora ordem e repetição', () => {
    expect(mesmasSecoes(['garantia', 'itens', 'itens'], ['itens', 'garantia'])).toBe(true);
    expect(mesmasSecoes(['itens'], ['itens', 'garantia'])).toBe(false);
  });
});

describe('seções independentes (bug: Objetivo levava Diretrizes junto)', () => {
  it('desligar Objetivo não desliga Diretrizes Normativas', () => {
    const sel = alternarSecao(secoesPadraoDoTipo('proposta'), 'visao', false);
    expect(sel).not.toContain('visao');
    expect(sel).toContain('normas');
  });

  it('Descrição dos Serviços e Responsabilidades da Contratada são independentes', () => {
    const sel = alternarSecao(secoesPadraoDoTipo('proposta'), 'servicos', false);
    expect(sel).toContain('responsabilidades');
  });

  it('listas de Materiais e de Serviços são independentes', () => {
    const sel = alternarSecao(secoesPadraoDoTipo('orcamento'), 'itens', false);
    expect(sel).toContain('itensServicos');
    // só a Lista de Serviços ligada ainda gera a seção de itens no documento
    expect(ordenarSecoes(['itensServicos'])).toEqual(['itens']);
  });

  it('na estrutura da proposta, Objetivo em Não e Diretrizes em Sim', () => {
    const ctx = { cartaVisivel: true, historicoVisivel: true, temMateriais: true, garantiaVisivel: true, selecao: new Set(['normas', 'responsabilidades']) };
    const vis = montarEstruturaProposta({}, ctx).filter((s) => s.visible).map((s) => s.key);
    expect(vis).toEqual(['normas', 'responsabilidades']);
  });
});

describe('ordem das seções (setas ▲▼ no título dos cards)', () => {
  it('sem ordem salva = ordem canônica, Carta no início e Aceite no fim', () => {
    expect(ordenarSecoes(['aceite', 'premissas', 'carta', 'visao'])).toEqual(['carta', 'visao', 'premissas', 'aceite']);
  });

  it('respeita a ordem salva no miolo; Carta e Aceite continuam fixos', () => {
    expect(ordenarSecoes(['aceite', 'premissas', 'carta', 'visao'], ['aceite', 'premissas', 'carta', 'visao'])).toEqual(['carta', 'premissas', 'visao', 'aceite']);
  });

  it('subir troca com a vizinha visível (pula seções sem card)', () => {
    const cards = ['visao', 'premissas', 'garantia'] as const;
    const ordem = moverSecao(undefined, 'premissas', -1, [...cards]);
    expect(ordem.indexOf('premissas')).toBeLessThan(ordem.indexOf('visao'));
    const vis = ordenarSecoes([...cards], ordem);
    expect(vis).toEqual(['premissas', 'visao', 'garantia']);
  });

  it('descer a última não muda nada; carta/aceite não entram no miolo', () => {
    const ordem = moverSecao(undefined, 'garantia', 1, ['visao', 'garantia']);
    expect(ordenarSecoes(['visao', 'garantia'], ordem)).toEqual(['visao', 'garantia']);
    expect(ordem).not.toContain('carta');
    expect(ordem).not.toContain('aceite');
  });
});
