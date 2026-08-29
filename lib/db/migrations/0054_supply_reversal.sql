-- Estorno seguro de entrada de fornecimento + rastreabilidade da origem.
-- NUNCA apaga movimentação: gera um movimento de SAÍDA inverso, vinculado ao
-- movimento original. Exige motivo + usuário. Bloqueia saldo negativo (§47).
-- Requer 0052 (supply_receipt_items, RPC de entrada), 0003 (stock_movements).
-- NÃO edita 0049-0053. Idempotente.

alter table public.stock_movements add column if not exists reverses_movement_id uuid;
alter table public.stock_movements add column if not exists reversal_reason text;
alter table public.stock_movements add column if not exists created_by text;
-- Um movimento só pode ser estornado uma vez.
create unique index if not exists stock_movements_reverses_unique
  on public.stock_movements (reverses_movement_id)
  where reverses_movement_id is not null;

alter table public.supply_receipt_items add column if not exists reversed_at timestamptz;
alter table public.supply_receipt_items add column if not exists reversal_movement_id text;

-- RPC de estorno: transacional, idempotente, imutável (não apaga nada).
create or replace function public.reverse_supply_receipt_item(p_item_id uuid, p_reason text, p_user text)
returns jsonb
language plpgsql
security invoker
as $$
declare
  it   public.supply_receipt_items%rowtype;
  mov  public.stock_movements%rowtype;
  inv  public.inventory_items%rowtype;
  qty  integer;
  new_balance integer;
  rev_id uuid;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'motivo do estorno e obrigatorio';
  end if;

  select * into it from public.supply_receipt_items where id = p_item_id for update;
  if not found then raise exception 'receipt item % not found', p_item_id; end if;
  if it.stock_movement_id is null then raise exception 'item ainda nao foi lancado no estoque'; end if;
  if it.reversed_at is not null then
    return jsonb_build_object('already_reversed', true, 'movement_id', it.reversal_movement_id);
  end if;

  select * into mov from public.stock_movements where id = it.stock_movement_id::uuid;
  qty := coalesce(it.quantity_accepted, 0)::int;
  if qty <= 0 then return jsonb_build_object('already_reversed', false, 'skipped', true); end if;

  select * into inv from public.inventory_items where id = it.inventory_item_id::uuid for update;
  if not found then raise exception 'inventory item nao encontrado'; end if;

  new_balance := coalesce(inv.quantity, 0) - qty;
  if new_balance < 0 then
    raise exception 'estorno geraria saldo negativo (saldo % , estorno %). Trate o saldo antes.', inv.quantity, qty;
  end if;

  insert into public.stock_movements
    (item_id, item_code, item_name, type, quantity, resulting_balance, note, supply_order_id, reverses_movement_id, reversal_reason, created_by)
  values
    (inv.id, inv.code, inv.name, 'saida', qty, new_balance,
     'Estorno de recebimento ' || coalesce(mov.supply_order_id, ''), mov.supply_order_id, mov.id, p_reason, p_user)
  returning id into rev_id;

  update public.inventory_items set quantity = new_balance where id = inv.id;
  update public.supply_receipt_items set reversed_at = now(), reversal_movement_id = rev_id::text where id = it.id;

  return jsonb_build_object('already_reversed', false, 'movement_id', rev_id);
exception
  when unique_violation then
    return jsonb_build_object('already_reversed', true);
end;
$$;

grant execute on function public.reverse_supply_receipt_item(uuid, text, text) to authenticated;
