import { describe, expect, it } from 'vitest';
import type { ServiceAttendance } from './types';
import { contractDeletionDecision } from './contracts';
import { pickReusableAttendance, resolveResponsibleTechnician } from './contractMaintenance';

describe('contractDeletionDecision (hard-delete vs encerrar)', () => {
  it('contrato novo sem histórico → pode excluir', () => {
    expect(contractDeletionDecision({ executionsWithHistory: 0, osCount: 0, reportCount: 0, hourLedgerCount: 0 }).canDelete).toBe(true);
  });
  it('execução com histórico bloqueia', () => {
    const d = contractDeletionDecision({ executionsWithHistory: 1, osCount: 0, reportCount: 0, hourLedgerCount: 0 });
    expect(d.canDelete).toBe(false);
    expect(d.reason).toMatch(/histórico/i);
  });
  it('OS/relatório/horas bloqueiam', () => {
    expect(contractDeletionDecision({ executionsWithHistory: 0, osCount: 1, reportCount: 0, hourLedgerCount: 0 }).canDelete).toBe(false);
    expect(contractDeletionDecision({ executionsWithHistory: 0, osCount: 0, reportCount: 1, hourLedgerCount: 0 }).canDelete).toBe(false);
    expect(contractDeletionDecision({ executionsWithHistory: 0, osCount: 0, reportCount: 0, hourLedgerCount: 1 }).canDelete).toBe(false);
  });
});

describe('pickReusableAttendance (idempotência do iniciar atendimento)', () => {
  const att = (id: string, workOrderId: string, status: ServiceAttendance['status']): ServiceAttendance => ({ id, workOrderId, status });
  it('reutiliza o EM_EXECUCAO da mesma OS', () => {
    const list = [att('a1', 'os1', 'FINALIZADO'), att('a2', 'os1', 'EM_EXECUCAO'), att('a3', 'os2', 'EM_EXECUCAO')];
    expect(pickReusableAttendance(list, 'os1')?.id).toBe('a2');
  });
  it('sem EM_EXECUCAO da OS → undefined (cria novo)', () => {
    expect(pickReusableAttendance([att('a1', 'os1', 'FINALIZADO')], 'os1')).toBeUndefined();
    expect(pickReusableAttendance([], 'os1')).toBeUndefined();
  });
});

describe('resolveResponsibleTechnician (§2/§3 — ADMIN não vira técnico)', () => {
  it('TÉCNICO inicia o próprio', () => {
    expect(resolveResponsibleTechnician({ userRole: 'TECNICO', currentUserId: 'u1' })).toBe('u1');
  });
  it('ADMIN/GESTOR usa o técnico SELECIONADO', () => {
    expect(resolveResponsibleTechnician({ userRole: 'ADMINISTRATIVO', currentUserId: 'admin', selectedTechnicianId: 't9' })).toBe('t9');
    expect(resolveResponsibleTechnician({ userRole: 'GESTOR', currentUserId: 'gestor', selectedTechnicianId: 't9' })).toBe('t9');
  });
  it('ADMIN/GESTOR SEM seleção → undefined (nunca o próprio admin)', () => {
    expect(resolveResponsibleTechnician({ userRole: 'ADMINISTRATIVO', currentUserId: 'admin' })).toBeUndefined();
    expect(resolveResponsibleTechnician({ userRole: 'GESTOR', currentUserId: 'gestor' })).toBeUndefined();
  });
});
