-- REVISÃO DE DADOS MESTRES — catálogo Tecnohold (SDAI).
--
-- As 6 centrais endereçáveis estavam com MODELO SINTÉTICO ("CIE-E065/125/250"),
-- que NÃO é o nome comercial oficial. A linha oficial dessas centrais é
-- "Avalon Evolution" (65/125/250 endereços, gabinete ABS/Metálica). Os SKUs reais
-- do fabricante já estavam corretos em `code` (PAIE485TH…E.00/.10). Esta migration
-- SANEIA os inventory_items já semeados (proposta 059024): corrige nome/modelo/
-- linha e grava a TECNOLOGIA estruturada (autopreenchimento no Levantamento).
--
-- SEGURANÇA:
--   • UPDATE por SKU EXATO (`code`) + brand='Tecnohold'. Sem LIKE, sem UPDATE
--     massivo, sem tocar OUTRAS marcas.
--   • NÃO altera dados comerciais (cost_price/sale_price/quantity/supplier) — §19.
--     Só name/model/product_line/system_type/technologies (identidade técnica).
--   • Idempotente (reexecutar grava os mesmos valores). No-op se o SKU não existir.
-- Requer 0002 (inventory_items) + 0045 (system_type/technologies/product_line).
-- NÃO edita migrações aplicadas. Próximo número real após 0101.
--
-- AUDITORIA (rode antes, read-only):
--   select id, code, name, model, product_line, system_type, technologies, quantity, cost_price
--     from public.inventory_items where brand = 'Tecnohold' order by subcategory, code;

-- 1) Centrais Avalon Evolution (ABS) --------------------------------------------
update public.inventory_items set name='Central SDAI Endereçável 65 endereços — Avalon Evolution (ABS, s/ bateria)',  model='Avalon Evolution 65 (ABS)',  product_line='Avalon Evolution', system_type='Endereçável', technologies=array['Endereçável'] where brand='Tecnohold' and code='PAIE485TH65E.00';
update public.inventory_items set name='Central SDAI Endereçável 125 endereços — Avalon Evolution (ABS, s/ bateria)', model='Avalon Evolution 125 (ABS)', product_line='Avalon Evolution', system_type='Endereçável', technologies=array['Endereçável'] where brand='Tecnohold' and code='PAIE485TH125E.00';
update public.inventory_items set name='Central SDAI Endereçável 250 endereços — Avalon Evolution (ABS, s/ bateria)', model='Avalon Evolution 250 (ABS)', product_line='Avalon Evolution', system_type='Endereçável', technologies=array['Endereçável'] where brand='Tecnohold' and code='PAIE485TH250E.00';
-- 2) Centrais Avalon Evolution (Metálica) --------------------------------------
update public.inventory_items set name='Central SDAI Endereçável 65 endereços — Avalon Evolution (Metálica, s/ bateria)',  model='Avalon Evolution 65 (Metálica)',  product_line='Avalon Evolution', system_type='Endereçável', technologies=array['Endereçável'] where brand='Tecnohold' and code='PAIE485TH65E.10';
update public.inventory_items set name='Central SDAI Endereçável 125 endereços — Avalon Evolution (Metálica, s/ bateria)', model='Avalon Evolution 125 (Metálica)', product_line='Avalon Evolution', system_type='Endereçável', technologies=array['Endereçável'] where brand='Tecnohold' and code='PAIE485TH125E.10';
update public.inventory_items set name='Central SDAI Endereçável 250 endereços — Avalon Evolution (Metálica, s/ bateria)', model='Avalon Evolution 250 (Metálica)', product_line='Avalon Evolution', system_type='Endereçável', technologies=array['Endereçável'] where brand='Tecnohold' and code='PAIE485TH250E.10';

-- 3) Tecnologia ENDEREÇÁVEL dos demais itens (só onde ainda não definida) -------
update public.inventory_items
   set system_type = coalesce(system_type, 'Endereçável'),
       technologies = case when technologies is null or array_length(technologies, 1) is null then array['Endereçável'] else technologies end
 where brand = 'Tecnohold'
   and code = any (array[
     'DFE485THP1B02','DTE485THP1B02','MCS485THP2B03','MCB485TH1LP2B03','MIRE485THP2B03','MRE485THP1B03',
     'SAVE485THLEDP1B05','SAVE485THLEDP2B05','SAVE485THLEDP4B05','AME485THP1B05','AME485THT12P2B05','AME485THT12P4B05','QFAE485THP1B08'
   ]);

-- 4) Detector linear = CONVENCIONAL (§7) ---------------------------------------
update public.inventory_items
   set system_type = coalesce(system_type, 'Convencional'),
       technologies = case when technologies is null or array_length(technologies, 1) is null then array['Convencional'] else technologies end
 where brand = 'Tecnohold' and code = 'DTLIN01';
