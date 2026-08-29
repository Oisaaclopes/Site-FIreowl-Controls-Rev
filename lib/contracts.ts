import { getSupabaseClient } from './supabaseClient';
import { Contract } from './types';

const TABLE = 'contracts';

function rowToContract(r: any): Contract {
  return {
    id: String(r.id),
    clientName: r.client_name || '',
    unit: r.unit || '',
    monthlyValue: Number(r.monthly_value ?? 0),
    renewalDate: r.renewal_date || '',
    readjustmentIndex: r.readjustment_index || '',
    contractedHours: Number(r.contracted_hours ?? 0),
    usedHours: Number(r.used_hours ?? 0),
    status: (r.status || 'ATIVO') as Contract['status'],
    responsibleTech: r.responsible_tech || '',
    artDocumentRef: r.art_document_ref || '',
    clientId: r.client_id ?? undefined,
    startDate: r.start_date ?? undefined,
    contractType: r.contract_type ?? undefined,
    paymentDay: r.payment_day ?? undefined,
    sourcePedidoId: r.source_pedido_id ?? undefined,
  };
}

function contractToRow(c: Contract): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: c.id,
    client_name: c.clientName,
    unit: c.unit,
    monthly_value: c.monthlyValue ?? 0,
    renewal_date: c.renewalDate,
    readjustment_index: c.readjustmentIndex,
    contracted_hours: c.contractedHours ?? 0,
    used_hours: c.usedHours ?? 0,
    status: c.status,
    responsible_tech: c.responsibleTech,
    art_document_ref: c.artDocumentRef,
    updated_at: new Date().toISOString(),
  };
  // Campos estendidos: só enviados quando presentes (compatível com bancos
  // sem a migração 0022 aplicada).
  if (c.clientId !== undefined) row.client_id = c.clientId;
  if (c.startDate !== undefined) row.start_date = c.startDate;
  if (c.contractType !== undefined) row.contract_type = c.contractType;
  if (c.paymentDay !== undefined) row.payment_day = c.paymentDay;
  if (c.sourcePedidoId !== undefined) row.source_pedido_id = c.sourcePedidoId;
  return row;
}

export async function fetchContracts(): Promise<Contract[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToContract);
}

export async function upsertContract(c: Contract): Promise<Contract> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).upsert(contractToRow(c), { onConflict: 'id' }).select().single();
  if (error) throw error;
  return rowToContract(data);
}

export async function deleteContract(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
