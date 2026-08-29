/**
 * Teste de INTEGRAÇÃO real das RPCs de fornecimento (0052 + 0054 + 0055).
 * Requer SERVICE ROLE key (ignora RLS) — NÃO use a anon key.
 *
 * Uso (PowerShell):
 *   $env:SUPABASE_URL="https://xxxx.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="<service_role>"
 *   node scripts/supply-rpc-integration-test.mjs
 *
 * Cria dados TEST-*, executa os cenários §47–54 e apaga tudo ao final.
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

function fromEnvFile(k) {
  try { const e = fs.readFileSync('.env.local', 'utf8'); return (e.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, ''); } catch { return undefined; }
}
const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || fromEnvFile('NEXT_PUBLIC_SUPABASE_URL');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) { console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (service role).'); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const TAG = `TEST-${Date.now()}`;
let ok = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { ok++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name} ${extra}`); } };

async function main() {
  // ---- setup ----
  const invId = crypto.randomUUID();
  await sb.from('inventory_items').insert({ id: invId, code: `${TAG}-COD`, name: `${TAG} Câmera`, category: 'CFTV', quantity: 3, min_quantity: 0, unit_price: 0, cost_price: 100, sale_price: 999, supplier: 'x', location: 'x' });
  const orderId = `${TAG}-PF`;
  await sb.from('supply_orders').insert({ id: orderId, source_pedido_id: null, client_name: 'Cliente Teste', title: 'Teste', status: 'COMPRADO', items: [{ tipo: 'material', descricao: 'Câmera', quantidade: 10, vinculoEstoqueId: invId, precoUnitario: 120 }], total_value: 1200, created_at: new Date().toISOString() }).then((r) => { if (r.error) throw new Error('setup order: ' + r.error.message); });

  const mkReceiptItem = async (accepted) => {
    const { data: rec } = await sb.from('supply_receipts').insert({ supply_order_id: orderId, supplier: 'Distribuidor A', status: 'conferido' }).select().single();
    const { data: it } = await sb.from('supply_receipt_items').insert({ receipt_id: rec.id, order_item_key: invId, inventory_item_id: invId, descricao: 'Câmera', quantity_received: accepted, quantity_accepted: accepted, quantity_rejected: 0, unit_cost: 120 }).select().single();
    return it.id;
  };
  const invQty = async () => (await sb.from('inventory_items').select('quantity, cost_price, sale_price').eq('id', invId).single()).data;
  const movsFor = async (itemId) => (await sb.from('stock_movements').select('*').eq('supply_receipt_item_id', itemId)).data || [];

  // ---- 1) Entrada + custo (§53) ----
  console.log('\n[1] Entrada + custo');
  const i1 = await mkReceiptItem(5);
  const r1 = await sb.rpc('post_supply_receipt_item', { p_item_id: i1 });
  const q1 = await invQty();
  check('entrada retornou movimento', !!r1.data?.movement_id, JSON.stringify(r1.error));
  check('saldo 3 -> 8', q1.quantity === 8, `saldo=${q1.quantity}`);
  check('last cost = 120', Number(q1.cost_price) === 120, `cost=${q1.cost_price}`);
  check('sale_price inalterado (999)', Number(q1.sale_price) === 999, `sale=${q1.sale_price}`);
  check('1 movimento', (await movsFor(i1)).length === 1);

  // ---- 2) Idempotência: repost (§49 refresh/retry) ----
  console.log('\n[2] Idempotência (repost)');
  const r2 = await sb.rpc('post_supply_receipt_item', { p_item_id: i1 });
  check('already_posted = true', r2.data?.already_posted === true);
  check('saldo continua 8', (await invQty()).quantity === 8);
  check('ainda 1 movimento', (await movsFor(i1)).length === 1);

  // ---- 3) Duplo clique concorrente (§48) ----
  console.log('\n[3] Duplo clique concorrente');
  const i3 = await mkReceiptItem(2);
  await Promise.all([sb.rpc('post_supply_receipt_item', { p_item_id: i3 }), sb.rpc('post_supply_receipt_item', { p_item_id: i3 })]);
  check('exatamente 1 movimento (sem duplicar)', (await movsFor(i3)).length === 1);
  check('saldo 8 -> 10 (apenas +2)', (await invQty()).quantity === 10);

  // ---- 4) Estorno seguro (§46) ----
  console.log('\n[4] Estorno');
  const rev = await sb.rpc('reverse_supply_receipt_item', { p_item_id: i1, p_reason: 'Avaria identificada depois', p_user: 'teste' });
  check('estorno gerou movimento de saída', !!rev.data?.movement_id, JSON.stringify(rev.error));
  check('saldo 10 -> 5 (-5)', (await invQty()).quantity === 5);
  const rev2 = await sb.rpc('reverse_supply_receipt_item', { p_item_id: i1, p_reason: 'x', p_user: 'teste' });
  check('estorno idempotente (already_reversed)', rev2.data?.already_reversed === true);
  check('saldo continua 5', (await invQty()).quantity === 5);

  // ---- 5) Estorno sem motivo bloqueia (§46) ----
  console.log('\n[5] Estorno sem motivo');
  const i5 = await mkReceiptItem(1);
  await sb.rpc('post_supply_receipt_item', { p_item_id: i5 });
  const revNo = await sb.rpc('reverse_supply_receipt_item', { p_item_id: i5, p_reason: '', p_user: 't' });
  check('bloqueou estorno sem motivo', !!revNo.error, 'não bloqueou');

  // ---- 6) Estorno PARCIAL (0055 · §17) ----
  console.log('\n[6] Estorno parcial (0055)');
  // Item isolado com saldo previsível: cria produto novo e recebe 10 -> entrada +10.
  const invId2 = crypto.randomUUID();
  await sb.from('inventory_items').insert({ id: invId2, code: `${TAG}-COD2`, name: `${TAG} Sensor`, category: 'CFTV', quantity: 0, min_quantity: 0, unit_price: 0, cost_price: 0, sale_price: 0, supplier: 'x', location: 'x' });
  const { data: rec6 } = await sb.from('supply_receipts').insert({ supply_order_id: orderId, supplier: 'Distribuidor B', status: 'conferido' }).select().single();
  const { data: it6 } = await sb.from('supply_receipt_items').insert({ receipt_id: rec6.id, order_item_key: invId2, inventory_item_id: invId2, descricao: 'Sensor', quantity_received: 10, quantity_accepted: 10, quantity_rejected: 0, unit_cost: 50 }).select().single();
  await sb.rpc('post_supply_receipt_item', { p_item_id: it6.id });
  const invQty2 = async () => (await sb.from('inventory_items').select('quantity').eq('id', invId2).single()).data.quantity;
  const itemState = async () => (await sb.from('supply_receipt_items').select('quantity_reversed, quantity_accepted').eq('id', it6.id).single()).data;
  const revCount = async () => ((await sb.from('supply_reversals').select('id').eq('receipt_item_id', it6.id)).data || []).length;
  check('entrada inicial +10 (saldo 10)', (await invQty2()) === 10, `saldo=${await invQty2()}`);

  // 6a) estorna 2 -> líquido 8
  const idemA = crypto.randomUUID();
  const a = await sb.rpc('reverse_supply_receipt_item_partial', { p_item_id: it6.id, p_qty: 2, p_reason: 'Avaria', p_user: 'teste', p_idem: idemA });
  check('estorno de 2 ok', !!a.data?.movement_id, JSON.stringify(a.error));
  check('saldo 10 -> 8', (await invQty2()) === 8, `saldo=${await invQty2()}`);
  check('quantity_reversed = 2', Number((await itemState()).quantity_reversed) === 2);
  check('disponivel_restante = 8', Number(a.data?.disponivel_restante) === 8);

  // 6b) duplo clique com o MESMO idempotency_key -> só -2
  const aDup = await sb.rpc('reverse_supply_receipt_item_partial', { p_item_id: it6.id, p_qty: 2, p_reason: 'Avaria', p_user: 'teste', p_idem: idemA });
  check('idempotente (already_processed)', aDup.data?.already_processed === true, JSON.stringify(aDup.data));
  check('saldo continua 8', (await invQty2()) === 8);
  check('apenas 1 reversal registrado', (await revCount()) === 1);

  // 6c) estorna mais 3 -> líquido 5
  const b = await sb.rpc('reverse_supply_receipt_item_partial', { p_item_id: it6.id, p_qty: 3, p_reason: 'Erro de conferência', p_user: 'teste', p_idem: crypto.randomUUID() });
  check('estorno de +3 ok', !!b.data?.movement_id, JSON.stringify(b.error));
  check('saldo 8 -> 5', (await invQty2()) === 5, `saldo=${await invQty2()}`);
  check('quantity_reversed = 5', Number((await itemState()).quantity_reversed) === 5);

  // 6d) bloqueia estornar 6 (só restam 5)
  const c = await sb.rpc('reverse_supply_receipt_item_partial', { p_item_id: it6.id, p_qty: 6, p_reason: 'x', p_user: 'teste', p_idem: crypto.randomUUID() });
  check('bloqueou estorno acima do disponível', !!c.error, 'não bloqueou');
  check('saldo intacto (5)', (await invQty2()) === 5);

  // 6e) bloqueia por saldo insuficiente (saldo físico < disponível a estornar)
  await sb.from('inventory_items').update({ quantity: 1 }).eq('id', invId2);
  const d = await sb.rpc('reverse_supply_receipt_item_partial', { p_item_id: it6.id, p_qty: 3, p_reason: 'x', p_user: 'teste', p_idem: crypto.randomUUID() });
  check('bloqueou estorno com saldo negativo', !!d.error, 'não bloqueou');
  check('saldo intacto (1)', (await invQty2()) === 1);

  // 6f) motivo/quantidade inválidos
  const noReason = await sb.rpc('reverse_supply_receipt_item_partial', { p_item_id: it6.id, p_qty: 1, p_reason: '', p_user: 'teste', p_idem: crypto.randomUUID() });
  check('bloqueou sem motivo', !!noReason.error);
  const zeroQty = await sb.rpc('reverse_supply_receipt_item_partial', { p_item_id: it6.id, p_qty: 0, p_reason: 'x', p_user: 'teste', p_idem: crypto.randomUUID() });
  check('bloqueou quantidade <= 0', !!zeroQty.error);

  // ---- cleanup ----
  console.log('\n[cleanup]');
  const recsAll = (await sb.from('supply_receipts').select('id').eq('supply_order_id', orderId)).data || [];
  for (const r of recsAll) {
    const items = (await sb.from('supply_receipt_items').select('id').eq('receipt_id', r.id)).data || [];
    for (const it of items) await sb.from('supply_reversals').delete().eq('receipt_item_id', it.id);
  }
  await sb.from('stock_movements').delete().eq('supply_order_id', orderId);
  const recs = (await sb.from('supply_receipts').select('id').eq('supply_order_id', orderId)).data || [];
  for (const r of recs) await sb.from('supply_receipt_items').delete().eq('receipt_id', r.id);
  await sb.from('supply_receipts').delete().eq('supply_order_id', orderId);
  await sb.from('supply_purchases').delete().eq('supply_order_id', orderId);
  await sb.from('supply_orders').delete().eq('id', orderId);
  await sb.from('inventory_items').delete().eq('id', invId);
  await sb.from('inventory_items').delete().eq('id', invId2);
  console.log('  dados de teste removidos');

  console.log(`\nRESULTADO: ${ok} ok, ${fail} falhas`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
