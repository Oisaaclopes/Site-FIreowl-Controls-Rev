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
    pricingMode: r.pricing_mode ?? undefined,
    stockManaged: r.stock_managed ?? undefined,
    idealQuantity: num(r.ideal_quantity),
    reservedQuantity: num(r.reserved_quantity),
    brand: r.brand ?? undefined,
    model: r.model ?? undefined,
    description: r.description ?? undefined,
    productLine: r.product_line ?? undefined,
    technologies: Array.isArray(r.technologies) ? r.technologies : undefined,
    catalogStatus: r.catalog_status ?? undefined,
    productType: r.product_type ?? undefined,
    catalogOnly: r.catalog_only ?? undefined,
    notes: r.notes ?? undefined,
    datasheetUrl: r.datasheet_url ?? undefined,
    technicalSpecs: r.technical_specs ?? undefined,
    shortDescription: r.short_description ?? undefined,
    commercialDescription: r.commercial_description ?? undefined,
    technicalDescription: r.technical_description ?? undefined,
    recommendedUse: r.recommended_use ?? undefined,
    technicalNotes: r.technical_notes ?? undefined,
    manufacturerUrl: r.manufacturer_url ?? undefined,
    specSourceUrl: r.spec_source_url ?? undefined,
    specLastVerifiedAt: r.spec_last_verified_at ?? undefined,
    systemType: r.system_type ?? undefined,
    marketSegment: r.market_segment ?? undefined,
    canonicalTaxonomyId: r.canonical_taxonomy_id ?? undefined,
    classificationStatus: r.classification_status ?? undefined,
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
    pricing_mode: i.pricingMode ?? null,
    stock_managed: i.stockManaged ?? true,
    ideal_quantity: i.idealQuantity ?? null,
    reserved_quantity: i.reservedQuantity ?? null,
    brand: i.brand || null,
    model: i.model || null,
    description: i.description || null,
    product_line: i.productLine || null,
    technologies: i.technologies ?? null,
    catalog_status: i.catalogStatus || 'ATIVO',
    product_type: i.productType || 'EQUIPMENT',
    catalog_only: i.catalogOnly ?? false,
    notes: i.notes || null,
    datasheet_url: i.datasheetUrl || null,
    technical_specs: i.technicalSpecs ?? null,
    short_description: i.shortDescription || null,
    commercial_description: i.commercialDescription || null,
    technical_description: i.technicalDescription || null,
    recommended_use: i.recommendedUse || null,
    technical_notes: i.technicalNotes || null,
    manufacturer_url: i.manufacturerUrl || null,
    spec_source_url: i.specSourceUrl || null,
    spec_last_verified_at: i.specLastVerifiedAt || null,
    system_type: i.systemType || null,
    market_segment: i.marketSegment || null,
    // Classificação canônica: preservada por round-trip nas edições; definível
    // no cadastro de produto. Ausente → não classificado (default do banco).
    canonical_taxonomy_id: i.canonicalTaxonomyId ?? null,
    classification_status: i.classificationStatus ?? 'NAO_CLASSIFICADO',
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
    supplyOrderId: r.supply_order_id ?? undefined,
    unitCost: r.unit_cost === null || r.unit_cost === undefined ? undefined : Number(r.unit_cost),
    reversesMovementId: r.reverses_movement_id ?? undefined,
    reversalReason: r.reversal_reason ?? undefined,
    createdBy: r.created_by ?? undefined,
    originType: r.origin_type ?? undefined,
    relatedMovementId: r.related_movement_id ?? undefined,
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
