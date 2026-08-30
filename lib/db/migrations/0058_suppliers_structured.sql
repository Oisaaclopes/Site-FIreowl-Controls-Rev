-- Etapa 6: ampliação aditiva de fornecedores e relação produto × fornecedor.
-- Preserva suppliers e inventory_items existentes; não altera preço, custo ou saldo mestre.
alter table public.suppliers
  add column if not exists trade_name text,
  add column if not exists state_registration text,
  add column if not exists logo_path text,
  add column if not exists notes text,
  add column if not exists contacts jsonb not null default '[]'::jsonb,
  add column if not exists areas text[] not null default '{}',
  add column if not exists zip_code text,
  add column if not exists street text,
  add column if not exists street_number text,
  add column if not exists complement text,
  add column if not exists neighborhood text,
  add column if not exists state text,
  add column if not exists pickup_available boolean not null default false,
  add column if not exists carrier text,
  add column if not exists freight_mode text,
  add column if not exists logistics_notes text,
  add column if not exists payment_terms text,
  add column if not exists minimum_order_value numeric,
  add column if not exists standard_discount numeric,
  add column if not exists freight_policy text,
  add column if not exists quote_validity_days integer,
  add column if not exists commercial_notes text,
  add column if not exists homologated_at date,
  add column if not exists homologated_by text,
  add column if not exists homologation_valid_until date,
  add column if not exists homologation_notes text;

create table if not exists public.supplier_products (
  id text primary key,
  supplier_id text not null references public.suppliers(id) on delete cascade,
  inventory_item_id text not null references public.inventory_items(id) on delete cascade,
  supplier_code text,
  supplier_description text,
  cost numeric,
  lead_time_days integer,
  minimum_order_qty numeric,
  last_quote_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(supplier_id, inventory_item_id)
);
create index if not exists supplier_products_supplier_idx on public.supplier_products(supplier_id);
create index if not exists supplier_products_inventory_idx on public.supplier_products(inventory_item_id);

alter table public.supplier_products enable row level security;
grant select, insert, update, delete on public.supplier_products to authenticated;
drop policy if exists "supplier products select" on public.supplier_products;
create policy "supplier products select" on public.supplier_products for select to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'));
drop policy if exists "supplier products write" on public.supplier_products;
create policy "supplier products write" on public.supplier_products for all to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'));
