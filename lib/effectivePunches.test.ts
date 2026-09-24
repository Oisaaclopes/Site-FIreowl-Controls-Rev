import { describe, expect, it } from 'vitest';
import { PunchAdjustment } from './adjustments';
import { effectivePunchLabel, resolveEffectivePunches } from './effectivePunches';
import { buildDailyTimeRecords } from './timecard';
import { TimePunch } from './types';

const at = (h: number, m: number) => new Date(2026, 8, 1, h, m, 0).getTime();
const punch = (type: TimePunch['type'], time: number, id = type): TimePunch => ({
  id, userId: 'user-1', employeeName: 'Rhuan M. Romeiro', timestamp: '', type,
  locationStr: '', lat: 0, lng: 0, status: 'APROVADO', at: time,
});
const adjustment = (status: PunchAdjustment['status'], overrides: Partial<PunchAdjustment> = {}): PunchAdjustment => ({
  id: 'adj-1', userId: 'user-1', employeeName: 'Rhuan M. Romeiro', refDate: '2026-09-01',
  type: 'ENTRADA', requestedTime: '08:00', reason: 'Sem acesso ao site', status,
  createdAt: '2026-09-01T15:40:00Z', reviewedAt: '2026-09-01T16:00:00Z', reviewerName: 'Gestor',
  ...overrides,
});

describe('resolveEffectivePunches', () => {
  it('mantém a batida original quando não há ajuste', () => {
    const [result] = resolveEffectivePunches([punch('ENTRADA', at(12, 32))], []);
    expect(result.at).toBe(at(12, 32));
    expect(result.effectiveSource).toBe('original');
  });

  it.each(['PENDENTE', 'REJEITADO'] as const)('mantém a original para ajuste %s', (status) => {
    const [result] = resolveEffectivePunches([punch('ENTRADA', at(12, 32))], [adjustment(status)]);
    expect(result.at).toBe(at(12, 32));
    expect(result.effectiveSource).toBe('original');
  });

  it('aplica aprovado, preserva original e metadados de auditoria', () => {
    const [result] = resolveEffectivePunches([punch('ENTRADA', at(12, 32))], [adjustment('APROVADO')]);
    expect(result.at).toBe(at(8, 0));
    expect(result.originalAt).toBe(at(12, 32));
    expect(result.effectiveSource).toBe('adjusted');
    expect(result.adjustmentReason).toBe('Sem acesso ao site');
    expect(result.adjustmentApprovedBy).toBe('Gestor');
    expect(effectivePunchLabel(result)).toBe('Registro ajustado');
  });

  it('não duplica a batida ajustada', () => {
    const result = resolveEffectivePunches([punch('ENTRADA', at(12, 32))], [adjustment('APROVADO')]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ENTRADA');
  });

  it('entrega ao espelho/PDF a jornada recalculada com a batida efetiva', () => {
    const originals = [
      punch('ENTRADA', at(12, 32)), punch('PAUSA', at(12, 33)),
      punch('RETORNO', at(13, 35)), punch('SAIDA', at(18, 0)),
    ];
    const records = buildDailyTimeRecords(resolveEffectivePunches(originals, [adjustment('APROVADO')]));
    expect(records[0].entrada).toBe(at(8, 0));
    expect(records[0].workedMs).toBe((4 * 60 + 33 + 4 * 60 + 25) * 60_000);
    expect(records[0].punches.filter((p) => p.type === 'ENTRADA')).toHaveLength(1);
  });

  it.each(['PAUSA', 'RETORNO', 'SAIDA'] as const)('aplica ajuste ao tipo %s', (type) => {
    const original = punch(type, at(12, 32), `p-${type}`);
    const [result] = resolveEffectivePunches([original], [adjustment('APROVADO', { type, originalPunchId: original.id })]);
    expect(result.type).toBe(type);
    expect(result.at).toBe(at(8, 0));
  });

  it('representa batida ausente aprovada sem criar time_punch normal', () => {
    const [result] = resolveEffectivePunches([], [adjustment('APROVADO', { type: 'SAIDA', requestedTime: '18:00' })]);
    expect(result.id).toBe('adjustment:adj-1');
    expect(result.effectiveSource).toBe('adjusted');
  });

  it('não escolhe silenciosamente entre dois ajustes aprovados legados', () => {
    const original = punch('ENTRADA', at(12, 32));
    const result = resolveEffectivePunches([original], [
      adjustment('APROVADO'), adjustment('APROVADO', { id: 'adj-2', requestedTime: '09:00' }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].at).toBe(at(12, 32));
    expect(result[0].effectiveSource).toBe('original');
  });

  it('usa vínculo explícito sem depender do nome do funcionário', () => {
    const original = punch('ENTRADA', at(12, 32), 'punch-id');
    const [result] = resolveEffectivePunches([original], [
      adjustment('APROVADO', { originalPunchId: 'punch-id', employeeName: 'Nome histórico' }),
    ]);
    expect(result.at).toBe(at(8, 0));
  });
});

// Caso real corrigido pela migration 0081: ENTRADA do Rhuan em 01/09/2026,
// batida original 12:32:39, ajuste aprovado para 08:01 vinculado à original.
describe('caso Rhuan — ajuste vinculado 08:01', () => {
  const originalAt = new Date(2026, 8, 1, 12, 32, 39).getTime();
  const original: TimePunch = { ...punch('ENTRADA', originalAt, 'punch-rhuan') };
  const linked = adjustment('APROVADO', {
    requestedTime: '08:01', originalPunchId: 'punch-rhuan', reason: 'Tava sem acesso ao site',
  });

  it('1. retorna 08:01 pela vinculação por original_punch_id', () => {
    const [r] = resolveEffectivePunches([original], [linked]);
    expect(r.at).toBe(at(8, 1));
    expect(r.effectiveSource).toBe('adjusted');
  });

  it('2. preserva a evidência original 12:32:39 em originalAt', () => {
    const [r] = resolveEffectivePunches([original], [linked]);
    expect(r.originalAt).toBe(originalAt);
    expect(new Date(r.originalAt!).getSeconds()).toBe(39);
  });

  it('3. retorna somente uma batida efetiva (sem duplicar)', () => {
    const r = resolveEffectivePunches([original], [linked]);
    expect(r).toHaveLength(1);
    expect(r.filter((p) => p.type === 'ENTRADA')).toHaveLength(1);
  });

  it('4/5. jornada diária (Espelho/PDF) usa 08:01, não o total fixo', () => {
    const originals = [original, punch('PAUSA', at(12, 33)), punch('RETORNO', at(13, 35)), punch('SAIDA', at(18, 0))];
    const records = buildDailyTimeRecords(resolveEffectivePunches(originals, [linked]));
    expect(records[0].entrada).toBe(at(8, 1));
    expect(records[0].punches.filter((p) => p.type === 'ENTRADA')).toHaveLength(1);
  });

  it('6. listagem mostra REGISTRO AJUSTADO', () => {
    const [r] = resolveEffectivePunches([original], [linked]);
    expect(effectivePunchLabel(r)).toBe('Registro ajustado');
  });

  it('mantém a original quando o ajuste não informa horário (bloqueio de aprovação)', () => {
    const [r] = resolveEffectivePunches([original], [adjustment('APROVADO', { requestedTime: '', originalPunchId: 'punch-rhuan' })]);
    expect(r.at).toBe(originalAt);
    expect(r.effectiveSource).toBe('original');
  });
});

describe('ações administrativas (0113)', () => {
  const base = (over: Partial<PunchAdjustment>): PunchAdjustment => adjustment('APROVADO', { origin: 'ADMINISTRATIVO', ...over });

  it('DESCONSIDERAR retira a batida do cálculo sem tocar nas demais', () => {
    const keep = punch('ENTRADA', at(8, 0), 'keep');
    const wrong = punch('SAIDA', at(9, 0), 'wrong');
    const result = resolveEffectivePunches([keep, wrong], [
      base({ id: 'd1', type: 'SAIDA', action: 'DESCONSIDERAR', requestedTime: '', originalPunchId: 'wrong' }),
    ]);
    expect(result.map((p) => p.id)).toEqual(['keep']);
  });

  it('DESCONSIDERAR pendente, rejeitado ou substituído não tem efeito', () => {
    for (const status of ['PENDENTE', 'REJEITADO', 'SUBSTITUIDO'] as const) {
      const result = resolveEffectivePunches([punch('SAIDA', at(9, 0), 'x')], [
        adjustment(status, { action: 'DESCONSIDERAR', type: 'SAIDA', requestedTime: '', originalPunchId: 'x' }),
      ]);
      expect(result).toHaveLength(1);
    }
  });

  it('INCLUSAO é sempre efetiva, mesmo havendo batida do mesmo tipo no dia', () => {
    const result = resolveEffectivePunches([punch('PAUSA', at(12, 0), 'p1')], [
      base({ id: 'i1', type: 'PAUSA', requestedTime: '15:00', action: 'INCLUSAO' }),
    ]);
    expect(result).toHaveLength(2);
    const inc = result.find((p) => p.id === 'adjustment:i1')!;
    expect(inc.at).toBe(at(15, 0));
    expect(inc.adjustmentAction).toBe('INCLUSAO');
    expect(inc.adjustmentOrigin).toBe('ADMINISTRATIVO');
    expect(result.find((p) => p.id === 'p1')!.effectiveSource).toBe('original');
  });

  it('correção substituída: só a vigente (APROVADO) vale; a SUBSTITUIDO é ignorada', () => {
    const [result] = resolveEffectivePunches([punch('SAIDA', at(17, 40), 's')], [
      base({ id: 'old', type: 'SAIDA', requestedTime: '17:10', originalPunchId: 's', status: 'SUBSTITUIDO' }),
      base({ id: 'new', type: 'SAIDA', requestedTime: '17:00', originalPunchId: 's' }),
    ]);
    expect(result.at).toBe(at(17, 0));
    expect(result.originalAt).toBe(at(17, 40));
    expect(result.adjustmentId).toBe('new');
  });

  it('linhas anteriores à 0113 (sem action/origin) seguem o comportamento legado', () => {
    const [result] = resolveEffectivePunches([punch('ENTRADA', at(12, 32))], [adjustment('APROVADO')]);
    expect(result.at).toBe(at(8, 0));
    expect(result.adjustmentAction).toBe('AJUSTE');
    expect(result.adjustmentOrigin).toBe('SOLICITACAO');
  });
});
