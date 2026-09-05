-- =====================================================================
-- 0104_canonical_classification_backfill
-- SANEAMENTO DIRIGIDO da classificação canônica (SDAI + CFTV).
--
-- Consolida o backfill determinístico de 0070/0071/0072 e o REAPLICA de forma
-- idempotente para alcançar itens que entraram DEPOIS daqueles backfills de
-- uma passada só (importações/cadastros novos ainda 'NAO_CLASSIFICADO').
--
-- SEGURANÇA:
--   • Só toca linhas com classification_status = 'NAO_CLASSIFICADO' — nunca
--     sobrescreve CLASSIFICADO/REVISAR nem decisão humana.
--   • Casa por SUBCATEGORIA EXATA normalizada (fireowl_catalog_norm), por ÁREA,
--     via mapa explícito (VALUES) + join no `code` estável do nó. SEM LIKE de
--     matching, SEM UPDATE amplo, SEM cruzar área.
--   • Escreve APENAS canonical_taxonomy_id + classification_status. NÃO altera
--     cost_price/sale_price/quantity/supplier/brand/model/name/code/unit.
--   • Espelha lib/canonicalClassification.ts (mapa único de verdade).
-- Correspondência inequívoca → CLASSIFICADO; família sabida com tipo/tecnologia
-- ambíguos → REVISAR; desconhecida → permanece NAO_CLASSIFICADO (não inventa nó).
-- ALARME/BMS/CONTROLE_ACESSO não têm nós nesta fase — não são tocados.
--
-- Requer 0070/0071/0072 (nós + fireowl_catalog_norm). NÃO edita migrações
-- aplicadas. Próximo número real após 0103. Idempotente (reexecução = no-op).
--
-- AUDITORIA — contagem ANTES (read-only):
--   select coalesce(nullif(upper(trim(category)),''),'SEM ÁREA') area,
--          classification_status, count(*)
--     from public.inventory_items group by 1,2 order by 1,2;
-- =====================================================================

-- 1) Precisos (CLASSIFICADO) — SDAI + CFTV. Fonte Auxiliar tratada à parte.
update public.inventory_items i
set canonical_taxonomy_id = n.id, classification_status = 'CLASSIFICADO'
from (values
  ('sdai','centraldealarmeenderecavel',                 'SDAI.CENTRAIS.EQUIP.END'),
  ('sdai','centraldealarmeconvencional',                'SDAI.CENTRAIS.EQUIP.CONV'),
  ('sdai','placaderedecomunicacaointegracao',           'SDAI.CENTRAIS.COMPONENTES.COMUNICACAO'),
  ('sdai','programadordeenderecos',                     'SDAI.CENTRAIS.COMPONENTES.PROGRAMACAO'),
  ('sdai','painelrepetidorsinoticodisplayremoto',       'SDAI.ANUNCIADORES'),
  ('sdai','detectordefumacaenderecaveloptico',          'SDAI.DETECTORES.FUMACA.END'),
  ('sdai','detectordetemperaturatermovelocimetricofixo','SDAI.DETECTORES.TEMP'),
  ('sdai','detectordegascoglpamonia',                   'SDAI.DETECTORES.GAS'),
  ('sdai','detectorlineardefumacafeixebarreira',        'SDAI.DETECTORES.LINEAR'),
  ('sdai','moduloderelesaida',                          'SDAI.MODULOS.RELE'),
  ('sdai','modulomonitorentrada',                       'SDAI.MODULOS.ENTRADA'),
  ('sdai','moduloisoladordecurtocircuito',              'SDAI.MODULOS.ISOLADOR'),
  ('sdai','acionadormanualenderecavelrearmavel',        'SDAI.ACIONADORES.END'),
  ('sdai','sireneaudiovisualenderecavelstrobe',         'SDAI.SINALIZADORES.END'),
  ('sdai','sireneaudiovisualconvencional',              'SDAI.SINALIZADORES.CONV'),
  ('sdai','bateriaseladavrlachumboacido',               'SDAI.BATERIAS.SELADA'),
  ('sdai','luminariadeemergencia',                      'SDAI.EMERGENCIA.LUMINARIAS'),
  ('cftv','camerahdcvi',                                'CFTV.CAMERAS.HDCVI'),
  ('cftv','gravadornvr',                                'CFTV.GRAVADORES.NVR'),
  ('cftv','dvrgravadorhibrido',                         'CFTV.GRAVADORES.DVR_HIBRIDO'),
  ('cftv','cameraip',                                   'CFTV.CAMERAS.IP'),
  ('cftv','cameraipbullet',                             'CFTV.CAMERAS.IP')
) as m(areanorm, subnorm, code)
join public.catalog_taxonomy_nodes n on n.code = m.code
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = m.areanorm
  and public.fireowl_catalog_norm(i.subcategory) = m.subnorm;

-- 2) Fonte auxiliar de verdade → CLASSIFICADO (exclui "Placa Fonte" da central).
update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code = 'SDAI.ALIMENTACAO.AUXILIAR'),
    classification_status = 'CLASSIFICADO'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'sdai'
  and public.fireowl_catalog_norm(i.subcategory) = 'fontedealimentacaoauxiliarsdai'
  and public.fireowl_catalog_norm(coalesce(i.model, i.code)) not like '%placafonte%';

-- 3) Família sabida, tipo/tecnologia ambíguos → REVISAR (nunca misclassifica).
update public.inventory_items i
set canonical_taxonomy_id = n.id, classification_status = 'REVISAR'
from (values
  ('sdai','fontedealimentacaoauxiliarsdai',      'SDAI.ALIMENTACAO'),   -- inclui "Placa Fonte"
  ('sdai','acionadormanualaprovadetempoip66',    'SDAI.ACIONADORES'),
  ('sdai','moduloenderecadordezonaconvencional', 'SDAI.MODULOS'),
  ('sdai','central',                             'SDAI.CENTRAIS.EQUIP'),
  ('sdai','detector',                            'SDAI.DETECTORES'),
  ('sdai','modulo',                              'SDAI.MODULOS'),
  ('sdai','acionadormanual',                     'SDAI.ACIONADORES')
) as m(areanorm, subnorm, code)
join public.catalog_taxonomy_nodes n on n.code = m.code
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = m.areanorm
  and public.fireowl_catalog_norm(i.subcategory) = m.subnorm;

-- =====================================================================
-- AUDITORIA — contagem DEPOIS + itens que permanecem NAO_CLASSIFICADO
-- (read-only, rode após aplicar):
--   select coalesce(nullif(upper(trim(category)),''),'SEM ÁREA') area,
--          classification_status, count(*)
--     from public.inventory_items group by 1,2 order by 1,2;
--
--   -- Subcategorias sem nó canônico (candidatas a nova taxonomia / revisão):
--   select upper(trim(category)) area, subcategory, count(*)
--     from public.inventory_items
--    where classification_status = 'NAO_CLASSIFICADO'
--      and coalesce(trim(subcategory),'') <> ''
--    group by 1,2 order by 1,3 desc;
-- =====================================================================
