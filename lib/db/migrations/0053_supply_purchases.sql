-- Compra (subetapa opcional entre pedido de fornecimento e recebimento).
-- Separa COMPRA de RECEBIMENTO: guarda fornecedor + custo por compra e suporta
-- vários fornecedores por pedido. Entidade mínima (sem ERP de cotação).
-- Reutiliza suppliers (por id + snapshot de nome). NÃO edita 0049-0052. Idempotente.

create table if not exists public.supply_purchases (
  id               uuid primary key default gen_random_uuid(),
  supply_order_id  text not null references public.supply_orders(id) on delete cascade,
  supplier_id      text,
  supplier         text,           -- snapshot do nome do fornecedor no momento da compra
  status           text not null default 'registrada', -- registrada | recebida_parcial | recebida | cancelada
  purchase_date    date,
  expected_date    date,
  notes            text,
  total_value      numeric default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists supply_purchases_order_idx on public.supply_purchases (supply_order_id);

create table if not exists public.supply_purchase_items (
  id                 uuid primary key default gen_random_uuid(),
  purchase_id        uuid not null references public.supply_purchases(id) on delete cascade,
  order_item_key     text,
  inventory_item_id  text,
  descricao          text,
  quantity           numeric not null default 0,
  unit_cost          numeric,
  total              numeric,
  created_at         timestamptz not null default now()
);
create index if not exists supply_purchase_items_purchase_idx on public.supply_purchase_items (purchase_id);

-- Link opcional recebimento -> compra (rastreabilidade COMPRA -> RECEBIMENTO).
alter table public.supply_receipts add column if not exists purchase_id uuid;
alter table public.supply_receipt_items add column if not exists purchase_item_id uuid;

-- RLS (mesmo perfil comercial/financeiro; custo não vai para técnico).
alter table public.supply_purchases enable row level security;
alter table public.supply_purchase_items enable row level security;
grant select, insert, update on public.supply_purchases to authenticated;
grant select, insert, update on public.supply_purchase_items to authenticated;

drop policy if exists "supply purchases rw" on public.supply_purchases;
create policy "supply purchases rw" on public.supply_purchases for all to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'));

drop policy if exists "supply purchase items rw" on public.supply_purchase_items;
create policy "supply purchase items rw" on public.supply_purchase_items for all to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'));
