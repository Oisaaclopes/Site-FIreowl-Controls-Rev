import { getSupabaseClient } from './supabaseClient';
import { FinancialTransaction } from './types';

const TABLE = 'transactions';

function rowToTx(r: any): FinancialTransaction {
  return {
    id: String(r.id),
    type: (r.type || 'RECEITA') as FinancialTransaction['type'],
    clientOrVendor: r.client_or_vendor || '',
    description: r.description || '',
    date: r.tx_date || '',
    status: (r.status || 'PENDENTE') as FinancialTransaction['status'],
    amount: Number(r.amount ?? 0),
    category: r.category ?? undefined,
    dueDate: r.due_date ?? undefined,
    paymentMethod: r.payment_method ?? undefined,
    documentRef: r.document_ref ?? undefined,
    costCenter: r.cost_center ?? undefined,
    clientId: r.client_id ?? undefined,
    contractId: r.contract_id ?? undefined,
    osId: r.os_id ?? undefined,
  };
}

function txToRow(t: FinancialTransaction): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: t.id,
    type: t.type,
    client_or_vendor: t.clientOrVendor,
    description: t.description,
    tx_date: t.date,
    status: t.status,
    amount: t.amount ?? 0,
    updated_at: new Date().toISOString(),
  };
  // Campos estendidos: só enviados quando presentes (mantém compatibilidade
  // caso a migração 0021 ainda não tenha sido aplicada no banco).
  if (t.category !== undefined) row.category = t.category;
  if (t.dueDate !== undefined) row.due_date = t.dueDate;
  if (t.paymentMethod !== undefined) row.payment_method = t.paymentMethod;
  if (t.documentRef !== undefined) row.document_ref = t.documentRef;
  if (t.costCenter !== undefined) row.cost_center = t.costCenter;
  if (t.clientId !== undefined) row.client_id = t.clientId;
  if (t.contractId !== undefined) row.contract_id = t.contractId;
  if (t.osId !== undefined) row.os_id = t.osId;
  return row;
}

export async function fetchTransactions(): Promise<FinancialTransaction[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToTx);
}

export async function upsertTransaction(t: FinancialTransaction): Promise<FinancialTransaction> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).upsert(txToRow(t), { onConflict: 'id' }).select().single();
  if (error) throw error;
  return rowToTx(data);
}

export async function deleteTransaction(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
