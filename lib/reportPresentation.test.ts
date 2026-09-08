import { describe, expect, it } from 'vitest';
import { missingRepeaterPhotoMessage, numberedRepeaterLabel, summarizeRepeaterCard } from './reportPresentation';
import type { FieldSchema } from './reportSchema';
import { validateFinalize } from './reportSchema';

describe('apresentação genérica de repeaters', () => {
  const alarmes: FieldSchema = { key: 'alarmes', tipo: 'repeater', label: 'Dispositivos em alarme', item_label: 'Dispositivo em alarme' };

  it('gera título humano sem #', () => {
    expect(numberedRepeaterLabel(alarmes, 0)).toBe('Dispositivo em alarme 1');
    expect(numberedRepeaterLabel({ key: 'falhas', tipo: 'repeater', label: 'Falhas' }, 1)).toBe('Falha 2');
  });

  it('gera validação de foto em linguagem humana sem #', () => {
    const message = missingRepeaterPhotoMessage(alarmes, 0, 'Foto');
    expect(message).toBe('Adicione uma foto do Dispositivo em alarme 1 antes de avançar.');
    expect(message).not.toContain('#');
  });

  it('remove # também da validação final do schema', () => {
    const issues = validateFinalize(
      { codigo: 'T', nome: 'Teste', tipo: 'PREVENTIVA', secoes: [{ key: 's', titulo: 'S', campos: [{ ...alarmes, gera_pendencia: true, card_schema: [{ key: 'foto', tipo: 'foto' }] }] }] },
      { alarmes: [{}] },
      () => false,
    );
    expect(issues[0].campo).toBe('Dispositivo em alarme 1');
    expect(JSON.stringify(issues)).not.toContain('#');
  });

  it('resume dados técnicos úteis e não expõe device_id', () => {
    const schema: FieldSchema[] = [
      { key: 'device_id', tipo: 'texto' }, { key: 'dispositivo', tipo: 'texto' },
      { key: 'laco', tipo: 'texto' }, { key: 'endereco', tipo: 'texto' },
      { key: 'local', tipo: 'texto' }, { key: 'resultado', tipo: 'texto' },
    ];
    expect(summarizeRepeaterCard({ device_id: 'uuid-interno', dispositivo: 'Acionador Manual', laco: '1', endereco: '010', local: 'ESTAC T', resultado: 'Aprovado' }, schema))
      .toBe('Acionador Manual · L1 · End. 010 · ESTAC T · Aprovado');
  });
});
