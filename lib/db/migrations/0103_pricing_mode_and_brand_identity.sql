-- CADASTRO INTELIGENTE DE PRODUTO — formação de preço + identidade de marca.
--
-- Duas evoluções ADITIVAS e seguras (nenhuma coluna removida/renomeada, nenhum
-- dado histórico apagado, nenhum backfill cego/ambíguo). Próximo número real
-- após 0101/0102. NÃO edita migrações aplicadas.
--
-- 1) inventory_items.pricing_mode: memoriza QUAL variável comercial o usuário
--    informou (PRICE/MARGIN/MARKUP/PROFIT). Fonte de verdade comercial continua
--    sendo custo + preço de venda; margem/markup/lucro são DERIVADOS. O modo só
--    reabre a edição no mesmo modo. Ausente → a UI assume 'PRICE' (§13/§25).
--
-- 2) brands (fabricantes, entidade existente da 0036) ganha identidade mínima
--    correta (§19): normalized_name (dedup por caixa/espaço/acento), active e
--    updated_at. NÃO cria catalog_manufacturers — reutiliza a entidade que já
--    é a fonte de fabricantes no projeto. O índice em normalized_name NÃO é
--    UNIQUE (evita falha de aplicação caso já existam equivalentes legados; a
--    deduplicação é garantida em código no upsertBrand).
--
-- Requer 0002 (inventory_items) e 0036 (brands). Idempotente.

-- 1) Modo de formação de preço -------------------------------------------------
alter table public.inventory_items add column if not exists pricing_mode text;

-- 2) Identidade mínima do fabricante ------------------------------------------
alter table public.brands add column if not exists normalized_name text;
alter table public.brands add column if not exists active boolean not null default true;
alter table public.brands add column if not exists updated_at timestamptz not null default now();

-- Backfill do normalized_name a partir do nome (lower + trim). Sem unaccent
-- (extensão pode não estar disponível); o refinamento por acento é feito no
-- código. Só preenche linhas ainda nulas.
update public.brands
   set normalized_name = lower(btrim(regexp_replace(name, '\s+', ' ', 'g')))
 where normalized_name is null;

create index if not exists brands_normalized_name_idx on public.brands (normalized_name);
