import { describe, expect, it } from 'vitest';
import { GUIA_IA, MODELOS_IA, limparTextoParaIA } from './orcamentoIAModelos';

describe('limparTextoParaIA', () => {
  it('remove comentários, campos vazios, itens vazios e cabeçalhos sem lista', () => {
    const entrada = [
      '﻿# instrução',
      'Tipo: Orçamento',
      'Título: Alarme',
      'Local:',
      'CNPJ:   ',
      'Responsabilidades da Fireowl:',
      '- Instalar',
      '- ',
      'Não inclusos:',
      '- ',
      '',
      '',
      '',
      'Opcional (não somar):',
      '',
      '- Repetidor — 450,00',
    ].join('\r\n');
    expect(limparTextoParaIA(entrada)).toBe(
      ['Tipo: Orçamento', 'Título: Alarme', 'Responsabilidades da Fireowl:', '- Instalar', '', 'Opcional (não somar):', '', '- Repetidor — 450,00'].join('\n')
    );
  });

  it('modelo em branco quase some (só sobra o que tem valor padrão)', () => {
    for (const m of MODELOS_IA) {
      const limpo = limparTextoParaIA(m.conteudo);
      expect(limpo).not.toContain('#');
      expect(limpo.length).toBeLessThan(m.conteudo.length / 3);
      expect(limpo).toMatch(/^Tipo: /);
    }
  });

  it('modelo preenchido mantém dados e economiza os comentários', () => {
    const orc = MODELOS_IA.find((m) => m.id === 'orcamento')!.conteudo
      .replace('Título:', 'Título: Alarme academia')
      .replace('Cliente:', 'Cliente: ATLAS')
      .replace('Marca:', 'Marca: Intelbras')
      .replace('Regra de preço: margem 30% sobre o custo', 'Regra de preço: margem 30% sobre o custo\n- AMT 8000 PRO | central | cód. 4543589 | custo 686,34 | qtd 1');
    const limpo = limparTextoParaIA(orc);
    expect(limpo).toContain('Cliente: ATLAS');
    expect(limpo).toContain('- AMT 8000 PRO | central | cód. 4543589 | custo 686,34 | qtd 1');
    expect(limpo).not.toContain('CNPJ:');
    expect(limpo).not.toContain('Não inclusos:');
  });
});

describe('modelos', () => {
  it('cobrem os 4 tipos de documento e têm nomes de arquivo .txt únicos', () => {
    expect(MODELOS_IA.map((m) => m.id)).toEqual(['orcamento', 'proposta', 'servico', 'fornecimento']);
    const arquivos = [...MODELOS_IA.map((m) => m.arquivo), GUIA_IA.arquivo];
    expect(new Set(arquivos).size).toBe(arquivos.length);
    expect(arquivos.every((a) => a.endsWith('.txt'))).toBe(true);
  });
});
