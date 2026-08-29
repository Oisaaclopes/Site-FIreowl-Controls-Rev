import { getSupabaseClient } from './supabaseClient';
import { SupplyReceipt, SupplyReceiptItem, SupplyOrder, SupplyPurchase, PedidoEquipmentItem } from './types';
import { fetchPurchases } from './supplyPurchases';

/**
 * Recebimentos de fornecimento (parciais) + entrada SEGURA no estoque.
 * Reutiliza stock_movements via a RPC transacional/idempotente
 * `post_supply_receipt_item` (migração 0052). Nunca duplica entrada.
 */

const RECEIPTS = 'supply_receipts';
const ITEMS = 'supply_receipt_items';

function receiptFromRow(r: any): SupplyReceipt {
  return {
    id: String(r.id),
    supplyOrderId: String(r.supply_order_id),
    supplier: r.supplier || undefined,
    supplierId: r.supplier_id || undefined,
    receivedAt: r.received_at || '',
    receivedBy: r.received_by || undefined,
    notes: r.notes || undefined,
    status: (r.status || 'recebido') as SupplyReceipt['status'],
    stockPostedAt: r.stock_posted_at || undefined,
    stockPostedBy: r.stock_posted_by || undefined,
    createdAt: r.created_at || undefined,
    items: Array.isArray(r.supply_receipt_items) ? r.supply_receipt_items.map(itemFromRow) : undefined,
  };
}
function itemFromRow(r: any): SupplyReceiptItem {
  return {
    id: String(r.id),
    receiptId: String(r.receipt_id),
    orderItemKey: r.order_item_key || undefined,
    inventoryItemId: r.inventory_item_id || undefined,
    descricao: r.descricao || undefined,
    quantityReceived: Number(r.quantity_received || 0),
    quantityAccepted: Number(r.quantity_accepted || 0),
    quantityRejected: Number(r.quantity_rejected || 0),
    rejectionReason: r.rejection_reason || undefined,
    unitCost: r.unit_cost === null || r.unit_cost === undefined ? undefined : Number(r.unit_cost),
    stockMovementId: r.stock_movement_id || undefined,
    postedAt: r.posted_at || undefined,
    reversedAt: r.reversed_at || undefined,
    reversalMovementId: r.reversal_movement_id || undefined,
  };
}

/** Recebimentos de um pedido (com itens). */
export async function fetchReceipts(supplyOrderId: string): Promise<SupplyReceipt[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from(RECEIPTS)
    .select('*, supply_receipt_items(*)')
    .eq('supply_order_id', supplyOrderId)
    .order('received_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(receiptFromRow);
}

/** Cria um recebimento + seus itens. */
export async function createReceipt(
  receipt: Omit<SupplyReceipt, 'id'>,
  items: Omit<SupplyReceiptItem, 'id' | 'receiptId'>[]
): Promise<SupplyReceipt> {
  const supabase = getSupabaseClient() as any;
  const { data: rec, error: e1 } = await supabase
    .from(RECEIPTS)
    .insert({
      supply_order_id: receipt.supplyOrderId,
      supplier: receipt.supplier || null,
      supplier_id: receipt.supplierId || null,
      received_at: receipt.receivedAt || new Date().toISOString(),
      received_by: receipt.receivedBy || null,
      notes: receipt.notes || null,
      status: receipt.status || 'recebido',
    })
    .select()
    .single();
  if (e1) throw e1;
  const rows = items.map((it) => ({
    receipt_id: rec.id,
    order_item_key: it.orderItemKey || null,
    inventory_item_id: it.inventoryItemId || null,
    descricao: it.descricao || null,
    quantity_received: it.quantityReceived ?? 0,
    quantity_accepted: it.quantityAccepted ?? 0,
    quantity_rejected: it.quantityRejected ?? 0,
    rejection_reason: it.rejectionReason || null,
    unit_cost: it.unitCost ?? null,
  }));
  if (rows.length > 0) {
    const { error: e2 } = await supabase.from(ITEMS).insert(rows);
    if (e2) throw e2;
  }
  const [full] = await fetchReceipts(receipt.supplyOrderId).then((all) => all.filter((r) => r.id === String(rec.id)));
  return full || receiptFromRow(rec);
}

/** Atualiza a conferência de um item (aceito/rejeitado/motivo/custo). */
export async function updateReceiptItemConferencia(
  itemId: string,
  patch: Partial<Pick<SupplyReceiptItem, 'quantityAccepted' | 'quantityRejected' | 'rejectionReason' | 'unitCost'>>
): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const row: Record<string, unknown> = {};
  if (patch.quantityAccepted !== undefined) row.quantity_accepted = patch.quantityAccepted;
  if (patch.quantityRejected !== undefined) row.quantity_rejected = patch.quantityRejected;
  if (patch.rejectionReason !== undefined) row.rejection_reason = patch.rejectionReason || null;
  if (patch.unitCost !== undefined) row.unit_cost = patch.unitCost ?? null;
  const { error } = await supabase.from(ITEMS).update(row).eq('id', itemId);
  if (error) throw error;
}

export interface PostItemResult { itemId: string; movementId?: string; alreadyPosted: boolean; skipped?: boolean; error?: string }

/**
 * Lança no estoque, item a item, via RPC transacional/idempotente. Um item já
 * lançado (ou corrida de duplo clique) não gera nova entrada.
 */
export async function postReceiptToStock(receipt: SupplyReceipt, postedBy?: string): Promise<PostItemResult[]> {
  const supabase = getSupabaseClient() as any;
  const items = receipt.items || [];
  const results: PostItemResult[] = [];
  for (const it of items) {
    if ((it.quantityAccepted || 0) <= 0) { results.push({ itemId: it.id, alreadyPosted: false, skipped: true }); continue; }
    try {
      const { data, error } = await supabase.rpc('post_supply_receipt_item', { p_item_id: it.id });
      if (error) throw error;
      results.push({ itemId: it.id, movementId: data?.movement_id || undefined, alreadyPosted: !!data?.already_posted, skipped: !!data?.skipped });
    } catch (err: any) {
      results.push({ itemId: it.id, alreadyPosted: false, error: err?.message || String(err) });
    }
  }
  // Marca o recebimento como lançado (best-effort; a verdade é o stock_movement_id de cada item).
  const okAll = results.every((r) => r.alreadyPosted || r.movementId || r.skipped);
  if (okAll) {
    await supabase.from(RECEIPTS).update({ status: 'lancado', stock_posted_at: new Date().toISOString(), stock_posted_by: postedBy || null, updated_at: new Date().toISOString() }).eq('id', receipt.id);
  }
  return results;
}

/**
 * Recalcula o status do pedido (deriveSupplyStatus) a partir de recebimentos +
 * compras reais e persiste se mudou. Fonte de verdade (§35) — chamado após
 * registrar compra ou dar entrada.
 */
export async function syncSupplyOrderStatus(order: SupplyOrder): Promise<SupplyOrder['status']> {
  const supabase = getSupabaseClient() as any;
  const [receipts, purchases] = await Promise.all([fetchReceipts(order.id), fetchPurchases(order.id)]);
  const st = deriveSupplyStatus(order, receipts, purchases);
  if (st !== order.status) {
    await supabase.from('supply_orders').update({ status: st, updated_at: new Date().toISOString() }).eq('id', order.id);
  }
  return st;
}

export interface ReverseResult { alreadyReversed: boolean; movementId?: string; skipped?: boolean }

/**
 * §46/§47 — Estorno seguro de um item já lançado. Gera movimento de SAÍDA
 * inverso (nunca apaga), exige motivo + usuário, bloqueia saldo negativo,
 * idempotente. Usa a RPC transacional reverse_supply_receipt_item (0054).
 */
export async function reverseReceiptItem(receiptItemId: string, reason: string, user?: string): Promise<ReverseResult> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.rpc('reverse_supply_receipt_item', { p_item_id: receiptItemId, p_reason: reason, p_user: user || null });
  if (error) throw error;
  return { alreadyReversed: !!data?.already_reversed, movementId: data?.movement_id || undefined, skipped: !!data?.skipped };
}

// ---------------------------- derivação pura ----------------------------

const qtyItem = (i: PedidoEquipmentItem) => Number(i.quantidade || 0);

/** Quantidade prevista (vendida) por chave de item (vinculoEstoqueId ou índice). */
export function keyOf(item: PedidoEquipmentItem, index: number): string {
  return item.vinculoEstoqueId || `idx:${index}`;
}

/** Total recebido por chave, somando todos os recebimentos. */
export function recebidoPorChave(receipts: SupplyReceipt[]): Record<string, number> {
  const acc: Record<string, number> = {};
  receipts.filter((r) => r.status !== 'cancelado').forEach((r) => (r.items || []).forEach((it) => {
    const k = it.orderItemKey || (it.inventoryItemId ? it.inventoryItemId : '');
    if (!k) return;
    acc[k] = (acc[k] || 0) + Number(it.quantityReceived || 0);
  }));
  return acc;
}

/** Total já lançado no estoque (aceito e com movimento) por chave. */
export function lancadoPorChave(receipts: SupplyReceipt[]): Record<string, number> {
  const acc: Record<string, number> = {};
  receipts.filter((r) => r.status !== 'cancelado').forEach((r) => (r.items || []).forEach((it) => {
    if (!it.stockMovementId) return;
    const k = it.orderItemKey || (it.inventoryItemId ? it.inventoryItemId : '');
    if (!k) return;
    acc[k] = (acc[k] || 0) + Number(it.quantityAccepted || 0);
  }));
  return acc;
}

/**
 * §25 — status automático do pedido a partir das quantidades. Não rebaixa um
 * pedido cancelado. Materiais = itens não-serviço. Uma compra registrada (0053)
 * ou o campo legado purchaseDate marcam COMPRADO.
 */
export function deriveSupplyStatus(order: SupplyOrder, receipts: SupplyReceipt[], purchases: SupplyPurchase[] = []): SupplyOrder['status'] {
  if (order.status === 'CANCELADO') return 'CANCELADO';
  const materiais = (order.items || []).map((it, i) => ({ it, i })).filter((x) => x.it.tipo !== 'servico');
  const totalPrevisto = materiais.reduce((s, x) => s + qtyItem(x.it), 0);
  const rec = recebidoPorChave(receipts);
  const lan = lancadoPorChave(receipts);
  const totalRecebido = materiais.reduce((s, x) => s + (rec[keyOf(x.it, x.i)] || 0), 0);
  const totalLancado = materiais.reduce((s, x) => s + (lan[keyOf(x.it, x.i)] || 0), 0);

  const comprou = purchases.some((p) => p.status !== 'cancelada') || !!order.purchaseDate || order.status === 'COMPRADO';
  if (totalPrevisto <= 0) return order.status;

  if (totalLancado >= totalPrevisto && totalRecebido >= totalPrevisto) return 'CONCLUIDO';
  if (totalLancado > 0) return 'ENTRADA_PARCIAL_ESTOQUE';
  if (totalRecebido >= totalPrevisto) return 'RECEBIDO';
  if (totalRecebido > 0) return 'RECEBIMENTO_PARCIAL';
  if (comprou) return 'COMPRADO';
  if (order.status === 'EM_COTACAO') return 'EM_COTACAO';
  return 'ABERTO';
}

// ---------------------------- helpers puros (§51) ----------------------------

/** Falta receber por chave: previsto (vendido) − já recebido. Nunca negativo. */
export function remainingToReceive(order: SupplyOrder, receipts: SupplyReceipt[]): Record<string, number> {
  const rec = recebidoPorChave(receipts);
  const out: Record<string, number> = {};
  (order.items || []).forEach((it, i) => {
    if (it.tipo === 'servico') return;
    const k = keyOf(it, i);
    out[k] = Math.max(0, qtyItem(it) - (rec[k] || 0));
  });
  return out;
}

/** §8/§17 — necessidade de compra sugerida: pedido − estoque atual (nunca < 0). */
export function sugestaoCompra(quantidadePedido: number, estoqueAtual: number): number {
  return Math.max(0, Number(quantidadePedido || 0) - Number(estoqueAtual || 0));
}

/** §30 — conferência válida: aceito + rejeitado = recebido, todos ≥ 0. */
export function validaConferencia(recebido: number, aceito: number, rejeitado: number): boolean {
  const r = Number(recebido || 0), a = Number(aceito || 0), j = Number(rejeitado || 0);
  return a >= 0 && j >= 0 && a + j === r;
}

/** §26 — excedente ao receber: quanto passa do que ainda falta receber. */
export function excedente(faltaReceber: number, receberAgora: number): number {
  return Math.max(0, Number(receberAgora || 0) - Number(faltaReceber || 0));
}

/** Total de uma lista de itens de compra (Σ quantidade × custo unitário). */
export function totalCompra(items: { quantity?: number; unitCost?: number }[]): number {
  return items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unitCost || 0), 0);
}

export interface ResumoItem {
  key: string;
  descricao: string;
  inventoryItemId?: string;
  vinculado: boolean;
  pedido: number;
  estoque?: number;
  comprado: number;
  recebido: number;
  aceito: number;
  rejeitado: number;
  entrada: number;        // lançado no estoque, líquido de estorno
  estornado: number;
  pendenteRecebimento: number;
  pendenteEntrada: number; // aceito conferido, ainda não lançado
}

/** §5/§6 — resumo por item do fornecimento (números não ambíguos). */
export function resumoItensFornecimento(
  order: SupplyOrder,
  purchases: SupplyPurchase[],
  receipts: SupplyReceipt[],
  inventory: { id: string; quantity: number }[]
): ResumoItem[] {
  const compradoPorChave: Record<string, number> = {};
  purchases.filter((p) => p.status !== 'cancelada').forEach((p) => (p.items || []).forEach((it) => {
    const k = it.orderItemKey || it.inventoryItemId || '';
    if (k) compradoPorChave[k] = (compradoPorChave[k] || 0) + Number(it.quantity || 0);
  }));
  // Agregados de recebimento por chave.
  const agg: Record<string, { recebido: number; aceito: number; rejeitado: number; entrada: number; estornado: number; naoLancado: number }> = {};
  receipts.filter((r) => r.status !== 'cancelado').forEach((r) => (r.items || []).forEach((it) => {
    const k = it.orderItemKey || it.inventoryItemId || '';
    if (!k) return;
    const a = (agg[k] = agg[k] || { recebido: 0, aceito: 0, rejeitado: 0, entrada: 0, estornado: 0, naoLancado: 0 });
    a.recebido += Number(it.quantityReceived || 0);
    a.aceito += Number(it.quantityAccepted || 0);
    a.rejeitado += Number(it.quantityRejected || 0);
    if (it.stockMovementId && !it.reversedAt) a.entrada += Number(it.quantityAccepted || 0);
    if (it.reversedAt) a.estornado += Number(it.quantityAccepted || 0);
    if (!it.stockMovementId && Number(it.quantityAccepted || 0) > 0) a.naoLancado += Number(it.quantityAccepted || 0);
  }));
  return (order.items || []).map((it, i) => ({ it, i })).filter((x) => x.it.tipo !== 'servico').map(({ it, i }) => {
    const key = keyOf(it, i);
    const inv = it.vinculoEstoqueId ? inventory.find((s) => s.id === it.vinculoEstoqueId) : undefined;
    const a = agg[key] || { recebido: 0, aceito: 0, rejeitado: 0, entrada: 0, estornado: 0, naoLancado: 0 };
    const pedido = qtyItem(it);
    return {
      key,
      descricao: it.descricao || 'Item',
      inventoryItemId: it.vinculoEstoqueId,
      vinculado: !!inv,
      pedido,
      estoque: inv?.quantity,
      comprado: compradoPorChave[key] || 0,
      recebido: a.recebido,
      aceito: a.aceito,
      rejeitado: a.rejeitado,
      entrada: a.entrada,
      estornado: a.estornado,
      pendenteRecebimento: Math.max(0, pedido - a.recebido),
      pendenteEntrada: a.naoLancado,
    };
  });
}

/** §52 — traduz erros técnicos (P0001/23505/permission denied) para o usuário. */
export function mensagemErroFornecimento(err: unknown): string {
  const m = (typeof err === 'string' ? err : (err as any)?.message || '').toLowerCase();
  if (!m) return 'Não foi possível concluir a operação. Tente novamente.';
  if (m.includes('already') || m.includes('duplicate') || m.includes('23505')) return 'Esta operação já foi registrada.';
  if (m.includes('permission denied') || m.includes('42501') || m.includes('rls') || m.includes('policy')) return 'Você não tem permissão para esta ação.';
  if (m.includes('vincul') || m.includes('sem vinculo') || m.includes('nao foi lancado')) return 'O produto precisa estar vinculado ao estoque.';
  if (m.includes('saldo negativo') || m.includes('negativo')) return 'Não é possível estornar: o saldo disponível é insuficiente.';
  if (m.includes('motivo')) return 'Informe o motivo.';
  if (m.includes('not found')) return 'Registro não encontrado (recarregue a página).';
  return 'Não foi possível concluir a operação. Tente novamente.';
}
