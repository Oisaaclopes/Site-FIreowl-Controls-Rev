import { FieldOperation, FieldOperationAssignment, OrdemServico, ServiceAttendance } from './types';
import type { DeriveFieldContext, OperatorAttendanceLink, OperatorOperationLink } from './fieldOperations';
import { fetchFieldOperations, fetchFieldOperationAssignments } from './fieldOperationsDomain';
import { fetchServiceAttendances } from './serviceAttendances';

/* ===================================================================
 * ETAPA 3A — Monta o contexto (operações + atendimentos) que o Dashboard
 * passa à derivação pura `deriveFieldOperatorStates`. A resolução de
 * nomes de cliente/OS acontece na derivação, a partir dos clients/orders
 * que a tela já tem em memória — aqui só cruzamos os vínculos reais.
 * =================================================================== */

/** Snapshot bruto do estado de campo ativo (uma leitura por refresh). */
export interface ActiveFieldState {
  operations: FieldOperation[];
  assignments: FieldOperationAssignment[];
  attendances: ServiceAttendance[];
}

/** Cruza operações ATIVAS × alocações ATIVAS × atendimentos EM_EXECUCAO em
 *  vínculos por técnico. Puro e determinístico (testável). */
export function buildDeriveContext(
  state: ActiveFieldState,
  orders: OrdemServico[]
): DeriveFieldContext {
  const orderById = new Map(orders.map((o) => [o.id, o]));

  const activeOperationById = new Map(
    state.operations.filter((op) => op.status === 'ATIVA').map((op) => [op.id, op])
  );

  const operations: OperatorOperationLink[] = [];
  for (const a of state.assignments) {
    if (a.status !== 'ATIVO') continue;
    const op = activeOperationById.get(a.operationId);
    if (!op) continue;
    operations.push({
      technicianId: a.technicianId,
      operationId: op.id,
      operationName: op.name,
      operationType: op.operationType,
      clientId: op.clientId,
    });
  }

  const attendances: OperatorAttendanceLink[] = [];
  for (const att of state.attendances) {
    if (att.status !== 'EM_EXECUCAO' || !att.technicianId) continue;
    const os = orderById.get(att.workOrderId);
    attendances.push({
      technicianId: att.technicianId,
      attendanceId: att.id,
      workOrderId: att.workOrderId,
      osNumero: os?.numero,
      clientId: os?.clienteId,
      startedAt: att.startedAt ? new Date(att.startedAt).getTime() : undefined,
    });
  }

  return { operations, attendances };
}

/** Leitura best-effort do estado de campo ativo (RLS aplica-se no servidor). */
export async function fetchActiveFieldState(): Promise<ActiveFieldState> {
  const [operations, assignments, attendances] = await Promise.all([
    fetchFieldOperations({ status: 'ATIVA' }).catch(() => [] as FieldOperation[]),
    fetchFieldOperationAssignments({ status: 'ATIVO' }).catch(() => [] as FieldOperationAssignment[]),
    fetchServiceAttendances({ status: 'EM_EXECUCAO' }).catch(() => [] as ServiceAttendance[]),
  ]);
  return { operations, assignments, attendances };
}
