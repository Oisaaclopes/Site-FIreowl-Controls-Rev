import { describe, expect, it } from 'vitest';
import { PREVENTIVA_SDAI_CONTRATO } from './reportTemplatesData';

const fields = PREVENTIVA_SDAI_CONTRATO.secoes.flatMap((section) => section.campos);
const central = PREVENTIVA_SDAI_CONTRATO.secoes.find((section) => section.key === 'central')!;

describe('metadata visual da Preventiva SDAI v3', () => {
  it.each([
    ['alarme_ativo', { 'Não': 'normal', Sim: 'alert' }],
    ['falha_ativa', { 'Não': 'normal', Sim: 'alert' }],
    ['dispositivos_desabilitados', { 'Não': 'normal', Sim: 'alert' }],
    ['checklist_central_concluido', { Sim: 'normal', 'Não': 'alert' }],
  ])('%s declara semântica no schema', (key, expected) => {
    expect(fields.find((field) => field.key === key)?.semantica_opcoes).toEqual(expected);
  });

  it('endereço e descrição conferem usam Sim normal / Não alerta', () => {
    const devices = fields.find((field) => field.key === 'dispositivos')!;
    for (const key of ['endereco_confere', 'descricao_confere']) {
      expect(devices.card_schema?.find((field) => field.key === key)?.semantica_opcoes).toEqual({ Sim: 'normal', 'Não': 'alert' });
    }
  });

  it('testes locais usam OK normal / NC alerta', () => {
    for (const key of ['teste_leds', 'teste_buzzer']) {
      expect(fields.find((field) => field.key === key)?.semantica_opcoes).toEqual({ Conforme: 'normal', 'Não conforme': 'alert' });
    }
  });

  it('motivos são selects compactos, com Outro e especificação condicional', () => {
    for (const repeaterKey of ['alarmes', 'falhas', 'desabilitados']) {
      const repeater = central.campos.find((field) => field.key === repeaterKey)!;
      const cause = repeater.card_schema?.find((field) => field.key === (repeaterKey === 'falhas' ? 'causa_provavel' : 'causa'))!;
      expect(cause.controle).toBe('seletor_compacto');
      expect(cause.opcoes).toContain('Outro');
      expect(repeater.card_schema?.some((field) => field.label === 'Especifique')).toBe(true);
    }
  });

  it('inclui o novo motivo de desabilitação', () => {
    const field = central.campos.find((item) => item.key === 'desabilitados')?.card_schema?.find((item) => item.key === 'causa');
    expect(field?.opcoes).toContain('Alarmes falsos recorrentes');
  });
});
