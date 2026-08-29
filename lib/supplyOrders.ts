import { SupplyOrder } from './types';
import { getSupabaseClient } from './supabaseClient';

const TABLE = 'supply_orders';
const fromRow = (row: any): SupplyOrder => ({ id: String(row.id), sourcePedidoId: String(row.source_pedido_id), clientId: row.client_id || undefined, clientName: row.client_name || '', title: row.title || '', status: row.status || 'ABERTO', supplier: row.supplier || undefined, purchaseDate: row.purchase_date || undefined, receivedAt: row.received_at || undefined, stockReceivedAt: row.stock_received_at || undefined, items: row.items || [], totalValue: Number(row.total_value || 0), createdAt: row.created_at || '' });

export async function fetchSupplyOrders(): Promise<SupplyOrder[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRow);
}
const toRow = (order: SupplyOrder) => ({ id: order.id, source_pedido_id: order.sourcePedidoId, client_id: order.clientId || null, client_name: order.clientName, title: order.title, status: order.status, supplier: order.supplier || null, purchase_date: order.purchaseDate || null, received_at: order.receivedAt || null, stock_received_at: order.stockReceivedAt || null, items: order.items, total_value: order.totalValue, created_at: order.createdAt, updated_at: new Date().toISOString() });
export async function insertSupplyOrder(order: SupplyOrder): Promise<SupplyOrder> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).insert(toRow(order)).select().single();
  if (error) throw error;
  return fromRow(data);
}
export async function updateSupplyOrder(order: SupplyOrder): Promise<SupplyOrder> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).update(toRow(order)).eq('id', order.id).select().single();
  if (error) throw error;
  return fromRow(data);
}
