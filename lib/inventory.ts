import { getSupabaseClient } from './supabaseClient';
import { InventoryItem, StockMovement } from './types';

const TABLE = 'inventory_items';
const MOVEMENTS_TABLE = 'stock_movements';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string | undefined): boolean => !!v && UUID_RE.test(v);

// true se as variáveis do Supabase estiverem configuradas
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

const num = (v: unknown): number | undefined =>
  v === null || v === undefined ? undefined : Number(v);

// Linha do banco (snake_case) -> InventoryItem (camelCase)
function rowToItem(r: any): InventoryItem {
  return {
    id: String(r.id),
    code: r.code ?? '',
    serialBP: r.serial_bp ?? undefined,
    name: r.name ?? '',
    category: r.category ?? '',
    quantity: Number(r.quantity ?? 0),
    minQuantity: Number(r.min_quantity ?? 0),
    unitPrice: Number(r.unit_price ?? 0),
    supplier: r.supplier ?? '',
    location: r.location ?? '',
    imageUrl: r.image_url ?? undefined,
    subcategory: r.subcategory ?? undefined,
    unit: r.unit ?? undefined,
    salePrice: num(r.sale_price),
    costPrice: num(r.cost_price),
    profitMargin: num(r.profit_margin),
    markup: num(r.markup),
    stockManaged: r.stock_managed ?? undefined,
    idealQuantity: num(r.ideal_quantity),
    reservedQuantity: num(r.reserved_quantity),
    brand: r.brand ?? undefined,
    model: r.model ?? undefined,
    description: r.description ?? undefined,
  };
}

// InventoryItem -> linha do banco (sem id/created_at, gerados pelo banco)
function itemToRow(i: InventoryItem): Record<string, unknown> {
  return {
    code: i.code || null,
    serial_bp: i.serialBP || null,
    name: i.name,
    category: i.category || null,
    quantity: i.quantity ?? 0,
    min_quantity: i.minQuantity ?? 0,
    unit_price: i.unitPrice ?? 0,
    supplier: i.supplier || null,
    location: i.location || null,
    image_url: i.imageUrl || null,
    subcategory: i.subcategory || null,
    unit: i.unit || null,
    sale_price: i.salePrice ?? null,
    cost_price: i.costPrice ?? null,
    profit_margin: i.profitMargin ?? null,
    markup: i.markup ?? null,
    stock_managed: i.stockManaged ?? true,
    ideal_quantity: i.idealQuantity ?? null,
    reserved_quantity: i.reservedQuantity ?? null,
    brand: i.brand || null,
    model: i.model || null,
    description: i.description || null,
  };
}

// Carrega todos os itens do estoque (mais recentes primeiro)
export async function fetchInventory(): Promise<InventoryItem[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToItem);
}

// Insere um item e retorna a linha persistida (já com id do banco)
export async function insertInventoryItem(item: InventoryItem): Promise<InventoryItem> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from(TABLE)
    .insert(itemToRow(item))
    .select()
    .single();
  if (error) throw error;
  return rowToItem(data);
}

// Atualiza um item existente (pelo id) e retorna a linha persistida
export async function updateInventoryItem(item: InventoryItem): Promise<InventoryItem> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from(TABLE)
    .update(itemToRow(item))
    .eq('id', item.id)
    .select()
    .single();
  if (error) throw error;
  return rowToItem(data);
}

// Remove um item pelo id
export async function deleteInventoryItem(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

// ---- Movimentações de estoque ----

function movementRowToObj(r: any): StockMovement {
  return {
    id: String(r.id),
    itemId: r.item_id ?? undefined,
    itemCode: r.item_code ?? undefined,
    itemName: r.item_name ?? undefined,
    type: r.type === 'saida' ? 'saida' : 'entrada',
    quantity: Number(r.quantity ?? 0),
    resultingBalance: r.resulting_balance === null || r.resulting_balance === undefined
      ? undefined
      : Number(r.resulting_balance),
    note: r.note ?? undefined,
    createdAt: r.created_at ?? undefined,
  };
}

// Registra uma movimentação (entrada/saída) no histórico
export async function insertStockMovement(m: StockMovement): Promise<StockMovement> {
  const supabase = getSupabaseClient() as any;
  const row = {
    item_id: isUuid(m.itemId) ? m.itemId : null,
    item_code: m.itemCode || null,
    item_name: m.itemName || null,
    type: m.type,
    quantity: m.quantity,
    resulting_balance: m.resultingBalance ?? null,
    note: m.note || null,
  };
  const { data, error } = await supabase.from(MOVEMENTS_TABLE).insert(row).select().single();
  if (error) throw error;
  return movementRowToObj(data);
}

// Lista o histórico de movimentações (de um item, se informado)
export async function fetchStockMovements(itemId?: string): Promise<StockMovement[]> {
  const supabase = getSupabaseClient() as any;
  let query = supabase
    .from(MOVEMENTS_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (itemId && isUuid(itemId)) query = query.eq('item_id', itemId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(movementRowToObj);
}
