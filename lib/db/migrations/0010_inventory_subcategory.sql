-- Adiciona subcategoria ao catálogo de produtos (estoque). Idempotente.
alter table public.inventory_items add column if not exists subcategory text;
