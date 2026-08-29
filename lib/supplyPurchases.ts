import { getSupabaseClient } from './supabaseClient';
import { SupplyPurchase, SupplyPurchaseItem } from './types';

/** Compras (subetapa opcional entre pedido de fornecimento e recebimento). */

const PURCHASES = 'supply_purchases';
const ITEMS = 'supply_purchase_items';

function purchaseFromRow(r: any): SupplyPurchase {
  return {
    id: String(r.id),
    supplyOrderId: String(r.supply_order_id),
    supplierId: r.supplier_id || undefined,
    supplier: r.supplier || undefined,
    status: (r.status || 'registrada') as SupplyPurchase['status'],
    purchaseDate: r.purchase_date || undefined,
    expectedDate: r.expected_date || undefined,
    notes: r.notes || undefined,
    totalValue: r.total_value === null || r.total_value === undefined ? undefined : Number(r.total_value),
    createdAt: r.created_at || undefined,
    items: Array.isArray(r.supply_purchase_items) ? r.supply_purchase_items.map(itemFromRow) : undefined,
  };
}
function itemFromRow(r: any): SupplyPurchaseItem {
  return {
    id: String(r.id),
    purchaseId: String(r.purchase_id),
    orderItemKey: r.order_item_key || undefined,
    inventoryItemId: r.inventory_item_id || undefined,
    descricao: r.descricao || undefined,
    quantity: Number(r.quantity || 0),
    unitCost: r.unit_cost === null || r.unit_cost === undefined ? undefined : Number(r.unit_cost),
    total: r.total === null || r.total === undefined ? undefined : Number(r.total),
  };
}

export async function fetchPurchases(supplyOrderId: string): Promise<SupplyPurchase[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from(PURCHASES)
    .select('*, supply_purchase_items(*)')
    .eq('supply_order_id', supplyOrderId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(purchaseFromRow);
}

export async function createPurchase(
  purchase: Omit<SupplyPurchase, 'id'>,
  items: Omit<SupplyPurchaseItem, 'id' | 'purchaseId'>[]
): Promise<SupplyPurchase> {
  const supabase = getSupabaseClient() as any;
  const total = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unitCost || 0), 0);
  const { data: pur, error: e1 } = await supabase
    .from(PURCHASES)
    .insert({
      supply_order_id: purchase.supplyOrderId,
      supplier_id: purchase.supplierId || null,
      supplier: purchase.supplier || null,
      status: purchase.status || 'registrada',
      purchase_date: purchase.purchaseDate || null,
      expected_date: purchase.expectedDate || null,
      notes: purchase.notes || null,
      total_value: total,
    })
    .select()
    .single();
  if (e1) throw e1;
  const rows = items.map((it) => ({
    purchase_id: pur.id,
    order_item_key: it.orderItemKey || null,
    inventory_item_id: it.inventoryItemId || null,
    descricao: it.descricao || null,
    quantity: it.quantity ?? 0,
    unit_cost: it.unitCost ?? null,
    total: Number(it.quantity || 0) * Number(it.unitCost || 0),
  }));
  if (rows.length > 0) {
    const { error: e2 } = await supabase.from(ITEMS).insert(rows);
    if (e2) throw e2;
  }
  const all = await fetchPurchases(purchase.supplyOrderId);
  return all.find((p) => p.id === String(pur.id)) || purchaseFromRow(pur);
}
