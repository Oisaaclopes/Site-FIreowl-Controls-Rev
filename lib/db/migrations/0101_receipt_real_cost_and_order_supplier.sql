-- CORREÇÃO — Custo REAL no recebimento (frete/outros rateados + custo médio
-- ponderado) + fornecedor ESTRUTURADO no pedido de fornecimento.
--
-- (1) Persistência do custo da compra por recebimento/item:
--     - supply_receipts.freight / other_costs (totais do evento de recebimento);
--     - supply_receipt_items.freight_alloc / other_costs_alloc (rateio em R$ por
--       item, calculado no app proporcional ao valor da mercadoria) e
--       final_unit_cost (custo unitário FINAL = mercadoria + rateio/unidade).
-- (2) RPC post_supply_receipt_item passa a:
--     - usar final_unit_cost (fallback unit_cost) no movimento e no custo;
--     - atualizar inventory_items.cost_price por CUSTO MÉDIO PONDERADO quando já
--       há saldo (antes SUBSTITUÍA pelo custo da última compra — incorreto);
--     - NUNCA alterar preço de venda/markup (preserva regra comercial).
-- (3) supply_orders.supplier_id (vínculo estruturado; snapshot supplier textual
--     preservado) para o recebimento pré-selecionar por id.
--
-- Aditiva/idempotente. RPC é security invoker → create or replace seguro.
-- Requer 0049 (supply_orders), 0052 (supply_receipts/items + RPC). NÃO edita
-- migrações aplicadas (0052/0099/0100). Próximo número real após 0100.

-- 1) Colunas de custo -----------------------------------------------------------
alter table public.supply_receipts
  add column if not exists freight      numeric,
  add column if not exists other_costs  numeric;

alter table public.supply_receipt_items
  add column if not exists freight_alloc     numeric,
  add column if not exists other_costs_alloc numeric,
  add column if not exists final_unit_cost   numeric;

-- 2) Fornecedor estruturado no pedido ------------------------------------------
alter table public.supply_orders
  add column if not exists supplier_id text;
create index if not exists supply_orders_supplier_idx on public.supply_orders (supplier_id) where supplier_id is not null;

-- 3) Entrada no estoque: custo final + custo médio ponderado --------------------
create or replace function public.post_supply_receipt_item(p_item_id uuid)
returns jsonb
language plpgsql
security invoker
as $$
declare
  it   public.supply_receipt_items%rowtype;
  rec  public.supply_receipts%rowtype;
  inv  public.inventory_items%rowtype;
  qty  integer;
  new_balance integer;
  mov_id uuid;
  v_final numeric;
  v_new_cost numeric;
begin
  select * into it from public.supply_receipt_items where id = p_item_id for update;
  if not found then raise exception 'receipt item % not found', p_item_id; end if;

  if it.stock_movement_id is not null then
    return jsonb_build_object('already_posted', true, 'movement_id', it.stock_movement_id);
  end if;

  qty := coalesce(it.quantity_accepted, 0)::int;
  if qty <= 0 then
    return jsonb_build_object('already_posted', false, 'skipped', true, 'movement_id', null);
  end if;
  if it.inventory_item_id is null then
    raise exception 'item de recebimento % sem vinculo de estoque', p_item_id;
  end if;

  select * into inv from public.inventory_items where id = it.inventory_item_id::uuid for update;
  if not found then raise exception 'inventory item % not found', it.inventory_item_id; end if;
  select * into rec from public.supply_receipts where id = it.receipt_id;

  new_balance := coalesce(inv.quantity, 0) + qty;
  -- custo unitário FINAL da entrada (mercadoria + rateio); fallback ao unit_cost.
  v_final := coalesce(it.final_unit_cost, it.unit_cost);

  -- custo médio ponderado quando já existe saldo com custo conhecido.
  if coalesce(inv.quantity, 0) > 0 and inv.cost_price is not null and v_final is not null then
    v_new_cost := round((inv.quantity::numeric * inv.cost_price + qty::numeric * v_final) / (inv.quantity + qty), 4);
  else
    v_new_cost := coalesce(v_final, inv.cost_price);
  end if;

  insert into public.stock_movements
    (item_id, item_code, item_name, type, quantity, resulting_balance, note, supply_order_id, supply_receipt_item_id, unit_cost)
  values
    (inv.id, inv.code, inv.name, 'entrada', qty, new_balance,
     'Recebimento do fornecimento ' || rec.supply_order_id, rec.supply_order_id, it.id, v_final)
  returning id into mov_id;

  -- NÃO altera sale_price/profit_margin/markup — apenas quantidade e custo.
  update public.inventory_items
     set quantity = new_balance,
         cost_price = v_new_cost
   where id = inv.id;

  update public.supply_receipt_items
     set stock_movement_id = mov_id::text, posted_at = now()
   where id = it.id;

  return jsonb_build_object('already_posted', false, 'movement_id', mov_id);
exception
  when unique_violation then
    select stock_movement_id into it.stock_movement_id from public.supply_receipt_items where id = p_item_id;
    return jsonb_build_object('already_posted', true, 'movement_id', it.stock_movement_id);
end;
$$;

grant execute on function public.post_supply_receipt_item(uuid) to authenticated;
