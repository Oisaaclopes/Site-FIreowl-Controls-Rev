-- Recebimentos (parciais) de pedidos de fornecimento + conferência + ENTRADA
-- SEGURA no estoque. Reutiliza stock_movements (NÃO cria segundo mecanismo).
-- Requer 0049 (supply_orders), 0003 (stock_movements), inventory_items.
-- NÃO edita migrations aplicadas (0049-0051). Idempotente.

-- ============ Rastreabilidade + idempotência nas movimentações ============
alter table public.stock_movements add column if not exists supply_order_id text;
alter table public.stock_movements add column if not exists supply_receipt_item_id uuid;
alter table public.stock_movements add column if not exists unit_cost numeric;
-- Uma movimentação por item de recebimento (idempotência forte no BANCO).
create unique index if not exists stock_movements_receipt_item_unique
  on public.stock_movements (supply_receipt_item_id)
  where supply_receipt_item_id is not null;
create index if not exists stock_movements_supply_order_idx on public.stock_movements (supply_order_id);

-- ============ Recebimentos ============
create table if not exists public.supply_receipts (
  id               uuid primary key default gen_random_uuid(),
  supply_order_id  text not null references public.supply_orders(id) on delete cascade,
  supplier         text,
  supplier_id      text,
  received_at      timestamptz not null default now(),
  received_by      text,
  notes            text,
  -- recebido | conferido | lancado | cancelado
  status           text not null default 'recebido',
  stock_posted_at  timestamptz,
  stock_posted_by  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists supply_receipts_order_idx on public.supply_receipts (supply_order_id);

-- ============ Itens do recebimento ============
create table if not exists public.supply_receipt_items (
  id                     uuid primary key default gen_random_uuid(),
  receipt_id             uuid not null references public.supply_receipts(id) on delete cascade,
  -- referência ao item do pedido (JSONB): chave estável (vinculoEstoqueId ou índice)
  order_item_key         text,
  inventory_item_id      text,
  descricao              text,
  quantity_received      numeric not null default 0,
  quantity_accepted      numeric not null default 0,
  quantity_rejected      numeric not null default 0,
  rejection_reason       text,
  unit_cost              numeric,
  -- preenchido quando lançado no estoque (idempotência no app + no banco)
  stock_movement_id      text,
  posted_at              timestamptz,
  created_at             timestamptz not null default now()
);
create index if not exists supply_receipt_items_receipt_idx on public.supply_receipt_items (receipt_id);

-- ============ RLS (mesmo perfil dos supply_orders: ADMIN/GESTOR/FINANCEIRO) ============
alter table public.supply_receipts enable row level security;
alter table public.supply_receipt_items enable row level security;
grant select, insert, update on public.supply_receipts to authenticated;
grant select, insert, update on public.supply_receipt_items to authenticated;

drop policy if exists "supply receipts rw" on public.supply_receipts;
create policy "supply receipts rw" on public.supply_receipts for all to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'));

drop policy if exists "supply receipt items rw" on public.supply_receipt_items;
create policy "supply receipt items rw" on public.supply_receipt_items for all to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'));

-- ============ Entrada TRANSACIONAL e IDEMPOTENTE no estoque ============
-- Uma única função executa tudo numa transação: cria a movimentação, atualiza o
-- saldo, marca o item como lançado. Se já lançado (ou corrida de duplo clique),
-- retorna o movimento existente sem duplicar (protegido pelo unique index).
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
begin
  -- trava a linha do item (serializa duplo clique concorrente)
  select * into it from public.supply_receipt_items where id = p_item_id for update;
  if not found then raise exception 'receipt item % not found', p_item_id; end if;

  -- idempotência: já lançado -> no-op
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

  insert into public.stock_movements
    (item_id, item_code, item_name, type, quantity, resulting_balance, note, supply_order_id, supply_receipt_item_id, unit_cost)
  values
    (inv.id, inv.code, inv.name, 'entrada', qty, new_balance,
     'Recebimento do fornecimento ' || rec.supply_order_id, rec.supply_order_id, it.id, it.unit_cost)
  returning id into mov_id;

  update public.inventory_items
     set quantity = new_balance,
         cost_price = coalesce(it.unit_cost, cost_price)
   where id = inv.id;

  update public.supply_receipt_items
     set stock_movement_id = mov_id::text, posted_at = now()
   where id = it.id;

  return jsonb_build_object('already_posted', false, 'movement_id', mov_id);
exception
  when unique_violation then
    -- corrida perdida: outro processo já lançou este mesmo item
    select stock_movement_id into it.stock_movement_id from public.supply_receipt_items where id = p_item_id;
    return jsonb_build_object('already_posted', true, 'movement_id', it.stock_movement_id);
end;
$$;

grant execute on function public.post_supply_receipt_item(uuid) to authenticated;
