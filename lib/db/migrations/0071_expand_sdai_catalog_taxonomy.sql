-- =====================================================================
-- 0071_expand_sdai_catalog_taxonomy
-- Expande a taxonomia canônica SDAI com base nos PRODUTOS REAIS de produção
-- (Intelbras / Tecnohold / Morey) e classifica deterministicamente os itens
-- SDAI ainda NAO_CLASSIFICADO com ALTA confiança.
--
-- ADITIVA. NÃO edita/reaplica 0070 (imutável). NÃO toca saldo, preço, custo,
-- fornecedor, model, description nem nomes comerciais. Só cria nós/aliases e
-- escreve canonical_taxonomy_id/classification_status.
--
-- Idempotente: create if not exists / on conflict do nothing; o backfill só
-- toca linhas SDAI ainda 'NAO_CLASSIFICADO' — nunca sobrescreve CLASSIFICADO
-- nem REVISAR, nem uma classificação manual anterior.
--
-- Regra de confiança: ALTA → CLASSIFICADO; MÉDIA/BAIXA → REVISAR;
-- sem dado suficiente → permanece NAO_CLASSIFICADO. Sem inferência agressiva.
-- Os 20 REVISAR históricos (Edwards/Bosch) NÃO são promovidos aqui.
--
-- Rode no SQL Editor do Supabase. Depende de 0070 (nós/fireowl_catalog_norm).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Novos nós (somente ramos com produto real justificando).
--    Multicritério NÃO é criado nesta passada (nenhum produto real o exige).
-- ---------------------------------------------------------------------

-- Famílias novas (parent NULL)
insert into public.catalog_taxonomy_nodes (area, parent_id, node_type, code, name, sort_order) values
  ('SDAI', null, 'FAMILY', 'SDAI.SINALIZADORES', 'Sirenes / Sinalizadores', 55),
  ('SDAI', null, 'FAMILY', 'SDAI.ALIMENTACAO',  'Fontes / Alimentação',    70),
  ('SDAI', null, 'FAMILY', 'SDAI.BATERIAS',     'Baterias',                80),
  ('SDAI', null, 'FAMILY', 'SDAI.EMERGENCIA',   'Iluminação de Emergência', 90)
on conflict (code) do nothing;

-- Filhos de nós existentes (0070) e das novas famílias
insert into public.catalog_taxonomy_nodes (area, parent_id, node_type, code, name, sort_order)
select v.area, p.id, v.node_type, v.code, v.name, v.sort_order
from (values
  ('SDAI','SDAI.CENTRAIS',     'GROUP',      'SDAI.CENTRAIS.COMPONENTES',   'Componentes / Peças', 20),
  ('SDAI','SDAI.DETECTORES',   'TYPE',       'SDAI.DETECTORES.GAS',         'Gás',                 40),
  ('SDAI','SDAI.DETECTORES',   'TYPE',       'SDAI.DETECTORES.LINEAR',      'Linear / Feixe',      50),
  ('SDAI','SDAI.SINALIZADORES','TECHNOLOGY', 'SDAI.SINALIZADORES.END',      'Endereçável',         10),
  ('SDAI','SDAI.SINALIZADORES','TECHNOLOGY', 'SDAI.SINALIZADORES.CONV',     'Convencional',        20),
  ('SDAI','SDAI.ALIMENTACAO',  'TYPE',       'SDAI.ALIMENTACAO.AUXILIAR',   'Fonte Auxiliar',      10),
  ('SDAI','SDAI.BATERIAS',     'TYPE',       'SDAI.BATERIAS.SELADA',        'Selada / VRLA',       10),
  ('SDAI','SDAI.EMERGENCIA',   'TYPE',       'SDAI.EMERGENCIA.LUMINARIAS',  'Luminárias',          10)
) as v(area, parent_code, node_type, code, name, sort_order)
join public.catalog_taxonomy_nodes p on p.code = v.parent_code
on conflict (code) do nothing;

-- Netos: subtipos de Componentes / Peças
insert into public.catalog_taxonomy_nodes (area, parent_id, node_type, code, name, sort_order)
select v.area, p.id, v.node_type, v.code, v.name, v.sort_order
from (values
  ('SDAI','SDAI.CENTRAIS.COMPONENTES','TYPE','SDAI.CENTRAIS.COMPONENTES.COMUNICACAO','Comunicação / Rede',          10),
  ('SDAI','SDAI.CENTRAIS.COMPONENTES','TYPE','SDAI.CENTRAIS.COMPONENTES.PROGRAMACAO','Programação / Endereçamento', 20)
) as v(area, parent_code, node_type, code, name, sort_order)
join public.catalog_taxonomy_nodes p on p.code = v.parent_code
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- 2) Aliases novos (normalizados; on conflict não duplica).
-- ---------------------------------------------------------------------
insert into public.catalog_taxonomy_aliases (taxonomy_node_id, alias, normalized_alias)
select n.id, a.alias, public.fireowl_catalog_norm(a.alias)
from (values
  ('SDAI.SINALIZADORES', 'Sirene'),
  ('SDAI.SINALIZADORES', 'Sirene Audiovisual'),
  ('SDAI.SINALIZADORES', 'Sinalizador'),
  ('SDAI.SINALIZADORES', 'Sinalizador Audiovisual'),
  ('SDAI.SINALIZADORES', 'Strobe'),
  ('SDAI.SINALIZADORES', 'Sounder'),
  ('SDAI.SINALIZADORES', 'Beacon'),
  ('SDAI.ALIMENTACAO.AUXILIAR', 'Fonte Auxiliar'),
  ('SDAI.ALIMENTACAO.AUXILIAR', 'Fonte de Alimentação Auxiliar'),
  ('SDAI.ALIMENTACAO.AUXILIAR', 'Fonte Nobreak'),
  ('SDAI.ALIMENTACAO.AUXILIAR', 'QFA'),
  ('SDAI.ALIMENTACAO.AUXILIAR', 'QFAE'),
  ('SDAI.BATERIAS', 'Bateria'),
  ('SDAI.BATERIAS.SELADA', 'Bateria Selada'),
  ('SDAI.BATERIAS.SELADA', 'Bateria Chumbo Ácida'),
  ('SDAI.BATERIAS.SELADA', 'VRLA'),
  ('SDAI.BATERIAS.SELADA', 'Chumbo Ácido'),
  ('SDAI.DETECTORES.GAS', 'Detector de Gás'),
  ('SDAI.DETECTORES.GAS', 'Detector Gás'),
  ('SDAI.DETECTORES.GAS', 'Sensor de Gás'),
  ('SDAI.DETECTORES.LINEAR', 'Detector Linear'),
  ('SDAI.DETECTORES.LINEAR', 'Detector de Feixe'),
  ('SDAI.DETECTORES.LINEAR', 'Beam Detector'),
  ('SDAI.DETECTORES.LINEAR', 'Barreira Linear'),
  ('SDAI.CENTRAIS.COMPONENTES.COMUNICACAO', 'Placa de Rede'),
  ('SDAI.CENTRAIS.COMPONENTES.COMUNICACAO', 'Placa de Comunicação'),
  ('SDAI.CENTRAIS.COMPONENTES.COMUNICACAO', 'Gateway'),
  ('SDAI.CENTRAIS.COMPONENTES.COMUNICACAO', 'Módulo de Comunicação'),
  ('SDAI.CENTRAIS.COMPONENTES.PROGRAMACAO', 'Programador de Endereços'),
  ('SDAI.CENTRAIS.COMPONENTES.PROGRAMACAO', 'Programador de Endereço'),
  ('SDAI.CENTRAIS.COMPONENTES', 'Componente de Central'),
  ('SDAI.CENTRAIS.COMPONENTES', 'Peça de Central'),
  ('SDAI.EMERGENCIA.LUMINARIAS', 'Luminária de Emergência'),
  ('SDAI.EMERGENCIA.LUMINARIAS', 'Iluminação de Emergência'),
  ('SDAI.EMERGENCIA.LUMINARIAS', 'Bloco Autônomo')
) as a(code, alias)
join public.catalog_taxonomy_nodes n on n.code = a.code
on conflict (normalized_alias) do nothing;

-- =====================================================================
-- 3) BACKFILL — só SDAI ainda NAO_CLASSIFICADO. Nunca sobrescreve
--    CLASSIFICADO/REVISAR nem classificação manual. Defensivo/idempotente.
-- =====================================================================

-- ---- ALTA confiança (subcategoria declara o suficiente) → CLASSIFICADO ----
update public.inventory_items i
set canonical_taxonomy_id = n.id, classification_status = 'CLASSIFICADO'
from (values
  ('centraldealarmeenderecavel',                 'SDAI.CENTRAIS.EQUIP.END'),
  ('centraldealarmeconvencional',                'SDAI.CENTRAIS.EQUIP.CONV'),
  ('placaderedecomunicacaointegracao',           'SDAI.CENTRAIS.COMPONENTES.COMUNICACAO'),
  ('programadordeenderecos',                     'SDAI.CENTRAIS.COMPONENTES.PROGRAMACAO'),
  ('painelrepetidorsinoticodisplayremoto',       'SDAI.ANUNCIADORES'),
  ('detectordefumacaenderecaveloptico',          'SDAI.DETECTORES.FUMACA.END'),
  ('detectordetemperaturatermovelocimetricofixo','SDAI.DETECTORES.TEMP'),
  ('detectordegascoglpamonia',                   'SDAI.DETECTORES.GAS'),
  ('detectorlineardefumacafeixebarreira',        'SDAI.DETECTORES.LINEAR'),
  ('moduloderelesaida',                          'SDAI.MODULOS.RELE'),
  ('modulomonitorentrada',                       'SDAI.MODULOS.ENTRADA'),
  ('moduloisoladordecurtocircuito',              'SDAI.MODULOS.ISOLADOR'),
  ('acionadormanualenderecavelrearmavel',        'SDAI.ACIONADORES.END'),
  ('sireneaudiovisualenderecavelstrobe',         'SDAI.SINALIZADORES.END'),
  ('sireneaudiovisualconvencional',              'SDAI.SINALIZADORES.CONV'),
  ('bateriaseladavrlachumboacido',               'SDAI.BATERIAS.SELADA'),
  ('luminariadeemergencia',                      'SDAI.EMERGENCIA.LUMINARIAS')
) as m(subnorm, code)
join public.catalog_taxonomy_nodes n on n.code = m.code
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'sdai'
  and public.fireowl_catalog_norm(i.subcategory) = m.subnorm;

-- Fonte auxiliar de verdade → CLASSIFICADO (exclui "Placa Fonte ...")
update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code = 'SDAI.ALIMENTACAO.AUXILIAR'),
    classification_status = 'CLASSIFICADO'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'sdai'
  and public.fireowl_catalog_norm(i.subcategory) = 'fontedealimentacaoauxiliarsdai'
  and public.fireowl_catalog_norm(coalesce(i.model, i.code)) not like '%placafonte%';

-- ---- MÉDIA/BAIXA confiança → REVISAR (aponta para a família certa) ----
-- "Placa Fonte ..." pode ser fonte interna da central, não fonte auxiliar
update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code = 'SDAI.ALIMENTACAO'),
    classification_status = 'REVISAR'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'sdai'
  and public.fireowl_catalog_norm(i.subcategory) = 'fontedealimentacaoauxiliarsdai';

-- Acionador "à prova de tempo (IP66)": tecnologia (End/Conv) não declarada
update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code = 'SDAI.ACIONADORES'),
    classification_status = 'REVISAR'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'sdai'
  and public.fireowl_catalog_norm(i.subcategory) = 'acionadormanualaprovadetempoip66';

-- Módulo "endereçador de zona": função de interface incerta (monitor vs interface)
update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code = 'SDAI.MODULOS'),
    classification_status = 'REVISAR'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'sdai'
  and public.fireowl_catalog_norm(i.subcategory) = 'moduloenderecadordezonaconvencional';

-- Itens SDAI sem subcategoria/dado suficiente permanecem NAO_CLASSIFICADO (default).
-- Os 20 REVISAR históricos (Edwards/Bosch) NÃO são tocados (guard NAO_CLASSIFICADO).
