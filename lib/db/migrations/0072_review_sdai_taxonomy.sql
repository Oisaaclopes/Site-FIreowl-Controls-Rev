-- =====================================================================
-- 0072_review_sdai_taxonomy
-- Revisão técnica dos 23 produtos SDAI em REVISAR (Edwards / Bosch /
-- Intelbras / Tecnohold), com base em documentação de fabricante/datasheet.
-- Cria os nós que faltavam (Módulo de Zona, Multicritério) e promove para
-- CLASSIFICADO apenas os modelos com identificação comprovada.
--
-- ADITIVA. NÃO edita/reaplica 0070/0071 (imutáveis). NÃO toca preço, custo,
-- saldo, fornecedor, brand, model, description, unit, catalog_status, nem
-- qualquer movimentação. Só escreve catalog_taxonomy_nodes / _aliases e
-- inventory_items.canonical_taxonomy_id / classification_status.
--
-- DEFENSIVA/idempotente: o backfill só toca linhas SDAI + status='REVISAR'
-- + marca + modelo exatos. Não faz UPDATE geral. Reexecução é no-op.
-- FAP-520 permanece REVISAR (variante FAP-O 520 x FAP-OC 520 ambígua).
--
-- Rode no SQL Editor do Supabase. Depende de 0070/0071 (nós + fireowl_catalog_norm).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Nós novos (só com produto real comprovado).
-- ---------------------------------------------------------------------
insert into public.catalog_taxonomy_nodes (area, parent_id, node_type, code, name, sort_order)
select v.area, p.id, v.node_type, v.code, v.name, v.sort_order
from (values
  ('SDAI','SDAI.MODULOS',    'FUNCTION', 'SDAI.MODULOS.ZONA',           'Módulo de Zona', 60),
  ('SDAI','SDAI.DETECTORES', 'TYPE',     'SDAI.DETECTORES.MULTICRITERIO','Multicritério',  25)
) as v(area, parent_code, node_type, code, name, sort_order)
join public.catalog_taxonomy_nodes p on p.code = v.parent_code
on conflict (code) do nothing;

insert into public.catalog_taxonomy_nodes (area, parent_id, node_type, code, name, sort_order)
select v.area, p.id, v.node_type, v.code, v.name, v.sort_order
from (values
  ('SDAI','SDAI.DETECTORES.MULTICRITERIO','TECHNOLOGY','SDAI.DETECTORES.MULTICRITERIO.END','Endereçável', 10)
) as v(area, parent_code, node_type, code, name, sort_order)
join public.catalog_taxonomy_nodes p on p.code = v.parent_code
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- 2) Aliases (normalizados; sem duplicar).
-- ---------------------------------------------------------------------
insert into public.catalog_taxonomy_aliases (taxonomy_node_id, alias, normalized_alias)
select n.id, a.alias, public.fireowl_catalog_norm(a.alias)
from (values
  ('SDAI.MODULOS.ZONA', 'Módulo de Zona'),
  ('SDAI.MODULOS.ZONA', 'Módulo Endereçador de Zona'),
  ('SDAI.MODULOS.ZONA', 'Endereçador de Zona'),
  ('SDAI.MODULOS.ZONA', 'Zone Module'),
  ('SDAI.MODULOS.ZONA', 'Módulo para Laço Convencional'),
  ('SDAI.DETECTORES.MULTICRITERIO', 'Multicritério'),
  ('SDAI.DETECTORES.MULTICRITERIO', 'Multisensor'),
  ('SDAI.DETECTORES.MULTICRITERIO', 'Multi-criteria')
) as a(code, alias)
join public.catalog_taxonomy_nodes n on n.code = a.code
on conflict (normalized_alias) do nothing;

-- =====================================================================
-- 3) BACKFILL revisado — por MARCA + MODELO exatos, só SDAI + REVISAR.
--    22 modelos → CLASSIFICADO. FAP-520 NÃO está na lista (segue REVISAR).
-- =====================================================================
update public.inventory_items i
set canonical_taxonomy_id = n.id, classification_status = 'CLASSIFICADO'
from (values
  -- Bosch AVENAR 4000
  ('bosch','fap425o',   'SDAI.DETECTORES.FUMACA.END'),
  ('bosch','fap425do',  'SDAI.DETECTORES.FUMACA.END'),
  ('bosch','fap425ot',  'SDAI.DETECTORES.MULTICRITERIO.END'),
  ('bosch','fap425dot', 'SDAI.DETECTORES.MULTICRITERIO.END'),
  ('bosch','fah425tr',  'SDAI.DETECTORES.TEMP.END'),
  -- Edwards Signature — detectores
  ('edwards','sigaosd', 'SDAI.DETECTORES.FUMACA.END'),
  ('edwards','sigapd',  'SDAI.DETECTORES.FUMACA.END'),
  ('edwards','sigaps',  'SDAI.DETECTORES.FUMACA.END'),
  ('edwards','sigahrd', 'SDAI.DETECTORES.TEMP.END'),
  ('edwards','sigahfs', 'SDAI.DETECTORES.TEMP.END'),
  ('edwards','sigaiphs','SDAI.DETECTORES.MULTICRITERIO.END'),
  -- Edwards Signature — módulos de entrada/monitor
  ('edwards','sigact1', 'SDAI.MODULOS.ENTRADA'),
  ('edwards','sigact2', 'SDAI.MODULOS.ENTRADA'),
  ('edwards','sigamm1', 'SDAI.MODULOS.ENTRADA'),
  -- Edwards Signature — módulos de saída/controle (função operacional)
  ('edwards','sigacc1', 'SDAI.MODULOS.SAIDA'),
  ('edwards','sigacc2', 'SDAI.MODULOS.SAIDA'),
  -- Edwards Signature — isoladores
  ('edwards','sigaim',  'SDAI.MODULOS.ISOLADOR'),
  ('edwards','sigaim2', 'SDAI.MODULOS.ISOLADOR'),
  -- Módulo de zona (Intelbras / Tecnohold)
  ('intelbras','mdz521v2','SDAI.MODULOS.ZONA'),
  ('tecnohold','mcb485th','SDAI.MODULOS.ZONA'),
  -- Acionadores manuais endereçáveis (IP é atributo, não nó)
  ('intelbras','ame566',   'SDAI.ACIONADORES.END'),
  ('tecnohold','amet12ip67','SDAI.ACIONADORES.END')
) as m(brandnorm, modelnorm, code)
join public.catalog_taxonomy_nodes n on n.code = m.code
where i.classification_status = 'REVISAR'
  and public.fireowl_catalog_norm(i.category) = 'sdai'
  and public.fireowl_catalog_norm(i.brand) = m.brandnorm
  and public.fireowl_catalog_norm(coalesce(i.model, i.code)) = m.modelnorm;

-- FAP-520 e quaisquer outros REVISAR sem evidência permanecem intactos.
