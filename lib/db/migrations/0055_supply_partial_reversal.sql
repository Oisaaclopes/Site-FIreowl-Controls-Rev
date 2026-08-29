-- Estorno PARCIAL de entrada de fornecimento. Permite várias reversões por item
-- (ex.: -2, depois -1), imutável (nunca altera a movimentação original) e
-- idempotente por idempotency_key. NÃO edita 0054 (a RPC total continua válida).
-- Requer 0052 (supply_receipt_items) e 0003 (stock_movements). Idempotente.

alter table public.supply_receipt_items add column if not exists quantity_reversed numeric not null default 0;
alter table public.stock_movements add column if not exists origin_type text;        -- ex.: SUPPLY_REVERSAL
alter table public.stock_movements add column if not exists related_movement_id uuid; -- movimento de entrada relacionado

create table if not exists public.supply_reversals (
  id                uuid primary key default gen_random_uuid(),
  receipt_item_id   uuid not null references public.supply_receipt_items(id) on delete cascade,
  stock_movement_id uuid,
  quantity          numeric not null,
  reason            text not null,
  created_by        text,
  idempotency_key   text not null unique,   -- protege duplo clique / retry / refresh
  created_at        timestamptz not null default now()
);
create index if not exists supply_reversals_item_idx on public.supply_reversals (receipt_item_id);

alter table public.supply_reversals enable row level security;
grant select, insert, update on public.supply_reversals to authenticated;
drop policy if exists "supply reversals rw" on public.supply_reversals;
create policy "supply reversals rw" on public.supply_reversals for all to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'));

-- Estorno parcial transacional/idempotente. Gera SAÍDA (origin_type
-- SUPPLY_REVERSAL) vinculada à entrada original; nunca altera a original.
create or replace function public.reverse_supply_receipt_item_partial(
  p_item_id uuid, p_qty numeric, p_reason text, p_user text, p_idem text
) returns jsonb
language plpgsql
security invoker
as $$
declare
  it        public.supply_receipt_items%rowtype;
  inv       public.inventory_items%rowtype;
  existing  public.supply_reversals%rowtype;
  v_order   text;
  mov_orig  uuid;
  disponivel numeric;
  new_balance integer;
  mov_id    uuid;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'motivo do estorno e obrigatorio'; end if;
  if p_user  is null or length(trim(p_user))  = 0 then raise exception 'usuario e obrigatorio'; end if;
  if p_qty   is null or p_qty <= 0 then raise exception 'quantidade invalida'; end if;
  if p_idem  is null or length(trim(p_idem))  = 0 then raise exception 'idempotency key obrigatoria'; end if;

  -- serializa concorrentes no mesmo item antes de checar idempotência
  select * into it from public.supply_receipt_items where id = p_item_id for update;
  if not found then raise exception 'receipt item % not found', p_item_id; end if;

  select * into existing from public.supply_reversals where idempotency_key = p_idem;
  if found then return jsonb_build_object('already_processed', true, 'movement_id', existing.stock_movement_id); end if;

  if it.stock_movement_id is null then raise exception 'item ainda nao foi lancado no estoque'; end if;

  disponivel := coalesce(it.quantity_accepted, 0)
              - coalesce(it.quantity_reversed, 0)
              - (case when it.reversed_at is not null then coalesce(it.quantity_accepted, 0) else 0 end);
  if p_qty > disponivel then
    raise exception 'so existem % unidades disponiveis para estorno desta entrada', disponivel;
  end if;

  select supply_order_id into v_order from public.supply_receipts where id = it.receipt_id;
  mov_orig := it.stock_movement_id::uuid;

  select * into inv from public.inventory_items where id = it.inventory_item_id::uuid for update;
  if not found then raise exception 'inventory item nao encontrado'; end if;
  new_balance := coalesce(inv.quantity, 0) - p_qty::int;
  if new_balance < 0 then raise exception 'estorno geraria saldo negativo (saldo % , estorno %)', inv.quantity, p_qty; end if;

  insert into public.stock_movements
    (item_id, item_code, item_name, type, quantity, resulting_balance, note, supply_order_id, related_movement_id, origin_type, reversal_reason, created_by)
  values
    (inv.id, inv.code, inv.name, 'saida', p_qty::int, new_balance,
     'Estorno de recebimento ' || coalesce(v_order, ''), v_order, mov_orig, 'SUPPLY_REVERSAL', p_reason, p_user)
  returning id into mov_id;

  update public.inventory_items set quantity = new_balance where id = inv.id;
  update public.supply_receipt_items set quantity_reversed = coalesce(quantity_reversed, 0) + p_qty where id = it.id;
  insert into public.supply_reversals (receipt_item_id, stock_movement_id, quantity, reason, created_by, idempotency_key)
    values (it.id, mov_id, p_qty, p_reason, p_user, p_idem);

  return jsonb_build_object('already_processed', false, 'movement_id', mov_id, 'disponivel_restante', disponivel - p_qty);
exception
  when unique_violation then
    -- corrida perdida com o mesmo idempotency_key -> tudo desta chamada é revertido
    select * into existing from public.supply_reversals where idempotency_key = p_idem;
    return jsonb_build_object('already_processed', true, 'movement_id', existing.stock_movement_id);
end;
$$;

grant execute on function public.reverse_supply_receipt_item_partial(uuid, numeric, text, text, text) to authenticated;
