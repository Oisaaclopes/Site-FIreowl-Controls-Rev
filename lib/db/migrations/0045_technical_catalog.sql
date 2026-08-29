-- Catálogo técnico: metadados não alteram saldo, custo, preço ou vínculos existentes.
alter table public.inventory_items add column if not exists product_line text;
alter table public.inventory_items add column if not exists technologies text[];
alter table public.inventory_items add column if not exists catalog_status text not null default 'ATIVO';
alter table public.inventory_items add column if not exists product_type text not null default 'EQUIPMENT';
alter table public.inventory_items add column if not exists catalog_only boolean not null default false;
alter table public.inventory_items add column if not exists notes text;
alter table public.inventory_items add column if not exists datasheet_url text;
create index if not exists inventory_items_catalog_lookup_idx on public.inventory_items (category, brand, model);
