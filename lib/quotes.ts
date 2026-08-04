import { getSupabaseClient } from './supabaseClient';
import { CustomQuote } from './types';

const TABLE = 'custom_quotes';

function rowToQuote(r: any): CustomQuote {
  return {
    id: String(r.id),
    clientName: r.client_name || '',
    description: r.description || '',
    laborValue: Number(r.labor_value ?? 0),
    materialValue: Number(r.material_value ?? 0),
    totalValue: Number(r.total_value ?? 0),
    discountApplied: Number(r.discount_applied ?? 0),
    finalValue: Number(r.final_value ?? 0),
    validityDays: Number(r.validity_days ?? 15),
    status: (r.status || 'ENVIADO') as CustomQuote['status'],
    createdAt: r.created_at || '',
  };
}

function quoteToRow(q: CustomQuote): Record<string, unknown> {
  return {
    id: q.id,
    client_name: q.clientName,
    description: q.description,
    labor_value: q.laborValue,
    material_value: q.materialValue,
    total_value: q.totalValue,
    discount_applied: q.discountApplied,
    final_value: q.finalValue,
    validity_days: q.validityDays,
    status: q.status,
  };
}

export async function fetchQuotes(): Promise<CustomQuote[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToQuote);
}

export async function insertQuote(q: CustomQuote): Promise<CustomQuote> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).insert(quoteToRow(q)).select().single();
  if (error) throw error;
  return rowToQuote(data);
}
