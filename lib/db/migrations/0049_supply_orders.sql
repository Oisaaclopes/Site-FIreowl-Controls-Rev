-- Pedidos de fornecimento originados de propostas comerciais aprovadas.
create table if not exists public.supply_orders (
  id text primary key,
  source_pedido_id text not null references public.pedidos(id) on delete restrict,
  client_id text references public.clients(id) on delete set null,
  client_name text not null,
  title text not null,
  status text not null default 'ABERTO',
  items jsonb not null default '[]'::jsonb,
  total_value numeric default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists supply_orders_source_pedido_unique on public.supply_orders(source_pedido_id);
create index if not exists supply_orders_client_idx on public.supply_orders(client_id);

alter table public.supply_orders enable row level security;
grant select, insert, update on public.supply_orders to authenticated;
drop policy if exists "supply orders select" on public.supply_orders;
create policy "supply orders select" on public.supply_orders for select to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'));
drop policy if exists "supply orders write" on public.supply_orders;
create policy "supply orders write" on public.supply_orders for all to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'));
