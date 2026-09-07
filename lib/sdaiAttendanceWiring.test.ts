import { describe, expect, it } from 'vitest';
import type { Device, MaintenancePeriodPlan } from './types';
import type { SdaiDeviceResult } from './sdaiMaintenance';
import { PREVENTIVA_SDAI_CONTRATO_CODIGO } from './sdaiMaintenance';
import {
  attendanceMayBeContractualSdai,
  attendancePlanDevices,
  buildAttendanceVerification,
  centralDisplayLabel,
  competenciaFromPeriodStart,
  isCentralSdaiDevice,
  periodicidadeLabel,
  resolveSdaiCentrals,
  coverageInProgress,
  finalizationGate,
  parseSdaiChecklistResults,
  resolveAttendanceTemplateCodigo,
  resolveSdaiPreventiveRoutine,
  sdaiPreventiveApplies,
  shouldShowGenericAttendanceFlow,
  stableVerificationId,
} from './sdaiAttendanceWiring';

describe('visibilidade do fluxo genérico no atendimento', () => {
  it.each(['loading', 'ready', 'error'] as const)('oculta o genérico quando o painel SDAI está em %s', (mode) => {
    expect(shouldShowGenericAttendanceFlow(mode)).toBe(false);
  });

  it('mostra o genérico quando o painel confirma na', () => {
    expect(shouldShowGenericAttendanceFlow('na')).toBe(true);
  });

  it('mantém o genérico para OS que nem ativa o painel', () => {
    expect(shouldShowGenericAttendanceFlow('off')).toBe(true);
  });
});

const plan = (ids: string[]): Pick<MaintenancePeriodPlan, 'programadosDeviceIds'> => ({ programadosDeviceIds: ids });

describe('periodicidadeLabel — read-only da identificação', () => {
  it('prioriza intervaloMeses e mapeia para rótulo humano', () => {
    expect(periodicidadeLabel({ intervaloMeses: 1 })).toBe('Mensal');
    expect(periodicidadeLabel({ intervaloMeses: 3 })).toBe('Trimestral');
    expect(periodicidadeLabel({ intervaloMeses: 6 })).toBe('Semestral');
    expect(periodicidadeLabel({ intervaloMeses: 12 })).toBe('Anual');
    expect(periodicidadeLabel({ intervaloMeses: 5 })).toBe('A cada 5 meses');
  });
  it('deriva da frequência quando não há intervaloMeses; casos especiais explícitos', () => {
    expect(periodicidadeLabel({ frequencia: 'mensal' })).toBe('Mensal');
    expect(periodicidadeLabel({ frequencia: 'trimestral' })).toBe('Trimestral');
    expect(periodicidadeLabel({ frequencia: 'sob_demanda' })).toBe('Sob demanda');
    expect(periodicidadeLabel({ frequencia: 'semanal' })).toBe('Semanal');
    expect(periodicidadeLabel(undefined)).toBe('—');
    expect(periodicidadeLabel({})).toBe('—'); // nunca cai em "Mensal" por omissão
  });
});

describe('competenciaFromPeriodStart', () => {
  it('extrai YYYY-MM do início da janela', () => {
    expect(competenciaFromPeriodStart('2026-09-01')).toBe('2026-09');
    expect(competenciaFromPeriodStart('2026-12-31')).toBe('2026-12');
    expect(competenciaFromPeriodStart(undefined)).toBeUndefined();
    expect(competenciaFromPeriodStart('lixo')).toBeUndefined();
  });
});

describe('Central SDAI — taxonomia canônica (etapa 2/11)', () => {
  const dev = (over: Partial<Device>): Device => ({
    id: 'd', clienteId: 'c', sistema: 'SDAI', status: 'ativo', ...over,
  } as Device);

  it('classifica central pelo grupo canônico (e legado), nunca por texto', () => {
    expect(isCentralSdaiDevice(dev({ grupo: 'Central SDAI' }))).toBe(true);
    expect(isCentralSdaiDevice(dev({ grupo: 'Central' }))).toBe(true); // legado normalizado
    expect(isCentralSdaiDevice(dev({ grupo: 'Sirene / Sinalizador' }))).toBe(false);
    expect(isCentralSdaiDevice(dev({ grupo: 'Acionador Manual' }))).toBe(false);
    expect(isCentralSdaiDevice(dev({ grupo: 'Detector de Fumaça' }))).toBe(false);
    expect(isCentralSdaiDevice(dev({ grupo: undefined }))).toBe(false); // sem taxonomia → não é central
    expect(isCentralSdaiDevice(dev({ grupo: 'Central', tipoDispositivo: 'Central Incêndio' } ))).toBe(true);
  });

  it('ignora centrais de outra área e inativas', () => {
    expect(isCentralSdaiDevice(dev({ grupo: 'Central', sistema: 'ALARME' }))).toBe(false);
    expect(isCentralSdaiDevice(dev({ grupo: 'Central SDAI', status: 'inativo' }))).toBe(false);
    expect(isCentralSdaiDevice(dev({ grupo: 'Central SDAI', status: 'removido' }))).toBe(false);
  });

  it('resolveSdaiCentrals filtra só centrais (não os 100 dispositivos de campo)', () => {
    const devices = [
      dev({ id: 'c1', grupo: 'Central SDAI' }),
      dev({ id: 's1', grupo: 'Sirene / Sinalizador' }),
      dev({ id: 'a1', grupo: 'Acionador Manual' }),
      dev({ id: 'df1', grupo: 'Detector de Fumaça' }),
    ];
    expect(resolveSdaiCentrals(devices).map((d) => d.id)).toEqual(['c1']);
  });

  it('centralDisplayLabel usa fabricante+modelo — localização (dados reais)', () => {
    expect(centralDisplayLabel({ fabricante: 'Tecnohold', modelo: 'Avalon', localizacao: 'Administração' }))
      .toBe('Tecnohold Avalon — Administração');
    expect(centralDisplayLabel({ tipoAtivo: 'Central Endereçável' })).toBe('Central Endereçável');
    expect(centralDisplayLabel({ central: '01' })).toBe('Central SDAI — Central 01');
  });
});

describe('resolveAttendanceTemplateCodigo (§3)', () => {
  it('usa o template da rotina; fallback SDAI contratual; undefined se indeterminado', () => {
    expect(resolveAttendanceTemplateCodigo({ templateCodigo: 'X', area: 'SDAI' })).toBe('X');
    expect(resolveAttendanceTemplateCodigo({ area: 'SDAI' })).toBe(PREVENTIVA_SDAI_CONTRATO_CODIGO);
    expect(resolveAttendanceTemplateCodigo({ area: 'CFTV' })).toBeUndefined();
  });
});

describe('idempotência (§10/§16)', () => {
  it('id da verificação é estável por (atendimento × device)', () => {
    expect(stableVerificationId('a1', 'd1')).toBe('av:a1:d1');
    expect(stableVerificationId('a1', 'd1')).toBe(stableVerificationId('a1', 'd1'));
    expect(stableVerificationId('a1', 'd1')).not.toBe(stableVerificationId('a2', 'd1'));
  });
  it('buildAttendanceVerification: aprovado→NORMAL com id estável; repetição = mesma linha', () => {
    const v1 = buildAttendanceVerification({ serviceAttendanceId: 'a1', deviceId: 'd1', result: 'TESTADO_APROVADO', clienteId: 'A' });
    const v2 = buildAttendanceVerification({ serviceAttendanceId: 'a1', deviceId: 'd1', result: 'TESTADO_APROVADO', clienteId: 'A' });
    expect(v1).toMatchObject({ id: 'av:a1:d1', condicao: 'NORMAL', source: 'ATENDIMENTO', serviceAttendanceId: 'a1' });
    expect(v1!.id).toBe(v2!.id); // replay/autosave não duplica (upsert por id)
  });
  it('REMOVIDO → null (não gera verificação falsa)', () => {
    expect(buildAttendanceVerification({ serviceAttendanceId: 'a1', deviceId: 'd1', result: 'REMOVIDO' })).toBeNull();
  });
});

describe('cobertura em andamento (§17)', () => {
  it('planejado x extra; conclusivos contam; derivado dos resultados', () => {
    const results = new Map<string, SdaiDeviceResult>([
      ['d1', 'TESTADO_APROVADO'],
      ['d2', 'TESTADO_FALHOU'],
      ['d3', 'NAO_LOCALIZADO'],   // planejado não testado
      ['dX', 'TESTADO_APROVADO'], // fora do plano → extra
    ]);
    const cov = coverageInProgress(plan(['d1', 'd2', 'd3']), results);
    expect(cov).toEqual({
      planejados: 3, testadosProgramados: 2, naoTestados: 1, testadosExtras: 1, aprovados: 2, falharam: 1,
    });
  });
  it('teste extra NÃO entra em programados', () => {
    const cov = coverageInProgress(plan(['d1']), new Map<string, SdaiDeviceResult>([['dX', 'TESTADO_APROVADO']]));
    expect(cov.planejados).toBe(1);
    expect(cov.testadosProgramados).toBe(0);
    expect(cov.testadosExtras).toBe(1);
  });
});

describe('portão de finalização (§18/§19)', () => {
  const base = { plan: plan(['d1', 'd2', 'd3']), centralRequired: false, centralChecklistDone: true, fotoGeralPresent: true, assinaturaPresent: true };
  const results = new Map<string, SdaiDeviceResult>([
    ['d1', 'TESTADO_APROVADO'], ['d2', 'TESTADO_FALHOU'], ['d3', 'NAO_LOCALIZADO'],
  ]);

  it('79/82 análogo: todos com estado (inclui não testado com motivo) → finaliza', () => {
    const g = finalizationGate({ ...base, resultsByDevice: results });
    expect(g.canFinalize).toBe(true);
    expect(g.issues).toHaveLength(0);
  });
  it('planejado sem NENHUM estado → bloqueia', () => {
    const parcial = new Map(results); parcial.delete('d3');
    const g = finalizationGate({ ...base, resultsByDevice: parcial });
    expect(g.canFinalize).toBe(false);
    expect(g.issues).toContainEqual({ code: 'PLANEJADO_SEM_ESTADO', deviceId: 'd3' });
  });
  it('checklist da central exigido e não concluído → bloqueia', () => {
    const g = finalizationGate({ ...base, resultsByDevice: results, centralRequired: true, centralChecklistDone: false });
    expect(g.canFinalize).toBe(false);
    expect(g.issues).toContainEqual({ code: 'CENTRAL_CHECKLIST_PENDENTE' });
  });
  it('foto geral e assinatura obrigatórias', () => {
    const g = finalizationGate({ ...base, resultsByDevice: results, fotoGeralPresent: false, assinaturaPresent: false });
    expect(g.issues).toContainEqual({ code: 'FOTO_GERAL_OBRIGATORIA' });
    expect(g.issues).toContainEqual({ code: 'ASSINATURA_OBRIGATORIA' });
  });
  it('falhas NÃO bloqueiam (resultado válido de manutenção)', () => {
    const todasFalha = new Map<string, SdaiDeviceResult>([['d1', 'TESTADO_FALHOU'], ['d2', 'TESTADO_FALHOU'], ['d3', 'TESTADO_FALHOU']]);
    expect(finalizationGate({ ...base, resultsByDevice: todasFalha }).canFinalize).toBe(true);
  });
});

describe('attendancePlanDevices (§4 — só planejados, sem duplicar)', () => {
  it('injeta apenas devices do plano', () => {
    const devices: Device[] = [
      { id: 'd1', clienteId: 'A', sistema: 'SDAI', status: 'ativo' },
      { id: 'd2', clienteId: 'A', sistema: 'SDAI', status: 'ativo' },
      { id: 'd3', clienteId: 'A', sistema: 'SDAI', status: 'ativo' },
    ];
    const full = { ...plan(['d1', 'd3']), contractId: 'C', periodStart: '2026-09-01', periodEnd: '2026-09-30', routines: [], devices: [], conflicts: [] } as unknown as MaintenancePeriodPlan;
    expect(attendancePlanDevices(full, devices).map((d) => d.id)).toEqual(['d1', 'd3']);
  });

  it('aceita plano com 0 dispositivos sem transformar a preventiva em erro', () => {
    const empty = { ...plan([]), contractId: 'C', periodStart: '2026-09-01', periodEnd: '2026-09-30', routines: [], devices: [], conflicts: [] } as unknown as MaintenancePeriodPlan;
    expect(attendancePlanDevices(empty, [])).toEqual([]);
  });
});

describe('parseSdaiChecklistResults (cards do form → resultados)', () => {
  it('mapeia rótulo→resultado; ignora sem device/sem resultado; marca divergência/renome', () => {
    const cards = [
      { device_id: 'd1', resultado: 'Testado e aprovado' },
      { device_id: 'd2', resultado: 'Testado e reprovou', observacao: 'sem áudio', endereco_confere: 'Não', renomear: 'Sim' },
      { resultado: 'Testado e aprovado' },           // sem device_id → ignora
      { device_id: 'd3' },                            // sem resultado → ignora
      { device_id: 'd4', resultado: 'rótulo inválido' }, // não reconhecido → ignora
    ];
    const out = parseSdaiChecklistResults(cards);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ deviceId: 'd1', result: 'TESTADO_APROVADO' });
    expect(out[1]).toMatchObject({ deviceId: 'd2', result: 'TESTADO_FALHOU', notes: 'sem áudio', divergencia: true, renomear: true });
  });
});

describe('gate do CTA preventivo SDAI (§2 hardening)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rt = (p: any) => ({ area: 'SDAI', tipo: 'preventiva', ativo: true, ...p });

  it('rotina preventiva SDAI com PREVENTIVA_SDAI_CONTRATO → aplica', () => {
    const routines = [rt({ templateCodigo: 'PREVENTIVA_SDAI_CONTRATO' })];
    expect(sdaiPreventiveApplies({ isSdai: true, osTipo: 'preventiva', contratoId: 'C', clienteId: 'A', routines })).toBe(true);
  });
  it('rotina preventiva SDAI sem templateCodigo (fallback de área) → aplica', () => {
    const routines = [rt({})];
    expect(sdaiPreventiveApplies({ isSdai: true, osTipo: 'preventiva', contratoId: 'C', clienteId: 'A', routines })).toBe(true);
  });
  it('OS corretiva → NÃO aplica (mesmo com contrato SDAI)', () => {
    const routines = [rt({})];
    expect(sdaiPreventiveApplies({ isSdai: true, osTipo: 'corretiva', contratoId: 'C', clienteId: 'A', routines })).toBe(false);
  });
  it('SDAI sem rotina preventiva → NÃO aplica', () => {
    expect(sdaiPreventiveApplies({ isSdai: true, osTipo: 'preventiva', contratoId: 'C', clienteId: 'A', routines: [] })).toBe(false);
  });
  it('só rotina corretiva SDAI → NÃO aplica', () => {
    const routines = [rt({ tipo: 'corretiva' })];
    expect(resolveSdaiPreventiveRoutine(routines)).toBeUndefined();
    expect(sdaiPreventiveApplies({ isSdai: true, osTipo: 'preventiva', contratoId: 'C', clienteId: 'A', routines })).toBe(false);
  });
  it('rotina com template legado PREVENTIVA_SDAI → NÃO casa (não é contratual)', () => {
    const routines = [rt({ templateCodigo: 'PREVENTIVA_SDAI' })];
    expect(sdaiPreventiveApplies({ isSdai: true, osTipo: 'preventiva', contratoId: 'C', clienteId: 'A', routines })).toBe(false);
  });
  it('não-SDAI ou sem contrato/cliente → NÃO aplica', () => {
    const routines = [rt({ templateCodigo: 'PREVENTIVA_SDAI_CONTRATO' })];
    expect(sdaiPreventiveApplies({ isSdai: false, contratoId: 'C', clienteId: 'A', routines })).toBe(false);
    expect(sdaiPreventiveApplies({ isSdai: true, contratoId: null, clienteId: 'A', routines })).toBe(false);
    expect(sdaiPreventiveApplies({ isSdai: true, contratoId: 'C', clienteId: null, routines })).toBe(false);
  });
});

describe('attendanceMayBeContractualSdai — habilita painel em OS de contrato (§3/§4)', () => {
  it('OS contratual preventiva → habilita (missão do pedido é vazia em OS de contrato)', () => {
    expect(attendanceMayBeContractualSdai({ contratoId: 'C', osTipo: 'preventiva' })).toBe(true);
    expect(attendanceMayBeContractualSdai({ contratoId: 'C' })).toBe(true); // tipo ausente ainda tenta
  });
  it('sem contrato → não habilita (não é atendimento contratual)', () => {
    expect(attendanceMayBeContractualSdai({ contratoId: null, osTipo: 'preventiva' })).toBe(false);
    expect(attendanceMayBeContractualSdai({ osTipo: 'preventiva' })).toBe(false);
  });
  it('OS corretiva/instalação contratual → não habilita (evita flash em não-preventiva)', () => {
    expect(attendanceMayBeContractualSdai({ contratoId: 'C', osTipo: 'corretiva' })).toBe(false);
    expect(attendanceMayBeContractualSdai({ contratoId: 'C', osTipo: 'instalacao' })).toBe(false);
  });
});

describe('gate robusto — causa raiz do QA (área texto livre)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rt = (p: any) => ({ area: 'SDAI', tipo: 'preventiva', ativo: true, ...p });
  it('área com espaço/caixa ainda resolve (normalização)', () => {
    expect(resolveAttendanceTemplateCodigo({ area: 'SDAI ' })).toBe(PREVENTIVA_SDAI_CONTRATO_CODIGO);
    expect(resolveAttendanceTemplateCodigo({ area: ' sdai' })).toBe(PREVENTIVA_SDAI_CONTRATO_CODIGO);
    expect(!!resolveSdaiPreventiveRoutine([rt({ area: 'SDAI ' })])).toBe(true);
    expect(!!resolveSdaiPreventiveRoutine([rt({ area: 'sdai' })])).toBe(true);
  });
  it('template_codigo persistido casa mesmo com área vazia', () => {
    expect(!!resolveSdaiPreventiveRoutine([rt({ area: '', templateCodigo: 'PREVENTIVA_SDAI_CONTRATO' })])).toBe(true);
  });
  it('preventiva SDAI com execução ausente ainda aplica (mostra Iniciar)', () => {
    expect(sdaiPreventiveApplies({ isSdai: true, osTipo: 'preventiva', contratoId: 'C', clienteId: 'A', routines: [rt({ area: 'SDAI ' })] })).toBe(true);
  });
});
