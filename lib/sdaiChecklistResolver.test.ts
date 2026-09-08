import { describe, expect, it } from 'vitest';
import type { Device } from './types';
import {
  resolveSdaiFieldOptions,
  resolveSdaiItemPatch,
  seedLacoCards,
  deviceShortLabel,
  migrateLegacySdaiAnswers,
  type SdaiCentralContext,
  type FieldLike,
} from './sdaiChecklistResolver';

describe('migrateLegacySdaiAnswers — rascunho v1 → v2 preservando dados (§7)', () => {
  it('alarme plano legado vira alarmes[0] e limpa chaves órfãs', () => {
    const out = migrateLegacySdaiAnswers({ alarme_ativo: 'Sim', alarme_motivo: 'Fumaça', alarme_laco: '1', alarme_endereco: '37', alarme_device_id: 'd2' }) as any;
    expect(Array.isArray(out.alarmes)).toBe(true);
    expect(out.alarmes[0]).toMatchObject({ laco: '1', endereco: '37', device_id: 'd2', causa: 'Fumaça' });
    expect(out.alarme_motivo).toBeUndefined();
    expect(out.alarme_laco).toBeUndefined();
  });
  it('desabilitado legado (qtd/textarea) vira desabilitados[0]', () => {
    const out = migrateLegacySdaiAnswers({ dispositivos_desabilitados: 'Sim', desabilitados_qtd: 3, desabilitados_lista: 'Sirene corredor' }) as any;
    expect(out.desabilitados[0].observacao).toContain('Sirene corredor');
    expect(out.desabilitados_qtd).toBeUndefined();
    expect(out.desabilitados_lista).toBeUndefined();
  });
  it('não sobrescreve cards já estruturados nem mexe quando não há legado', () => {
    const jaEstruturado = { alarmes: [{ laco: '2' }] };
    expect(migrateLegacySdaiAnswers(jaEstruturado)).toBe(jaEstruturado);
    const semLegado = { central_energizada: 'Sim' };
    expect(migrateLegacySdaiAnswers(semLegado)).toBe(semLegado);
  });
});

const C1: Device = { id: 'C1', clienteId: 'A', sistema: 'SDAI', status: 'ativo', grupo: 'Central SDAI', central: 'EST-01' };
const C2: Device = { id: 'C2', clienteId: 'A', sistema: 'SDAI', status: 'ativo', grupo: 'Central SDAI', central: 'EST-02' };
const mk = (id: string, parent: string, laco: string, endereco: string, over: Partial<Device> = {}): Device =>
  ({ id, clienteId: 'A', sistema: 'SDAI', status: 'ativo', parentDeviceId: parent, laco, endereco, ...over } as Device);

// C1 laço 1: endereços 1,2,4 (sem 3). 4 perfis: 2x Sirene, 1 Acionador, 1 Detector.
const devices: Device[] = [
  C1, C2,
  mk('d1', 'C1', '1', '1', { grupo: 'Detector de Fumaça', fabricante: 'Tecnohold', modelo: 'DFE485' }),
  mk('d2', 'C1', '1', '2', { grupo: 'Acionador Manual', technicalIdentifier: 'AM-025', localizacao: 'Loja X - Estoque', fabricante: 'Tecnohold', modelo: 'AME07' }),
  mk('d3', 'C1', '1', '4', { grupo: 'Sirene / Sinalizador', fabricante: 'Tecnohold', modelo: 'SAVE485' }),
  mk('d4', 'C1', '1', '9', { grupo: 'Sirene / Sinalizador', fabricante: 'Tecnohold', modelo: 'SAVE485' }), // mesmo perfil de d3
  mk('bat1', 'C1', '', '', { grupo: 'Fonte / Alimentação', tipoAtivo: 'Bateria', fabricante: 'Moura', modelo: '12V7Ah' }),
  mk('bat2', 'C1', '', '', { grupo: 'Bateria', fabricante: 'Unipower', modelo: '12V7Ah' }),
  // Device legado com typo no tipo, mas grupo canônico correto:
  mk('leg', 'C1', '1', '77', { grupo: 'Sirene / Sinalizador', tipoDispositivo: 'Sireme / Sinalizador', fabricante: 'Tecnohold', modelo: 'SAVE485' }),
  mk('x1', 'C2', '1', '2', { grupo: 'Sirene / Sinalizador' }),
];
const ctx: SdaiCentralContext = { central: C1, devices };
const F = (key: string, extra: Partial<FieldLike> = {}): FieldLike => ({ key, ...extra });

describe('cascata da falha — laço/endereço (§5/§6)', () => {
  it('laço único → auto/readonly; endereços reais sem inventar o 3', () => {
    const laco = resolveSdaiFieldOptions(ctx, 'falhas', F('laco'), {})!;
    expect(laco.options?.map((o) => o.value)).toEqual(['1']);
    expect(laco.autoValue).toBe('1');
    const end = resolveSdaiFieldOptions(ctx, 'falhas', F('endereco'), { laco: '1' })!;
    expect(end.options?.map((o) => o.value)).toEqual(['1', '2', '4', '9', '77']);
    expect(end.options?.map((o) => o.value)).not.toContain('3');
  });
  it('C2 não vê endereços de C1', () => {
    const end = resolveSdaiFieldOptions({ central: C2, devices }, 'falhas', F('endereco'), { laco: '1' })!;
    expect(end.options?.map((o) => o.value)).toEqual(['2']);
  });
});

describe('campo Dispositivo — device exato vs perfis (§8–§13)', () => {
  it('COM endereço único → device readonly (identidade exata), sem dropdown', () => {
    const dev = resolveSdaiFieldOptions(ctx, 'falhas', F('device_id'), { laco: '1', endereco: '2' })!;
    expect(dev.autoValue).toBe('d2');
    expect(dev.readonly).toBe(true);
    expect(dev.writeToKey).toBeUndefined();
  });
  it('SEM endereço → PERFIS distintos (não N devices); grava em dispositivo_perfil, não device_id', () => {
    const prof = resolveSdaiFieldOptions(ctx, 'falhas', F('device_id'), { laco: '1' })!;
    // 4 perfis distintos (Acionador, Detector, Sirene) — Sirene aparece 1x apesar de 3 devices
    expect(prof.writeToKey).toBe('dispositivo_perfil');
    const labels = prof.options!.map((o) => o.label);
    expect(labels).toContain('Acionador Manual — Tecnohold AME07');
    expect(labels).toContain('Detector de Fumaça — Tecnohold DFE485');
    expect(labels.filter((l) => l.startsWith('Sirene / Sinalizador')).length).toBe(1); // deduplicado
    expect(prof.autoValue).toBeUndefined(); // não seta device_id (§13)
  });
  it('label legado com typo é mostrado como CANÔNICO (§12): nunca "Sireme"', () => {
    const prof = resolveSdaiFieldOptions(ctx, 'falhas', F('device_id'), { laco: '1' })!;
    expect(prof.options!.some((o) => o.label.includes('Sireme'))).toBe(false);
  });
});

describe('reset + auto-preenchimento + divergência (§7/§5/§14)', () => {
  it('trocar laço zera endereço/device/código/local/perfil/divergência', () => {
    const patch = resolveSdaiItemPatch(ctx, 'falhas', 'laco', '2', { laco: '1', endereco: '2', device_id: 'd2' });
    expect(patch).toMatchObject({ endereco: '', device_id: '', codigo: '', local: '', dispositivo_perfil: '', divergencia_base: '' });
  });
  it('escolher endereço resolve device e auto-preenche código/local', () => {
    const patch = resolveSdaiItemPatch(ctx, 'falhas', 'endereco', '2', { laco: '1' });
    expect(patch).toMatchObject({ device_id: 'd2', codigo: 'AM-025', local: 'Loja X - Estoque' });
  });
  it('divergência: perfil informado difere do device do endereço (§14)', () => {
    const patch = resolveSdaiItemPatch(ctx, 'falhas', 'endereco', '2', { laco: '1', dispositivo_perfil: 'Sirene / Sinalizador — Tecnohold SAVE485' })!;
    expect(patch.device_id).toBe('d2');
    expect(String(patch.divergencia_base)).toContain('difere');
  });
  it('sem divergência quando perfil == device do endereço', () => {
    const patch = resolveSdaiItemPatch(ctx, 'falhas', 'endereco', '2', { laco: '1', dispositivo_perfil: 'Acionador Manual — Tecnohold AME07' })!;
    expect(patch.divergencia_base).toBe('');
  });
});

describe('controle binário + semântica de cor (§2/§3/§4)', () => {
  it('Sim/Não com abre_pendencia_se[Não]: Sim=normal, Não=alert', () => {
    const r = resolveSdaiFieldOptions(ctx, undefined, F('central_energizada', { tipo: 'select', opcoes: ['Sim', 'Não'], abre_pendencia_se: ['Não'] }), {})!;
    expect(r.control).toBe('binary');
    expect(r.optionSemantics).toEqual({ Sim: 'normal', 'Não': 'alert' });
  });
  it('gate sem abre_pendencia_se (falha_ativa): Sim=alert, Não=normal', () => {
    const r = resolveSdaiFieldOptions(ctx, undefined, F('falha_ativa', { tipo: 'select', opcoes: ['Não', 'Sim'] }), {})!;
    expect(r.optionSemantics).toEqual({ 'Não': 'normal', Sim: 'alert' });
  });
  it('passfail Conforme/Não conforme: Conforme=normal, Não conforme=alert', () => {
    const r = resolveSdaiFieldOptions(ctx, undefined, F('teste_leds', { tipo: 'passfail', opcoes: ['Conforme', 'Não conforme'], abre_pendencia_se: ['Não conforme'] }), {})!;
    expect(r.optionSemantics).toEqual({ Conforme: 'normal', 'Não conforme': 'alert' });
  });
  it('sem metadata e fora do override → neutro (binário sem cor)', () => {
    const r = resolveSdaiFieldOptions(ctx, undefined, F('qualquer_bin', { tipo: 'select', opcoes: ['A', 'B'] }), {})!;
    expect(r.optionSemantics).toEqual({ A: 'neutral', B: 'neutral' });
  });
  it('3+ opções NÃO viram binário', () => {
    expect(resolveSdaiFieldOptions(ctx, undefined, F('backup', { tipo: 'select', opcoes: ['Sim', 'Não', 'N/A'] }), {})).toBeUndefined();
  });
});

describe('causas/motivos sugeridos + alarme/desabilitado com cascata (§3/§4/§5)', () => {
  it('falha: causa_provavel vira control suggest com lista de falha', () => {
    const r = resolveSdaiFieldOptions(ctx, 'falhas', F('causa_provavel', { tipo: 'texto' }), {})!;
    expect(r.control).toBe('suggest');
    expect(r.options?.map((o) => o.value)).toContain('Falha de comunicação');
    expect(r.options?.map((o) => o.value)).toContain('Outro');
  });
  it('alarme: mesma cascata da falha (laço/endereço/device) + causa de alarme', () => {
    expect(resolveSdaiFieldOptions(ctx, 'alarmes', F('laco'), {})!.autoValue).toBe('1');
    expect(resolveSdaiFieldOptions(ctx, 'alarmes', F('endereco'), { laco: '1' })!.options?.map((o) => o.value)).toContain('2');
    expect(resolveSdaiFieldOptions(ctx, 'alarmes', F('device_id'), { laco: '1', endereco: '2' })!.autoValue).toBe('d2');
    const causa = resolveSdaiFieldOptions(ctx, 'alarmes', F('causa', { tipo: 'texto' }), {})!;
    expect(causa.control).toBe('suggest');
    expect(causa.options?.map((o) => o.value)).toContain('Acionamento manual');
  });
  it('desabilitado: cascata + causa de desabilitação', () => {
    expect(resolveSdaiFieldOptions(ctx, 'desabilitados', F('device_id'), { laco: '1', endereco: '2' })!.autoValue).toBe('d2');
    const causa = resolveSdaiFieldOptions(ctx, 'desabilitados', F('causa', { tipo: 'texto' }), {})!;
    expect(causa.options?.map((o) => o.value)).toContain('Manutenção');
  });
});

describe('dispositivo programado — cabeçalho readonly quando veio do plano (§7)', () => {
  it('com device_id → readonly (não vira campo vazio editável)', () => {
    expect(resolveSdaiFieldOptions(ctx, 'dispositivos', F('dispositivo', { tipo: 'texto' }), { device_id: 'd2', dispositivo: 'Acionador Manual — Laço 1 · End. 2' })!.readonly).toBe(true);
  });
  it('sem device_id (fora do plano) → não força readonly', () => {
    expect(resolveSdaiFieldOptions(ctx, 'dispositivos', F('dispositivo', { tipo: 'texto' }), {})).toBeUndefined();
  });
});

describe('baterias + laços de medição (§12/§14/§17)', () => {
  it('baterias: só as da central; sem bateria → emptyState', () => {
    const bat = resolveSdaiFieldOptions(ctx, 'baterias', F('device_id'), {})!;
    expect(bat.options?.map((o) => o.value).sort()).toEqual(['bat1', 'bat2']);
    const semBat = resolveSdaiFieldOptions({ central: C2, devices }, 'baterias', F('device_id'), {})!;
    expect(semBat.options).toBeUndefined();
    expect(semBat.emptyState).toBeTruthy();
  });
  it('laços de medição: semeia por laço real; laço único auto/readonly', () => {
    expect(seedLacoCards(ctx)).toEqual([{ identificacao: '1' }]);
    const laco = resolveSdaiFieldOptions(ctx, 'lacos', F('identificacao'), {})!;
    expect(laco.autoValue).toBe('1');
    expect(laco.readonly).toBe(true);
  });
});

describe('sem central / label canônico', () => {
  it('sem central → laço pede seleção (emptyState)', () => {
    expect(resolveSdaiFieldOptions({ central: undefined, devices }, 'falhas', F('laco'), {})!.emptyState).toBeTruthy();
  });
  it('deviceShortLabel usa grupo canônico + fab/modelo + id', () => {
    expect(deviceShortLabel(devices.find((d) => d.id === 'd2')!)).toBe('Acionador Manual · Tecnohold AME07 · AM-025');
  });
});

describe('reuso da cascata em alarme e desabilitados', () => {
  it.each(['alarmes', 'desabilitados'])('%s resolve o device por laço+endereço', (repeater) => {
    const r = resolveSdaiFieldOptions(ctx, repeater, F('device_id'), { laco: '1', endereco: '2' })!;
    expect(r.autoValue).toBe('d2');
    expect(r.readonly).toBe(true);
  });
  it('endereço fora da Base fica explicitamente não localizado e sem device_id', () => {
    const patch = resolveSdaiItemPatch(ctx, 'desabilitados', 'endereco', '52', { laco: '1' })!;
    expect(patch.device_id).toBe('');
    expect(patch.base_status).toBe('Dispositivo não localizado na Base Técnica');
  });
  it('ocorrência da própria central vincula a central canônica', () => {
    const patch = resolveSdaiItemPatch(ctx, 'alarmes', 'pertence_central', 'Sim', {})!;
    expect(patch.device_id).toBe('C1');
  });
});
