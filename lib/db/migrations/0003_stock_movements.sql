-- Histórico de movimentações de estoque (entradas e saídas).
-- Rode este script no SQL Editor do Supabase (uma vez). Idempotente.

create table if not exists "stock_movements" (
  "id"                 uuid primary key default gen_random_uuid(),
  "item_id"            uuid references "inventory_items"("id") on delete set null,
  "item_code"          text,
  "item_name"          text,
  "type"               text not null check ("type" in ('entrada', 'saida')),
  "quantity"           integer not null,
  "resulting_balance"  integer,
  "note"               text,
  "created_at"         timestamptz not null default now()
);

create index if not exists "stock_movements_item_id_idx" on "stock_movements" ("item_id");
create index if not exists "stock_movements_created_at_idx" on "stock_movements" ("created_at" desc);

alter table "stock_movements" enable row level security;

grant select, insert on "stock_movements" to anon, authenticated;

-- ATENÇÃO: acesso público (chave anon), consistente com o restante do site
-- estático. Para produção, troque por políticas baseadas em auth.uid().
drop policy if exists "movements public select" on "stock_movements";
create policy "movements public select"
  on "stock_movements" for select
  to anon, authenticated
  using (true);

drop policy if exists "movements public insert" on "stock_movements";
create policy "movements public insert"
  on "stock_movements" for insert
  to anon, authenticated
  with check (true);
