import { describe, expect, it } from 'vitest';
import { LEVANTAMENTO_SDAI } from './reportTemplatesData';
import { buildSurveyTemplate, surveyBlockSections } from './surveyMode';

describe('modos de levantamento', () => {
  it('mantém o levantamento completo inalterado', () => {
    expect(buildSurveyTemplate(LEVANTAMENTO_SDAI, 'completo')).toBe(LEVANTAMENTO_SDAI);
  });

  it('limita o parcial aos blocos escolhidos e blocos de fechamento', () => {
    const result = buildSurveyTemplate(LEVANTAMENTO_SDAI, 'parcial', ['infraestrutura']);
    expect(result.secoes.map((section) => section.key)).toEqual([
      'infraestrutura', 'apontamentos', 'necessidades', 'encerramento',
    ]);
    expect(result.secoes.flatMap((section) => section.campos).every((field) => !field.obrigatorio)).toBe(true);
  });

  it('faz o pontual foto-first sem inventário quantitativo obrigatório', () => {
    const result = buildSurveyTemplate(LEVANTAMENTO_SDAI, 'pontual');
    expect(result.secoes[0].key).toBe('registro_pontual');
    expect(result.secoes.some((section) => section.key === 'quantitativo')).toBe(false);
    expect(result.secoes[0].campos.find((field) => field.key === 'constatacoes_pontuais')?.tipo).toBe('multiselect');
    expect(result.secoes[0].campos.find((field) => field.key === 'verificacao_pontual')?.opcoes).toContain('Não verificado');
  });

  it('expõe somente blocos técnicos como selecionáveis', () => {
    expect(surveyBlockSections(LEVANTAMENTO_SDAI).map((section) => section.key)).not.toContain('encerramento');
  });
});
