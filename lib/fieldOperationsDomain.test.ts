import { describe, expect, it } from 'vitest';
import { planAssignmentReconcile, applyOperationStatus } from './fieldOperationsDomain';
import { FieldOperation, FieldOperationAssignment } from './types';

const assign = (over: Partial<FieldOperationAssignment>): FieldOperationAssignment => ({
  id: 'a', operationId: 'op1', technicianId: 't', status: 'ATIVO', ...over,
});
const op = (over: Partial<FieldOperation> = {}): FieldOperation => ({
  id: 'op1', name: 'Auditoria SDAI', operationType: 'AUDITORIA', status: 'ATIVA', ...over,
});

describe('planAssignmentReconcile (§3/§8)', () => {
  it('aloca técnicos novos e não mexe nos já ativos', () => {
    const current = [assign({ id: 'a1', technicianId: 'rhuan' })];
    const plan = planAssignmentReconcile(current, ['rhuan', 'ederson']);
    expect(plan.toAssign).toEqual(['ederson']);
    expect(plan.toEnd).toEqual([]);
  });

  it('encerra (não apaga) o técnico removido, preservando o registro', () => {
    const current = [assign({ id: 'a1', technicianId: 'rhuan' }), assign({ id: 'a2', technicianId: 'ederson' })];
    const plan = planAssignmentReconcile(current, ['ederson']);
    expect(plan.toAssign).toEqual([]);
    expect(plan.toEnd.map((a) => a.id)).toEqual(['a1']);
  });

  it('não duplica alocação do mesmo técnico já ativo', () => {
    const current = [assign({ id: 'a1', technicianId: 'rhuan' })];
    expect(planAssignmentReconcile(current, ['rhuan', 'rhuan']).toAssign).toEqual([]);
  });

  it('múltiplos técnicos: adiciona todos os ausentes de uma vez', () => {
    const plan = planAssignmentReconcile([], ['rhuan', 'ederson', 'joao']);
    expect(plan.toAssign).toEqual(['rhuan', 'ederson', 'joao']);
    expect(plan.toEnd).toEqual([]);
  });

  it('ignora alocações já ENCERRADAS ao calcular o que remover', () => {
    const current = [assign({ id: 'a1', technicianId: 'rhuan', status: 'ENCERRADO' })];
    const plan = planAssignmentReconcile(current, ['ederson']);
    expect(plan.toEnd).toEqual([]);          // a1 já encerrado não é reencerrado
    expect(plan.toAssign).toEqual(['ederson']);
  });
});

describe('applyOperationStatus (§7)', () => {
  it('ATIVA → ENCERRADA registra end_date quando ausente', () => {
    const r = applyOperationStatus(op(), 'ENCERRADA', '2026-11-30');
    expect(r.status).toBe('ENCERRADA');
    expect(r.endDate).toBe('2026-11-30');
  });

  it('ao encerrar preserva end_date já existente', () => {
    const r = applyOperationStatus(op({ endDate: '2026-10-01' }), 'ENCERRADA', '2026-11-30');
    expect(r.endDate).toBe('2026-10-01');
  });

  it('ATIVA → PAUSADA não define end_date', () => {
    const r = applyOperationStatus(op(), 'PAUSADA', '2026-11-30');
    expect(r.status).toBe('PAUSADA');
    expect(r.endDate).toBeUndefined();
  });
});
