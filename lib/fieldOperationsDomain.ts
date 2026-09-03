import { getSupabaseClient } from './supabaseClient';
import {
  FieldOperation,
  FieldOperationAssignment,
  FieldOperationStatus,
} from './types';

/* ===================================================================
 * ETAPA 3A — Acesso a dados da OPERAÇÃO DE CAMPO (recorrente) e da
 * ALOCAÇÃO de técnicos (N:N). NÃO confundir com lib/fieldOperations.ts,
 * que é a DERIVAÇÃO pura do estado do técnico no Dashboard.
 * Uma operação recorrente NÃO gera OS nem eventos de agenda por dia.
 * =================================================================== */

const OPERATIONS_TABLE = 'field_operations';
const ASSIGNMENTS_TABLE = 'field_operation_assignments';

/** Status de operação considerados "em andamento" para o painel. */
export const FIELD_OPERATION_ACTIVE: FieldOperationStatus[] = ['ATIVA'];

/** Plano puro de reconciliação de alocações (testável, sem I/O). Compara as
 *  alocações ATIVAS atuais com o conjunto desejado de técnicos e devolve quem
 *  adicionar e quais alocações encerrar (preservando histórico). §3/§8. */
export interface AssignmentReconcilePlan {
  toAssign: string[];
  toEnd: FieldOperationAssignment[];
}
export function planAssignmentReconcile(
  current: FieldOperationAssignment[],
  desiredTechIds: string[]
): AssignmentReconcilePlan {
  const active = current.filter((a) => a.status === 'ATIVO');
  const activeIds = active.map((a) => a.technicianId);
  const desired = Array.from(new Set(desiredTechIds)); // nunca duplica o mesmo técnico
  return {
    toAssign: desired.filter((id) => !activeIds.includes(id)),
    toEnd: active.filter((a) => !desired.includes(a.technicianId)),
  };
}

/** Aplica uma transição de status a uma operação (puro). Ao ENCERRAR, garante
 *  end_date (§7); nas demais, preserva a data existente. */
export function applyOperationStatus(
  op: FieldOperation,
  status: FieldOperationStatus,
  today = new Date().toISOString().slice(0, 10)
): FieldOperation {
  return {
    ...op,
    status,
    endDate: status === 'ENCERRADA' ? (op.endDate || today) : op.endDate,
  };
}

function rowToOperation(r: any): FieldOperation {
  return {
    id: String(r.id),
    clientId: r.client_id ?? undefined,
    contractId: r.contract_id ?? undefined,
    name: r.name || '',
    description: r.description ?? undefined,
    operationType: (r.operation_type || 'OUTRO') as FieldOperation['operationType'],
    status: (r.status || 'PLANEJADA') as FieldOperationStatus,
    startDate: r.start_date ?? undefined,
    endDate: r.end_date ?? undefined,
    externalSystemUrl: r.external_system_url ?? undefined,
    externalReference: r.external_reference ?? undefined,
    createdBy: r.created_by ?? undefined,
    createdAt: r.created_at ?? undefined,
    updatedAt: r.updated_at ?? undefined,
  };
}

function operationToRow(o: FieldOperation): Record<string, unknown> {
  const row: Record<string, unknown> = {
    client_id: o.clientId ?? null,
    contract_id: o.contractId ?? null,
    name: o.name,
    description: o.description ?? null,
    operation_type: o.operationType ?? 'OUTRO',
    status: o.status ?? 'PLANEJADA',
    start_date: o.startDate ?? null,
    end_date: o.endDate ?? null,
    external_system_url: o.externalSystemUrl ?? null,
    external_reference: o.externalReference ?? null,
    updated_at: new Date().toISOString(),
  };
  return row;
}

function rowToAssignment(r: any): FieldOperationAssignment {
  return {
    id: String(r.id),
    operationId: String(r.operation_id),
    technicianId: String(r.technician_id),
    startDate: r.start_date ?? undefined,
    endDate: r.end_date ?? undefined,
    status: (r.status || 'ATIVO') as FieldOperationAssignment['status'],
    createdAt: r.created_at ?? undefined,
    updatedAt: r.updated_at ?? undefined,
  };
}

export async function fetchFieldOperations(filter?: {
  clientId?: string;
  contractId?: string;
  status?: FieldOperationStatus;
}): Promise<FieldOperation[]> {
  const supabase = getSupabaseClient() as any;
  let query = supabase.from(OPERATIONS_TABLE).select('*').order('created_at', { ascending: false });
  if (filter?.clientId) query = query.eq('client_id', filter.clientId);
  if (filter?.contractId) query = query.eq('contract_id', filter.contractId);
  if (filter?.status) query = query.eq('status', filter.status);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(rowToOperation);
}

export async function createFieldOperation(o: FieldOperation): Promise<FieldOperation> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(OPERATIONS_TABLE).insert(operationToRow(o)).select().single();
  if (error) throw error;
  return rowToOperation(data);
}

export async function updateFieldOperation(o: FieldOperation): Promise<FieldOperation> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(OPERATIONS_TABLE).update(operationToRow(o)).eq('id', o.id).select().single();
  if (error) throw error;
  return rowToOperation(data);
}

export async function deleteFieldOperation(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(OPERATIONS_TABLE).delete().eq('id', id);
  if (error) throw error;
}

export async function fetchFieldOperationAssignments(filter?: {
  operationId?: string;
  technicianId?: string;
  status?: FieldOperationAssignment['status'];
}): Promise<FieldOperationAssignment[]> {
  const supabase = getSupabaseClient() as any;
  let query = supabase.from(ASSIGNMENTS_TABLE).select('*').order('created_at', { ascending: false });
  if (filter?.operationId) query = query.eq('operation_id', filter.operationId);
  if (filter?.technicianId) query = query.eq('technician_id', filter.technicianId);
  if (filter?.status) query = query.eq('status', filter.status);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(rowToAssignment);
}

export async function assignTechnicianToOperation(
  operationId: string,
  technicianId: string,
  startDate?: string
): Promise<FieldOperationAssignment> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from(ASSIGNMENTS_TABLE)
    .upsert(
      {
        operation_id: operationId,
        technician_id: technicianId,
        start_date: startDate ?? new Date().toISOString().slice(0, 10),
        end_date: null,
        status: 'ATIVO',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'operation_id,technician_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return rowToAssignment(data);
}

/** Encerra a alocação PRESERVANDO o histórico (§8): status ENCERRADO + end_date.
 *  Não deleta o registro — o período de atuação do técnico fica registrado. */
export async function endFieldOperationAssignment(
  assignmentId: string,
  endDate?: string
): Promise<FieldOperationAssignment> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from(ASSIGNMENTS_TABLE)
    .update({
      status: 'ENCERRADO',
      end_date: endDate ?? new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq('id', assignmentId)
    .select()
    .single();
  if (error) throw error;
  return rowToAssignment(data);
}

/** Exclusão dura de uma alocação (uso administrativo raro; prefira encerrar). */
export async function unassignTechnicianFromOperation(assignmentId: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(ASSIGNMENTS_TABLE).delete().eq('id', assignmentId);
  if (error) throw error;
}
