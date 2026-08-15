import { getSupabaseClient } from './supabaseClient';
import { Supplier } from './types';

const TABLE = 'suppliers';

function rowToSupplier(r: any): Supplier {
  return {
    id: String(r.id),
    code: r.code || '',
    name: r.name || '',
    cnpj: r.cnpj || '',
    category: r.category || '',
    contactName: r.contact_name || '',
    phone: r.phone || '',
    email: r.email || '',
    city: r.city || '',
    rating: Number(r.rating ?? 0),
    leadTimeDays: Number(r.lead_time_days ?? 0),
    activeStatus: (r.active_status || 'HOMOLOGADO') as Supplier['activeStatus'],
    brands: Array.isArray(r.brands) ? r.brands.map(String) : [],
  };
}

function supplierToRow(s: Supplier): Record<string, unknown> {
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    cnpj: s.cnpj,
    category: s.category,
    contact_name: s.contactName,
    phone: s.phone,
    email: s.email,
    city: s.city,
    rating: s.rating,
    lead_time_days: s.leadTimeDays,
    active_status: s.activeStatus,
    brands: s.brands ?? [],
    updated_at: new Date().toISOString(),
  };
}

export async function fetchSuppliers(): Promise<Supplier[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToSupplier);
}

export async function upsertSupplier(s: Supplier): Promise<Supplier> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).upsert(supplierToRow(s), { onConflict: 'id' }).select().single();
  if (error) throw error;
  return rowToSupplier(data);
}

export async function deleteSupplier(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
