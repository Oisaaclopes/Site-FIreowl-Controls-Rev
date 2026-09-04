-- CORREÇÃO 3B.2 — catálogo técnico para o TÉCNICO + identificação de equipamento
-- na evidência fotográfica.
--
-- Motivação (auditoria): a RLS de inventory_items é `using(true)`, então o
-- técnico até LÊ o catálogo — porém a linha carrega preço/custo/margem/
-- fornecedor (unit_price, sale_price, cost_price, profit_margin, markup,
-- supplier…). Expor isso ao técnico viola a regra comercial (§27/§36) e
-- "não basta esconder por CSS". Criamos uma PROJEÇÃO SEGURA (view) com apenas
-- os campos de IDENTIFICAÇÃO técnica — sem nenhum dado comercial — e sem filtrar
-- por saldo (o catálogo técnico ≠ disponibilidade física, §28).
--
-- Também adicionamos, de forma NULLABLE e não-destrutiva, a identificação
-- opcional de equipamento na foto de campo (§32/§34): fabricante/modelo e uma
-- referência ao item do catálogo quando escolhido da lista. Identificação
-- manual (equipamento antigo/não cadastrado) fica só como texto — NÃO cria
-- produto no estoque nem movimenta saldo (§34/§38/§39).
--
-- Requer: 0002 (inventory_items), 0064 (field_photos). Idempotente.
-- NÃO edita/reaplica 0083/0084/0085.

-- 1) Catálogo técnico seguro (sem colunas comerciais; sem filtro de saldo) ----
create or replace view public.technical_catalog
with (security_invoker = true) as
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
-- Deliberadamente FORA da view: unit_price, sale_price, cost_price,
-- profit_margin, markup, supplier, quantity, reserved_quantity, location,
-- commercial_description, notes. O payload técnico não carrega dado comercial.

comment on view public.technical_catalog is
  'Projeção somente-identificação do catálogo para consulta técnica (Relatórios, '
  'Atendimento, Fotos). Sem preço/custo/margem/fornecedor e sem filtro de saldo. '
  'security_invoker respeita a RLS de inventory_items.';

grant select on public.technical_catalog to authenticated;

-- 2) Identificação (opcional) de equipamento na evidência (§32/§34) ----------
alter table public.field_photos
  add column if not exists equipment_catalog_item_id text,   -- inventory_items.id quando veio do catálogo
  add column if not exists equipment_brand text,             -- fabricante (catálogo OU informado manualmente)
  add column if not exists equipment_model text;             -- modelo (catálogo OU informado manualmente)

comment on column public.field_photos.equipment_catalog_item_id is
  'Item do catálogo técnico identificado na foto (inventory_items.id). NULL quando '
  'identificação manual ou sem equipamento. NUNCA movimenta estoque (§34/§38/§39).';
