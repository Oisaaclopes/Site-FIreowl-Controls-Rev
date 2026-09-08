import { describe, expect, it } from 'vitest';
import type { Device, MaintenancePeriodPlan, Pendencia } from './types';
import {
  PREVENTIVA_SDAI_CONTRATO_CODIGO,
  SDAI_DEVICE_RESULT_OPCOES,
  buildDeviceVerificationFromResult,
  buildProgrammedDeviceCards,
  extractCentralChecklistRecords,
  findEquivalentOpenPendencia,
  mapDeviceResultToCondicao,
  resolveCentralChecklist,
  resolveCentralLoops,
  resolveLoopAddresses,
  resolveDeviceByLoopAddress,
  resolveCentralBatteries,
  resolveBatteryCatalog,
  isBatteryDevice,
  compareNumericThenText,
  resultOpensPendencia,
  shouldCreatePendencia,
  shouldRequireCentralChecklist,
} from './sdaiMaintenance';
import { ALL_TEMPLATES, PREVENTIVA_SDAI_CONTRATO } from './reportTemplatesData';

/* --------- Template contratual: alarme/desabilitado ESTRUTURADOS (§16) ------ */
describe('PREVENTIVA_SDAI_CONTRATO — alarme/desabilitado repeaters (não legado)', () => {
  const central = PREVENTIVA_SDAI_CONTRATO.secoes.find((s) => s.key === 'central')!;
  const byKey = (k: string) => central.campos.find((c) => c.key === k);
  it('versão bumpada para 2 (publica no banco via 0075)', () => {
    expect((PREVENTIVA_SDAI_CONTRATO.versao ?? 1) >= 2).toBe(true);
  });
  it('ALARME é repeater estruturado, sem campos legados', () => {
    expect(byKey('alarmes')?.tipo).toBe('repeater');
    // legados que NÃO devem mais existir:
    expect(byKey('alarme_motivo')).toBeUndefined();
    expect(byKey('alarme_laco')).toBeUndefined();
    expect(byKey('alarme_endereco')).toBeUndefined();
    expect(byKey('alarme_device_id')).toBeUndefined();
    // card com cascata + causa:
    const keys = (byKey('alarmes')?.card_schema || []).map((c) => c.key);
    expect(keys).toEqual(expect.arrayContaining(['laco', 'endereco', 'device_id', 'causa']));
  });
  it('DESABILITADO é repeater estruturado, sem quantidade/textarea legado', () => {
    expect(byKey('desabilitados')?.tipo).toBe('repeater');
    expect(byKey('desabilitados_qtd')).toBeUndefined();
    expect(byKey('desabilitados_lista')).toBeUndefined();
    const keys = (byKey('desabilitados')?.card_schema || []).map((c) => c.key);
    expect(keys).toEqual(expect.arrayContaining(['laco', 'endereco', 'device_id', 'causa']));
  });
  it('microsseções presentes nos campos (hierarquia visual)', () => {
    const subs = new Set(central.campos.map((c) => c.subsecao).filter(Boolean));
    expect(subs).toEqual(new Set(['Registro da central', 'Estado da central', 'Eventos ativos', 'Testes locais', 'Procedimentos']));
  });
});

/* --------------------------- Resultado → condição --------------------------- */
describe('mapDeviceResultToCondicao (enum canônico 0095)', () => {
  it('mapeia os 7 resultados', () => {
    expect(mapDeviceResultToCondicao('TESTADO_APROVADO')).toBe('NORMAL');
    expect(mapDeviceResultToCondicao('TESTADO_FALHOU')).toBe('INOPERANTE');
    expect(mapDeviceResultToCondicao('DANIFICADO')).toBe('COM_AVARIA');
    expect(mapDeviceResultToCondicao('OBSTRUIDO')).toBe('INADEQUADO');
    expect(mapDeviceResultToCondicao('NAO_LOCALIZADO')).toBe('NAO_LOCALIZADO');
    expect(mapDeviceResultToCondicao('NAO_FOI_POSSIVEL_TESTAR')).toBe('NAO_TESTADO');
    expect(mapDeviceResultToCondicao('REMOVIDO')).toBeNull(); // ciclo de vida, não verificação
  });
  it('resultOpensPendencia', () => {
    expect(resultOpensPendencia('TESTADO_FALHOU')).toBe(true);
    expect(resultOpensPendencia('NAO_LOCALIZADO')).toBe(true);
    expect(resultOpensPendencia('TESTADO_APROVADO')).toBe(false);
    expect(resultOpensPendencia('NAO_FOI_POSSIVEL_TESTAR')).toBe(false);
  });
});

describe('buildDeviceVerificationFromResult (§11 — persiste na execução)', () => {
  it('aprovado → NORMAL, source ATENDIMENTO, vínculo ao atendimento', () => {
    const v = buildDeviceVerificationFromResult({ deviceId: 'd1', result: 'TESTADO_APROVADO', serviceAttendanceId: 'a1', clienteId: 'A' });
    expect(v).toMatchObject({ deviceId: 'd1', condicao: 'NORMAL', source: 'ATENDIMENTO', serviceAttendanceId: 'a1' });
  });
  it('não localizado → reconciliation NAO_LOCALIZADO', () => {
    expect(buildDeviceVerificationFromResult({ deviceId: 'd1', result: 'NAO_LOCALIZADO' })!.reconciliation).toBe('NAO_LOCALIZADO');
  });
  it('removido → null (não gera verificação)', () => {
    expect(buildDeviceVerificationFromResult({ deviceId: 'd1', result: 'REMOVIDO' })).toBeNull();
  });
});

/* --------------------------- Checklist da central por período --------------- */
describe('checklist da central — uma vez por central por período (§3)', () => {
  const records = [
    { reportId: 'r1', centralDeviceId: 'C1', done: true, date: '2026-09-03', tecnicoId: 't1' },
  ];
  it('central com checklist no período → NÃO exige de novo; outra central exige', () => {
    expect(shouldRequireCentralChecklist(records, 'C1', '2026-09-01', '2026-09-30')).toBe(false);
    expect(shouldRequireCentralChecklist(records, 'C2', '2026-09-01', '2026-09-30')).toBe(true); // independente
    const s = resolveCentralChecklist(records, 'C1', '2026-09-01', '2026-09-30');
    expect(s.done).toBe(true);
    expect(s.record?.date).toBe('2026-09-03');
  });
  it('segundo atendimento do mesmo mês não reexige a mesma central', () => {
    // Atendimento de 18/09: a central C1 já tem checklist de 03/09 → não exige.
    expect(shouldRequireCentralChecklist(records, 'C1', '2026-09-01', '2026-09-30')).toBe(false);
  });
  it('refazer força novo checklist', () => {
    expect(shouldRequireCentralChecklist(records, 'C1', '2026-09-01', '2026-09-30', { forceRefazer: true })).toBe(true);
  });
  it('período diferente (outubro) exige novamente', () => {
    expect(shouldRequireCentralChecklist(records, 'C1', '2026-10-01', '2026-10-31')).toBe(true);
  });
  it('registro com refazer=true não conta como concluído', () => {
    const recs = [{ reportId: 'r', centralDeviceId: 'C1', done: true, date: '2026-09-03', refazer: true }];
    expect(resolveCentralChecklist(recs, 'C1', '2026-09-01', '2026-09-30').done).toBe(false);
  });
});

describe('extractCentralChecklistRecords (adapter answers→registro)', () => {
  it('lê central_device_id + checklist_central_concluido de report finalizado', () => {
    const reports = [{ id: 'r1', status: 'finalizado', tecnicoId: 't1', finalizadoEm: '2026-09-03' }, { id: 'r2', status: 'rascunho' }];
    const answers = new Map([
      ['r1', [{ fieldKey: 'central_device_id', valor: 'C1' }, { fieldKey: 'checklist_central_concluido', valor: 'Sim' }]],
      ['r2', [{ fieldKey: 'central_device_id', valor: 'C1' }, { fieldKey: 'checklist_central_concluido', valor: 'Sim' }]],
    ]);
    const recs = extractCentralChecklistRecords(reports, answers);
    expect(recs).toHaveLength(1); // rascunho excluído
    expect(recs[0]).toMatchObject({ centralDeviceId: 'C1', done: true, date: '2026-09-03' });
  });
});

/* --------------------------- Laços dinâmicos --------------------------- */
describe('resolveCentralLoops (N laços da Base, §8)', () => {
  const central: Device = { id: 'C1', clienteId: 'A', sistema: 'SDAI', status: 'ativo', central: 'EST3X-01' };
  it('laços distintos entre dispositivos da central', () => {
    const devices: Device[] = [
      central,
      { id: 'd1', clienteId: 'A', sistema: 'SDAI', status: 'ativo', parentDeviceId: 'C1', laco: 'L1' },
      { id: 'd2', clienteId: 'A', sistema: 'SDAI', status: 'ativo', parentDeviceId: 'C1', laco: 'L2' },
      { id: 'd3', clienteId: 'A', sistema: 'SDAI', status: 'ativo', parentDeviceId: 'C1', laco: 'L1' },
    ];
    expect(resolveCentralLoops(central, devices)).toEqual(['L1', 'L2']);
  });
  it('sem info → [] (lacuna: entrada manual, não inventa)', () => {
    expect(resolveCentralLoops(central, [central])).toEqual([]);
  });
  it('ordena laços NUMERICAMENTE (1,2,10 — não 1,10,2)', () => {
    const devices: Device[] = [
      central,
      { id: 'a', clienteId: 'A', sistema: 'SDAI', status: 'ativo', parentDeviceId: 'C1', laco: '10' },
      { id: 'b', clienteId: 'A', sistema: 'SDAI', status: 'ativo', parentDeviceId: 'C1', laco: '2' },
      { id: 'c', clienteId: 'A', sistema: 'SDAI', status: 'ativo', parentDeviceId: 'C1', laco: '1' },
    ];
    expect(resolveCentralLoops(central, devices)).toEqual(['1', '2', '10']);
  });
});

describe('Base Técnica inteligente — laço/endereço/device (§2/§3/§4/§18)', () => {
  const C1: Device = { id: 'C1', clienteId: 'A', sistema: 'SDAI', status: 'ativo', grupo: 'Central SDAI', central: 'EST3X-01' };
  const C2: Device = { id: 'C2', clienteId: 'A', sistema: 'SDAI', status: 'ativo', grupo: 'Central SDAI', central: 'EST3X-02' };
  const mk = (id: string, parent: string, laco: string, endereco: string, over: Partial<Device> = {}): Device =>
    ({ id, clienteId: 'A', sistema: 'SDAI', status: 'ativo', parentDeviceId: parent, laco, endereco, ...over } as Device);
  const devices: Device[] = [
    C1, C2,
    mk('d1', 'C1', '1', '1', { grupo: 'Detector de Fumaça' }),
    mk('d2', 'C1', '1', '2', { grupo: 'Acionador Manual', tipoAtivo: 'Acionador Manual', technicalIdentifier: 'DF-025', localizacao: 'Loja X - Estoque' }),
    mk('d3', 'C1', '1', '4'),
    mk('d4', 'C1', '1', '7'),
    mk('d5', 'C1', '1', '10'),
    mk('x1', 'C2', '1', '2', { grupo: 'Sirene / Sinalizador' }), // outra central
  ];

  it('endereços reais do laço, ordem numérica, sem inventar o 3', () => {
    expect(resolveLoopAddresses(C1, '1', devices)).toEqual(['1', '2', '4', '7', '10']);
  });
  it('endereço restrito à central+laço (não usa devices de outra central)', () => {
    // C2 só tem o x1 (laço 1, endereço 2)
    expect(resolveLoopAddresses(C2, '1', devices)).toEqual(['2']);
  });
  it('device por (central,laço,endereço) inequívoco → device correto; ambíguo/ausente → undefined', () => {
    expect(resolveDeviceByLoopAddress(C1, '1', '2', devices)?.id).toBe('d2');
    expect(resolveDeviceByLoopAddress(C1, '1', '3', devices)).toBeUndefined(); // não cadastrado
  });
  it('devices de C1 não aparecem em C2', () => {
    const enderecosC2 = resolveLoopAddresses(C2, '1', devices);
    expect(enderecosC2).not.toContain('1'); // endereço 1 é de C1
  });
  it('compareNumericThenText: números antes de texto, numérico entre si', () => {
    expect(['10', '2', '1', 'A'].sort(compareNumericThenText)).toEqual(['1', '2', '10', 'A']);
  });
});

describe('Baterias da central (§10/§11/§16)', () => {
  const central: Device = { id: 'C1', clienteId: 'A', sistema: 'SDAI', status: 'ativo', grupo: 'Central SDAI', central: 'EST3X-01' };
  const bat = (id: string, over: Partial<Device> = {}): Device =>
    ({ id, clienteId: 'A', sistema: 'SDAI', status: 'ativo', parentDeviceId: 'C1', grupo: 'Bateria', ...over } as Device);
  it('classifica bateria por grupo/tipo canônico, nunca campo de detecção', () => {
    expect(isBatteryDevice({ grupo: 'Bateria' })).toBe(true);
    expect(isBatteryDevice({ tipoAtivo: 'Bateria' })).toBe(true);
    expect(isBatteryDevice({ grupo: 'Sirene / Sinalizador' })).toBe(false);
    expect(isBatteryDevice({ grupo: 'Acionador Manual' })).toBe(false);
    expect(isBatteryDevice({ grupo: 'Bateria', status: 'inativo' })).toBe(false);
  });
  it('central com 2 baterias → só as 2 (não dispositivos de campo)', () => {
    const devices: Device[] = [
      central,
      bat('b1'), bat('b2'),
      { id: 'd1', clienteId: 'A', sistema: 'SDAI', status: 'ativo', parentDeviceId: 'C1', grupo: 'Detector de Fumaça' },
      { id: 's1', clienteId: 'A', sistema: 'SDAI', status: 'ativo', parentDeviceId: 'C1', grupo: 'Sirene / Sinalizador' },
    ];
    expect(resolveCentralBatteries(central, devices).map((d) => d.id)).toEqual(['b1', 'b2']);
  });
  it('central sem bateria → [] (UI usa catálogo/manual, sem fallback de campo)', () => {
    const devices: Device[] = [central, { id: 'd1', clienteId: 'A', sistema: 'SDAI', status: 'ativo', parentDeviceId: 'C1', grupo: 'Detector de Fumaça' }];
    expect(resolveCentralBatteries(central, devices)).toEqual([]);
  });
});

describe('resolveBatteryCatalog (§13 — só categoria/tipo Bateria)', () => {
  it('filtra produtos de bateria do catálogo existente, ordenado', () => {
    const items = [
      { id: '1', name: 'Moura 12V 7Ah', category: 'SDAI', subcategory: 'Bateria', brand: 'Moura', model: '12V 7Ah' },
      { id: '2', name: 'Detector de fumaça', category: 'SDAI', subcategory: 'Detector' },
      { id: '3', name: 'Bateria selada 12V 7Ah', category: 'Insumos', brand: 'Unipower', model: '12V 7Ah' },
    ];
    const out = resolveBatteryCatalog(items);
    expect(out.map((i) => i.id).sort()).toEqual(['1', '3']);
  });
});

/* --------------------------- Injeção de devices do plano --------------------------- */
describe('buildProgrammedDeviceCards (§9 — lista vem do plano, não manual)', () => {
  it('só devices planejados, com campos reais', () => {
    const devices: Device[] = [
      { id: 'd1', clienteId: 'A', sistema: 'SDAI', status: 'ativo', tipoAtivo: 'Detector', fabricante: 'X', modelo: 'Y', central: 'EST3X-01', laco: 'L1', endereco: '046', localizacao: 'Frente Loja' },
      { id: 'd2', clienteId: 'A', sistema: 'SDAI', status: 'ativo', tipoAtivo: 'Sirene' },
    ];
    const plan = {
      contractId: 'C', periodStart: '2026-09-01', periodEnd: '2026-09-30', routines: [], conflicts: [],
      programadosDeviceIds: ['d1'],
      devices: [{ deviceId: 'd1', sistema: 'SDAI', technicalStatus: 'VENCIDO', planningStatus: 'PROGRAMADO_PERIODO', reason: 'PERIODICIDADE_VENCE_NO_PERIODO', nextTestAt: '2026-09-15', lastTestAt: '2025-09-15' }],
    } as unknown as MaintenancePeriodPlan;
    const cards = buildProgrammedDeviceCards(plan, devices);
    expect(cards).toHaveLength(1); // só d1 (planejado)
    expect(cards[0]).toMatchObject({ deviceId: 'd1', tipo: 'Detector', central: 'EST3X-01', laco: 'L1', endereco: '046', descricao: 'Frente Loja', nextTestAt: '2026-09-15', reason: 'PERIODICIDADE_VENCE_NO_PERIODO' });
  });
});

/* --------------------------- Pendências: dedupe --------------------------- */
describe('findEquivalentOpenPendencia / shouldCreatePendencia (§13)', () => {
  const abertas: Pendencia[] = [
    { id: 'p1', clienteId: 'A', deviceId: 'd1', grupo: 'SDAI > Central', status: 'aberta' },
    { id: 'p2', clienteId: 'A', deviceId: 'd9', grupo: 'SDAI > Laço', status: 'corrigida' }, // fechada
  ];
  it('acha equivalente aberta por cliente+device+grupo → não cria duplicada', () => {
    expect(findEquivalentOpenPendencia(abertas, { clienteId: 'A', deviceId: 'd1', grupo: 'SDAI > Central' })?.id).toBe('p1');
    expect(shouldCreatePendencia(abertas, { clienteId: 'A', deviceId: 'd1', grupo: 'SDAI > Central' })).toBe(false);
  });
  it('device diferente → cria', () => {
    expect(shouldCreatePendencia(abertas, { clienteId: 'A', deviceId: 'd2', grupo: 'SDAI > Central' })).toBe(true);
  });
  it('pendência fechada não bloqueia nova', () => {
    expect(shouldCreatePendencia(abertas, { clienteId: 'A', deviceId: 'd9', grupo: 'SDAI > Laço' })).toBe(true);
  });
  it('contexto insuficiente (sem device e sem grupo) → não deduplica', () => {
    expect(findEquivalentOpenPendencia(abertas, { clienteId: 'A' })).toBeUndefined();
  });
});

/* --------------------------- Estrutura do template --------------------------- */
describe('template PREVENTIVA_SDAI_CONTRATO (§2/§5) — estrutura válida', () => {
  const t = PREVENTIVA_SDAI_CONTRATO;
  const sec = (k: string) => t.secoes.find((s) => s.key === k)!;
  const field = (secKey: string, fKey: string) => sec(secKey).campos.find((f) => f.key === fKey)!;

  it('registrado e válido', () => {
    expect(t.codigo).toBe(PREVENTIVA_SDAI_CONTRATO_CODIGO);
    expect(t.tipo).toBe('PREVENTIVA');
    expect(Array.isArray(t.secoes)).toBe(true);
    expect(ALL_TEMPLATES.some((x) => x.codigo === PREVENTIVA_SDAI_CONTRATO_CODIGO)).toBe(true);
  });
  it('central: device da Base, foto geral obrigatória, energizada abre pendência', () => {
    expect(field('central', 'central_device_id').origem).toBe('devices');
    expect(field('central', 'foto_geral').obrigatorio).toBe(true);
    expect(field('central', 'central_energizada').abre_pendencia_se).toEqual(['Não']);
  });
  it('falhas: repeater condicional que gera pendência', () => {
    const falhas = field('central', 'falhas');
    expect(falhas.tipo).toBe('repeater');
    expect(falhas.gera_pendencia).toBe(true);
    expect(falhas.show_if).toBeTruthy();
  });
  it('laços: repeater dinâmico (N)', () => {
    expect(field('lacos', 'lacos').tipo).toBe('repeater');
  });
  it('dispositivos programados: checklist_dispositivos com resultado canônico', () => {
    const disp = field('dispositivos', 'dispositivos');
    expect(disp.tipo).toBe('checklist_dispositivos');
    const resultado = disp.card_schema!.find((f) => f.key === 'resultado')!;
    expect(resultado.opcoes).toEqual(SDAI_DEVICE_RESULT_OPCOES);
    expect(resultado.opcoes).toContain('Testado e reprovou');
  });
  it('equipamentos fora da Base: repeater (não cria device automático)', () => {
    expect(field('fora_base', 'equipamentos_fora_base').tipo).toBe('repeater');
  });
  it('encerramento: resultado do atendimento + assinatura obrigatória', () => {
    expect(field('encerramento', 'resultado_atendimento').opcoes).toContain('PARCIALMENTE_RESOLVIDO');
    expect(field('encerramento', 'assinatura').tipo).toBe('assinatura');
    expect(field('encerramento', 'assinatura').obrigatorio).toBe(true);
  });
});
