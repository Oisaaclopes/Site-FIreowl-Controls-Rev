import { describe, it, expect } from 'vitest';
import { montarProposta, detectarVazamento, TERMOS_PROIBIDOS } from './proposta';
import { montarHtmlProposta } from './propostaPdf';
import { Pendencia } from './types';

// Critério de aceite #23: o PDF gerado NÃO pode conter contingência, margem,
// custo unitário, criticidade nem BDI.

const pendencias: Pendencia[] = [
  {
    id: '1',
    status: 'aberta',
    grupo: 'SDAI > Detecção',
    descricao: 'Detector sem resposta',
    acaoRecomendada: 'substituir',
    local: 'Depósito',
    quantidade: 3,
    unidade: 'pç',
    itemCatalogoId: 'Detector óptico DFE-521',
    criticidadeOperacional: 3, // INTERNO — não pode vazar
  },
];

describe('proposta — trava anti-vazamento (10.4)', () => {
  const { composicao, publica } = montarProposta(pendencias, {
    numero: 'PROP-2026-0001',
    cliente: 'Shopping Teste',
    regime: 'unitario',
    contingenciaPct: 0.2,
    margemPct: 0.3,
    precoItem: () => 250,
    logistica: 800,
    prazoDias: 5,
    tecnicos: 2,
  });

  it('a composição interna calcula contingência e margem (para uso interno)', () => {
    expect(composicao.contingencia).toBeGreaterThan(0);
    expect(composicao.margem).toBeGreaterThan(0);
    expect(composicao.precoVenda).toBeGreaterThan(composicao.subtotalCusto);
  });

  it('o objeto público expõe apenas precoVenda (sem custo/margem/contingência)', () => {
    const chaves = Object.keys(publica);
    expect(chaves).not.toContain('contingencia');
    expect(chaves).not.toContain('margem');
    expect(chaves).not.toContain('materiais_custo');
    expect(publica.precoVenda).toBe(composicao.precoVenda);
  });

  it('o HTML do PDF não contém nenhum termo interno da lista negra', () => {
    const html = montarHtmlProposta(publica);
    const texto = html.replace(/<[^>]+>/g, ' ');
    const vazados = detectarVazamento(texto);
    expect(vazados).toEqual([]);
  });

  it('detectarVazamento realmente pega um termo plantado (sanidade)', () => {
    for (const termo of TERMOS_PROIBIDOS) {
      expect(detectarVazamento(`bla ${termo} bla`)).toContain(termo);
    }
  });

  it('regime fechado não imprime quantitativo', () => {
    const fechado = montarProposta(pendencias, {
      numero: 'PROP-2026-0002',
      cliente: 'Shopping Teste',
      regime: 'fechado',
      contingenciaPct: 0.15,
      precoItem: () => 250,
    }).publica;
    const html = montarHtmlProposta(fechado);
    expect(html).not.toContain('>Qtd.<');
  });
});
