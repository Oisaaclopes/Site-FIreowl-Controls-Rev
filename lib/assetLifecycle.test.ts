import { describe, expect, it } from 'vitest';
import { planLifecycle, suggestDecision, buildReplacementDevice, alreadyApplied, LifecycleInput } from './assetLifecycle';
import { Device, ServiceAttendanceEvidenceItem } from './types';

const oldDev = (over: Partial<Device> = {}): Device => ({
  id: 'dev-old', clienteId: 'c1', sistema: 'SDAI', status: 'ativo',
  grupo: 'Acionador Manual', tipoAtivo: 'Acionador', fabricante: 'Tecnohold', modelo: 'IP20',
  laco: '2', endereco: '45', localizacao: 'Corredor Padaria', condicao: 'COM_AVARIA',
  technicalAttributes: { descricao_programada: 'L2 AM 45' }, parentDeviceId: 'central-1',
  ...over,
} as Device);

const item = (over: Partial<ServiceAttendanceEvidenceItem> = {}): ServiceAttendanceEvidenceItem => ({
  id: 'item-1', serviceAttendanceId: 'att-1', title: 'AC 45', category: 'EQUIPAMENTO', ...over,
} as ServiceAttendanceEvidenceItem);

const baseInput = (over: Partial<LifecycleInput>): LifecycleInput => ({
  decision: 'MESMO', item: item(), clienteId: 'c1', oldDevice: oldDev(),
  finalCondition: 'NORMAL', serviceAttendanceId: 'att-1', workOrderId: 'os-1',
  timestampISO: '2026-09-05T12:00:00Z', verificationId: 'ver-1', ...over,
});

describe('suggestDecision (§10) — pré-seleção, não automação', () => {
  it('equipamento substituído → SUBSTITUIDO', () => {
    expect(suggestDecision({ equipmentReplaced: true, deviceId: 'x' })).toBe('SUBSTITUIDO');
  });
  it('tem ativo, não substituído → MESMO', () => {
    expect(suggestDecision({ equipmentReplaced: false, deviceId: 'x' })).toBe('MESMO');
  });
  it('sem ativo → NAO_ALTERAR', () => {
    expect(suggestDecision({})).toBe('NAO_ALTERAR');
  });
});

describe('planLifecycle — MESMO EQUIPAMENTO (§3A/§11/§53)', () => {
  it('não cria novo ativo; gera verificação com condição final', () => {
    const p = planLifecycle(baseInput({ decision: 'MESMO', finalCondition: 'NORMAL' }));
    expect(p.newDevice).toBeUndefined();
    expect(p.oldDevicePatch).toBeUndefined();
    expect(p.verifications).toHaveLength(1);
    expect(p.verifications[0].deviceId).toBe('dev-old');
    expect(p.verifications[0].condicao).toBe('NORMAL');
    expect(p.verifications[0].source).toBe('ATENDIMENTO');
    expect(p.verifications[0].serviceAttendanceId).toBe('att-1');
    expect(p.itemPatch.baseUpdateDecision).toBe('MESMO');
    expect(p.itemPatch.baseUpdateAppliedAt).toBeTruthy();
  });
});

describe('planLifecycle — SUBSTITUIÇÃO (§3B/§12/§13/§54)', () => {
  const p = planLifecycle(baseInput({
    decision: 'SUBSTITUIDO',
    replacement: { newDeviceId: 'dev-new', clienteId: 'c1', finalCondition: 'NORMAL', manufacturer: 'Tecnohold', model: 'IP67', laco: '2', endereco: '45', localizacao: 'Corredor Padaria' },
  }));
  it('antigo é desativado (substituido) com replaced_by e removed_at', () => {
    expect(p.oldDevicePatch).toEqual(expect.objectContaining({ id: 'dev-old', status: 'substituido', replacedByDeviceId: 'dev-new' }));
    expect(p.oldDevicePatch!.removedAt).toBeTruthy();
  });
  it('novo ativo criado, ativo, condição NORMAL, source ATENDIMENTO', () => {
    expect(p.newDevice!.id).toBe('dev-new');
    expect(p.newDevice!.status).toBe('ativo');
    expect(p.newDevice!.modelo).toBe('IP67');
    expect(p.newDevice!.condicao).toBe('NORMAL');
    expect(p.newDevice!.source).toBe('ATENDIMENTO');
  });
  it('herda pai/local/sistema; NÃO herda serial nem descrição do antigo (§15)', () => {
    expect(p.newDevice!.parentDeviceId).toBe('central-1');
    expect(p.newDevice!.sistema).toBe('SDAI');
    expect(p.newDevice!.serial).toBeUndefined();
    expect(p.newDevice!.technicalAttributes?.descricao_programada).toBeUndefined();
  });
  it('item aponta para o novo ativo (navegação/auditoria)', () => {
    expect(p.itemPatch.replacementDeviceId).toBe('dev-new');
    expect(p.itemPatch.baseUpdateDecision).toBe('SUBSTITUIDO');
    expect(p.photoRelinkDeviceId).toBe('dev-new');
  });
  it('substituição sem dados do novo ativo é erro', () => {
    expect(() => planLifecycle(baseInput({ decision: 'SUBSTITUIDO' }))).toThrow();
  });
});

describe('planLifecycle — identificador alterado na substituição (§56)', () => {
  it('CFTV: novo IP diferente do antigo', () => {
    const p = planLifecycle(baseInput({
      oldDevice: oldDev({ sistema: 'CFTV', technicalAttributes: { ip: '192.168.1.31' }, laco: undefined, endereco: undefined }),
      decision: 'SUBSTITUIDO',
      replacement: { newDeviceId: 'dev-new', clienteId: 'c1', finalCondition: 'NORMAL', technicalAttributes: { ip: '192.168.1.52' } },
    }));
    expect(p.newDevice!.technicalAttributes?.ip).toBe('192.168.1.52');
  });
});

describe('planLifecycle — REMOVIDO (§18/§57) e NAO_ALTERAR (§19/§58)', () => {
  it('removido: ativo marcado removido + histórico, sem novo ativo', () => {
    const p = planLifecycle(baseInput({ decision: 'REMOVIDO', finalCondition: 'NAO_LOCALIZADO' }));
    expect(p.oldDevicePatch).toEqual(expect.objectContaining({ id: 'dev-old', status: 'removido' }));
    expect(p.newDevice).toBeUndefined();
    expect(p.verifications).toHaveLength(1);
  });
  it('não alterar: nenhum device tocado, nenhuma verificação', () => {
    const p = planLifecycle(baseInput({ decision: 'NAO_ALTERAR' }));
    expect(p.oldDevicePatch).toBeUndefined();
    expect(p.newDevice).toBeUndefined();
    expect(p.verifications).toHaveLength(0);
    expect(p.itemPatch.baseUpdateDecision).toBe('NAO_ALTERAR');
  });
});

describe('idempotência (§23/§59)', () => {
  it('mesmo input → mesmo plano (ids determinísticos fornecidos)', () => {
    const a = planLifecycle(baseInput({ decision: 'SUBSTITUIDO', replacement: { newDeviceId: 'dev-new', clienteId: 'c1', finalCondition: 'NORMAL' } }));
    const b = planLifecycle(baseInput({ decision: 'SUBSTITUIDO', replacement: { newDeviceId: 'dev-new', clienteId: 'c1', finalCondition: 'NORMAL' } }));
    expect(a.newDevice!.id).toBe(b.newDevice!.id);
    expect(a.verifications[0].id).toBe(b.verifications[0].id);
  });
  it('alreadyApplied bloqueia reprocessamento', () => {
    expect(alreadyApplied({ baseUpdateAppliedAt: '2026-09-05T12:00:00Z' })).toBe(true);
    expect(alreadyApplied({})).toBe(false);
  });
});

describe('buildReplacementDevice — fabricante diferente sem compatibilidade (§55)', () => {
  it('troca Tecnohold → Intelbras sem inferência', () => {
    const nd = buildReplacementDevice(oldDev(), { newDeviceId: 'n', clienteId: 'c1', finalCondition: 'NORMAL', manufacturer: 'Intelbras', model: 'X' });
    expect(nd.fabricante).toBe('Intelbras');
    expect(nd.modelo).toBe('X');
  });
});
