import { describe, expect, it } from 'vitest';
import { buildDeriveContext } from './fieldStateContext';
import { FieldOperation, FieldOperationAssignment, OrdemServico, ServiceAttendance } from './types';

const op = (over: Partial<FieldOperation> = {}): FieldOperation => ({
  id: 'op1', clientId: 'c1', name: 'Auditoria SDAI', operationType: 'AUDITORIA', status: 'ATIVA', ...over,
});
const assign = (over: Partial<FieldOperationAssignment> = {}): FieldOperationAssignment => ({
  id: 'a1', operationId: 'op1', technicianId: 'u1', status: 'ATIVO', ...over,
});
const att = (over: Partial<ServiceAttendance> = {}): ServiceAttendance => ({
  id: 'att1', workOrderId: 'os1', technicianId: 'u2', status: 'EM_EXECUCAO', startedAt: '2026-09-03T12:42:00.000Z', ...over,
});
const os: OrdemServico = { id: 'os1', numero: 'OS-2026-154', clienteId: 'c9', tipo: 'corretiva', status: 'em_execucao', prioridade: 'media', pendenciaIds: [] };

describe('buildDeriveContext', () => {
  it('cruza operação ATIVA × alocação ATIVO em vínculo por técnico', () => {
    const ctx = buildDeriveContext({ operations: [op()], assignments: [assign()], attendances: [] }, []);
    expect(ctx.operations).toEqual([
      { technicianId: 'u1', operationId: 'op1', operationName: 'Auditoria SDAI', operationType: 'AUDITORIA', clientId: 'c1' },
    ]);
  });

  it('ignora operação não-ATIVA e alocação encerrada', () => {
    const ctx = buildDeriveContext(
      { operations: [op({ status: 'PAUSADA' })], assignments: [assign(), assign({ id: 'a2', technicianId: 'u3', status: 'ENCERRADO' })], attendances: [] },
      []
    );
    expect(ctx.operations).toEqual([]);
  });

  it('resolve OS (numero/cliente) e converte startedAt em ms para o atendimento', () => {
    const ctx = buildDeriveContext({ operations: [], assignments: [], attendances: [att()] }, [os]);
    expect(ctx.attendances).toEqual([
      { technicianId: 'u2', attendanceId: 'att1', workOrderId: 'os1', osNumero: 'OS-2026-154', clientId: 'c9', startedAt: new Date('2026-09-03T12:42:00.000Z').getTime() },
    ]);
  });

  it('ignora atendimento finalizado ou sem técnico', () => {
    const ctx = buildDeriveContext(
      { operations: [], assignments: [], attendances: [att({ status: 'FINALIZADO' }), att({ id: 'att2', technicianId: undefined })] },
      [os]
    );
    expect(ctx.attendances).toEqual([]);
  });
});
