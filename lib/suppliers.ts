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
    tradeName: r.trade_name ?? undefined,
    stateRegistration: r.state_registration ?? undefined,
    logoPath: r.logo_path ?? undefined,
    notes: r.notes ?? undefined,
    contacts: Array.isArray(r.contacts) ? r.contacts : [],
    areas: Array.isArray(r.areas) ? r.areas.map(String) : [],
    address: { zipCode: r.zip_code ?? undefined, street: r.street ?? undefined, number: r.street_number ?? undefined, complement: r.complement ?? undefined, neighborhood: r.neighborhood ?? undefined, city: r.city ?? undefined, state: r.state ?? undefined },
    logistics: { pickupAvailable: r.pickup_available ?? false, carrier: r.carrier ?? undefined, freightMode: r.freight_mode ?? undefined, notes: r.logistics_notes ?? undefined },
    commercial: { paymentTerms: r.payment_terms ?? undefined, minimumOrderValue: r.minimum_order_value == null ? undefined : Number(r.minimum_order_value), standardDiscount: r.standard_discount == null ? undefined : Number(r.standard_discount), freightPolicy: r.freight_policy ?? undefined, quoteValidityDays: r.quote_validity_days ?? undefined, notes: r.commercial_notes ?? undefined },
    homologation: { homologatedAt: r.homologated_at ?? undefined, homologatedBy: r.homologated_by ?? undefined, validUntil: r.homologation_valid_until ?? undefined, notes: r.homologation_notes ?? undefined },
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
    trade_name: s.tradeName ?? null, state_registration: s.stateRegistration ?? null, logo_path: s.logoPath ?? null, notes: s.notes ?? null,
    contacts: s.contacts ?? [], areas: s.areas ?? [], zip_code: s.address?.zipCode ?? null, street: s.address?.street ?? null, street_number: s.address?.number ?? null, complement: s.address?.complement ?? null, neighborhood: s.address?.neighborhood ?? null, state: s.address?.state ?? null,
    pickup_available: s.logistics?.pickupAvailable ?? false, carrier: s.logistics?.carrier ?? null, freight_mode: s.logistics?.freightMode ?? null, logistics_notes: s.logistics?.notes ?? null,
    payment_terms: s.commercial?.paymentTerms ?? null, minimum_order_value: s.commercial?.minimumOrderValue ?? null, standard_discount: s.commercial?.standardDiscount ?? null, freight_policy: s.commercial?.freightPolicy ?? null, quote_validity_days: s.commercial?.quoteValidityDays ?? null, commercial_notes: s.commercial?.notes ?? null,
    homologated_at: s.homologation?.homologatedAt ?? null, homologated_by: s.homologation?.homologatedBy ?? null, homologation_valid_until: s.homologation?.validUntil ?? null, homologation_notes: s.homologation?.notes ?? null,
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
