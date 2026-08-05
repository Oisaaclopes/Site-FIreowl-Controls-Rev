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
  };
}

function txToRow(t: FinancialTransaction): Record<string, unknown> {
  return {
    id: t.id,
    type: t.type,
    client_or_vendor: t.clientOrVendor,
    description: t.description,
    tx_date: t.date,
    status: t.status,
    amount: t.amount ?? 0,
    updated_at: new Date().toISOString(),
  };
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
