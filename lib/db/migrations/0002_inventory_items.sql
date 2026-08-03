-- Tabela de persistência do Estoque (produtos do almoxarifado).
-- Rode este script no SQL Editor do Supabase (uma vez).
-- Seguro para rodar novamente (idempotente).

create table if not exists "inventory_items" (
  "id"                uuid primary key default gen_random_uuid(),
  "code"              text,
  "serial_bp"         text,
  "name"              text not null,
  "category"          text,
  "quantity"          integer default 0,
  "min_quantity"      integer default 0,
  "unit_price"        numeric default 0,
  "supplier"          text,
  "location"          text,
  "image_url"         text,
  "unit"              text,
  "sale_price"        numeric,
  "cost_price"        numeric,
  "profit_margin"     numeric,
  "markup"            numeric,
  "stock_managed"     boolean default true,
  "ideal_quantity"    integer,
  "reserved_quantity" integer,
  "brand"             text,
  "model"             text,
  "description"       text,
  "created_at"        timestamptz not null default now()
);

alter table "inventory_items" enable row level security;

grant select, insert, update, delete on "inventory_items" to anon, authenticated;

-- ATENÇÃO: estas políticas liberam o acesso público (chave anon) por
-- compatibilidade com o site estático atual, que ainda não usa Supabase Auth.
-- Para produção, troque por políticas baseadas em auth.uid() após ativar o login real.
drop policy if exists "inventory public select" on "inventory_items";
create policy "inventory public select"
  on "inventory_items" for select
  to anon, authenticated
  using (true);

drop policy if exists "inventory public insert" on "inventory_items";
create policy "inventory public insert"
  on "inventory_items" for insert
  to anon, authenticated
  with check (true);

drop policy if exists "inventory public update" on "inventory_items";
create policy "inventory public update"
  on "inventory_items" for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "inventory public delete" on "inventory_items";
create policy "inventory public delete"
  on "inventory_items" for delete
  to anon, authenticated
  using (true);
