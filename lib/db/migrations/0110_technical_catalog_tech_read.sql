-- RBAC de campo: o TÉCNICO precisa consultar o catálogo TÉCNICO (fabricante/
-- modelo/família) para executar OS/Atendimento/Levantamento/Base Técnica, SEM
-- ver dado comercial (custo/preço/margem/fornecedor/saldo).
--
-- CAUSA do bug: `technical_catalog` (0086) roda em modo INVOKER, então respeita
-- a RLS de `inventory_items`, que (0005) só libera SELECT para
-- ADMINISTRATIVO/GESTOR. Resultado: para o TÉCNICO a view volta VAZIA e os
-- seletores de fabricante/modelo ficam em branco (no ADM funcionam).
--
-- CORREÇÃO MÍNIMA: recriar a view como SECURITY DEFINER (security_invoker=false).
-- A view expõe SOMENTE colunas de identificação técnica (as mesmas da 0086) —
-- NENHUM campo comercial. Assim o técnico lê a projeção price-free sem ganhar
-- acesso direto a `inventory_items` (a RLS da tabela permanece intacta: técnico
-- continua SEM poder consultar custo/preço/saldo por query direta).
--
-- NÃO abre inventory_items para o técnico. NÃO cria tabela. NÃO toca dados.
-- Idempotente (create or replace).

create or replace view public.technical_catalog
with (security_invoker = false) as
select
  i.id,
  i.code,
  i.name,
  i.category,           -- ÁREA (SDAI/CFTV/…)
  i.subcategory,        -- FAMÍLIA / TIPO
  i.brand,              -- FABRICANTE
  i.model,              -- MODELO
  i.product_line,
  i.unit,
  i.image_url,
  i.technologies,
  i.short_description,
  i.technical_description,
  i.recommended_use,
  i.datasheet_url,
  i.system_type,
  i.product_type,
  i.catalog_status,
  i.market_segment,
  i.canonical_taxonomy_id
from public.inventory_items i;
-- Deliberadamente FORA da view (nunca expostos): unit_price, sale_price,
-- cost_price, profit_margin, markup, supplier, quantity, reserved_quantity,
-- location, commercial_description, notes.

comment on view public.technical_catalog is
  'Projeção somente-identificação do catálogo (Relatórios/Atendimento/Base '
  'Técnica/Levantamento). SECURITY DEFINER: legível por TÉCNICO sem abrir a RLS '
  'de inventory_items; NUNCA carrega preço/custo/margem/fornecedor/saldo.';

grant select on public.technical_catalog to authenticated;
revoke all on public.technical_catalog from anon;
