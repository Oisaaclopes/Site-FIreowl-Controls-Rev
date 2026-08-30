import { getSupabaseClient } from './supabaseClient';
import { SupplierProduct } from './types';

const TABLE = 'supplier_products';

function fromRow(row: any): SupplierProduct {
  return {
    id: String(row.id),
    supplierId: String(row.supplier_id),
    inventoryItemId: String(row.inventory_item_id),
    supplierCode: row.supplier_code ?? undefined,
    supplierDescription: row.supplier_description ?? undefined,
    cost: row.cost == null ? undefined : Number(row.cost),
    leadTimeDays: row.lead_time_days == null ? undefined : Number(row.lead_time_days),
    minimumOrderQty: row.minimum_order_qty == null ? undefined : Number(row.minimum_order_qty),
    lastQuoteDate: row.last_quote_date ?? undefined,
    active: row.active !== false,
  };
}

function toRow(product: SupplierProduct): Record<string, unknown> {
  return {
    id: product.id,
    supplier_id: product.supplierId,
    inventory_item_id: product.inventoryItemId,
    supplier_code: product.supplierCode ?? null,
    supplier_description: product.supplierDescription ?? null,
    cost: product.cost ?? null,
    lead_time_days: product.leadTimeDays ?? null,
    minimum_order_qty: product.minimumOrderQty ?? null,
    last_quote_date: product.lastQuoteDate ?? null,
    active: product.active,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchSupplierProducts(supplierId: string): Promise<SupplierProduct[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).select('*').eq('supplier_id', supplierId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function upsertSupplierProduct(product: SupplierProduct): Promise<SupplierProduct> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).upsert(toRow(product), { onConflict: 'supplier_id,inventory_item_id' }).select().single();
  if (error) throw error;
  return fromRow(data);
}

/** Desativa o vínculo para preservar o histórico de cotações e compras. */
export async function deactivateSupplierProduct(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(TABLE).update({ active: false, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}
