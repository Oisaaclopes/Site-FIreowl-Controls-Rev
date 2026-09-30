-- =====================================================================
-- 0115_cftv_perifericos_taxonomy
-- Amplia a taxonomia canônica CFTV além de Câmeras/Gravadores: nova família
-- "Periféricos e Componentes" com grupos Armazenamento (HD/SSD/cartão),
-- Energia (Nobreak/fonte/bateria/DPS), Rede, Cabos, Conectores/Balun,
-- Acessórios de instalação e Monitores/Visualização.
--
-- ADITIVA. NÃO edita migrations anteriores. NÃO toca saldo, preço, custo,
-- fornecedor, model, description nem nomes. Só cria nós/aliases e classifica
-- itens CFTV ainda 'NAO_CLASSIFICADO' cuja subcategoria legada é exatamente
-- um alias dos novos nós (ALTA confiança). Nunca sobrescreve CLASSIFICADO,
-- REVISAR nem classificação manual.
--
-- Idempotente: on conflict do nothing + guard NAO_CLASSIFICADO.
-- Rode no SQL Editor do Supabase. Depende de 0070 (tabelas/fireowl_catalog_norm).
-- (0114 reservada para o Ponto.)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Família nova (parent NULL)
-- ---------------------------------------------------------------------
insert into public.catalog_taxonomy_nodes (area, parent_id, node_type, code, name, sort_order) values
  ('CFTV', null, 'FAMILY', 'CFTV.PERIFERICOS', 'Periféricos e Componentes', 30)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- 2) Grupos da família
-- ---------------------------------------------------------------------
insert into public.catalog_taxonomy_nodes (area, parent_id, node_type, code, name, sort_order)
select v.area, p.id, v.node_type, v.code, v.name, v.sort_order
from (values
  ('CFTV','CFTV.PERIFERICOS','GROUP','CFTV.PERIFERICOS.ARMAZENAMENTO','Armazenamento',            10),
  ('CFTV','CFTV.PERIFERICOS','GROUP','CFTV.PERIFERICOS.ENERGIA',      'Energia',                  20),
  ('CFTV','CFTV.PERIFERICOS','GROUP','CFTV.PERIFERICOS.REDE',         'Rede',                     30),
  ('CFTV','CFTV.PERIFERICOS','GROUP','CFTV.PERIFERICOS.CABOS',        'Cabos',                    40),
  ('CFTV','CFTV.PERIFERICOS','GROUP','CFTV.PERIFERICOS.CONECTORES',   'Conectores e Balun',       50),
  ('CFTV','CFTV.PERIFERICOS','GROUP','CFTV.PERIFERICOS.ACESSORIOS',   'Acessórios e Instalação',  60),
  ('CFTV','CFTV.PERIFERICOS','GROUP','CFTV.PERIFERICOS.VISUALIZACAO', 'Monitores e Visualização', 70)
) as v(area, parent_code, node_type, code, name, sort_order)
join public.catalog_taxonomy_nodes p on p.code = v.parent_code
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- 3) Tipos (folhas)
-- ---------------------------------------------------------------------
insert into public.catalog_taxonomy_nodes (area, parent_id, node_type, code, name, sort_order)
select v.area, p.id, v.node_type, v.code, v.name, v.sort_order
from (values
  ('CFTV','CFTV.PERIFERICOS.ARMAZENAMENTO','TYPE','CFTV.PERIFERICOS.ARMAZENAMENTO.HD',     'Disco Rígido (HD)',              10),
  ('CFTV','CFTV.PERIFERICOS.ARMAZENAMENTO','TYPE','CFTV.PERIFERICOS.ARMAZENAMENTO.SSD',    'SSD',                            20),
  ('CFTV','CFTV.PERIFERICOS.ARMAZENAMENTO','TYPE','CFTV.PERIFERICOS.ARMAZENAMENTO.CARTAO', 'Cartão de Memória',              30),
  ('CFTV','CFTV.PERIFERICOS.ENERGIA',      'TYPE','CFTV.PERIFERICOS.ENERGIA.NOBREAK',      'Nobreak',                        10),
  ('CFTV','CFTV.PERIFERICOS.ENERGIA',      'TYPE','CFTV.PERIFERICOS.ENERGIA.FONTE',        'Fonte de Alimentação',           20),
  ('CFTV','CFTV.PERIFERICOS.ENERGIA',      'TYPE','CFTV.PERIFERICOS.ENERGIA.BATERIA',      'Bateria',                        30),
  ('CFTV','CFTV.PERIFERICOS.ENERGIA',      'TYPE','CFTV.PERIFERICOS.ENERGIA.PROTECAO',     'Protetor de Surto / DPS',        40),
  ('CFTV','CFTV.PERIFERICOS.REDE',         'TYPE','CFTV.PERIFERICOS.REDE.SWITCH_POE',      'Switch PoE',                     10),
  ('CFTV','CFTV.PERIFERICOS.REDE',         'TYPE','CFTV.PERIFERICOS.REDE.SWITCH',          'Switch',                         20),
  ('CFTV','CFTV.PERIFERICOS.REDE',         'TYPE','CFTV.PERIFERICOS.REDE.POE',             'Injetor / Extensor PoE',         30),
  ('CFTV','CFTV.PERIFERICOS.REDE',         'TYPE','CFTV.PERIFERICOS.REDE.ROTEADOR',        'Roteador / Access Point',        40),
  ('CFTV','CFTV.PERIFERICOS.REDE',         'TYPE','CFTV.PERIFERICOS.REDE.CONVERSOR',       'Conversor de Mídia',             50),
  ('CFTV','CFTV.PERIFERICOS.CABOS',        'TYPE','CFTV.PERIFERICOS.CABOS.UTP',            'Cabo UTP / Rede',                10),
  ('CFTV','CFTV.PERIFERICOS.CABOS',        'TYPE','CFTV.PERIFERICOS.CABOS.COAXIAL',        'Cabo Coaxial',                   20),
  ('CFTV','CFTV.PERIFERICOS.CABOS',        'TYPE','CFTV.PERIFERICOS.CABOS.FIBRA',          'Fibra Óptica',                   30),
  ('CFTV','CFTV.PERIFERICOS.CABOS',        'TYPE','CFTV.PERIFERICOS.CABOS.ENERGIA',        'Cabo de Energia / PP',           40),
  ('CFTV','CFTV.PERIFERICOS.CABOS',        'TYPE','CFTV.PERIFERICOS.CABOS.VIDEO',          'Cabo HDMI / VGA',                50),
  ('CFTV','CFTV.PERIFERICOS.CONECTORES',   'TYPE','CFTV.PERIFERICOS.CONECTORES.CONECTOR',  'Conectores (BNC / P4 / RJ45)',   10),
  ('CFTV','CFTV.PERIFERICOS.CONECTORES',   'TYPE','CFTV.PERIFERICOS.CONECTORES.BALUN',     'Balun',                          20),
  ('CFTV','CFTV.PERIFERICOS.ACESSORIOS',   'TYPE','CFTV.PERIFERICOS.ACESSORIOS.SUPORTE',   'Suportes',                       10),
  ('CFTV','CFTV.PERIFERICOS.ACESSORIOS',   'TYPE','CFTV.PERIFERICOS.ACESSORIOS.CAIXA',     'Caixas de Passagem / Herméticas',20),
  ('CFTV','CFTV.PERIFERICOS.ACESSORIOS',   'TYPE','CFTV.PERIFERICOS.ACESSORIOS.RACK',      'Racks',                          30),
  ('CFTV','CFTV.PERIFERICOS.VISUALIZACAO', 'TYPE','CFTV.PERIFERICOS.VISUALIZACAO.MONITOR', 'Monitor',                        10),
  ('CFTV','CFTV.PERIFERICOS.VISUALIZACAO', 'TYPE','CFTV.PERIFERICOS.VISUALIZACAO.CONTROLADORA','Mesa Controladora / Joystick', 20)
) as v(area, parent_code, node_type, code, name, sort_order)
join public.catalog_taxonomy_nodes p on p.code = v.parent_code
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- 4) Aliases (espelho de lib/catalogTaxonomy.ts). Sem colisão com os
--    existentes (ex.: "Monitor" continua = módulo monitor SDAI;
--    "Bateria"/"Fonte Nobreak" continuam SDAI).
-- ---------------------------------------------------------------------
insert into public.catalog_taxonomy_aliases (taxonomy_node_id, alias, normalized_alias)
select n.id, a.alias, public.fireowl_catalog_norm(a.alias)
from (values
  ('CFTV.PERIFERICOS', 'Periférico'),
  ('CFTV.PERIFERICOS', 'Periféricos'),
  ('CFTV.PERIFERICOS', 'Acessório CFTV'),
  ('CFTV.PERIFERICOS', 'Componente CFTV'),
  ('CFTV.PERIFERICOS.ARMAZENAMENTO.HD', 'HD'),
  ('CFTV.PERIFERICOS.ARMAZENAMENTO.HD', 'HDD'),
  ('CFTV.PERIFERICOS.ARMAZENAMENTO.HD', 'Disco Rígido'),
  ('CFTV.PERIFERICOS.ARMAZENAMENTO.HD', 'HD Surveillance'),
  ('CFTV.PERIFERICOS.ARMAZENAMENTO.HD', 'HD para CFTV'),
  ('CFTV.PERIFERICOS.ARMAZENAMENTO.SSD', 'SSD'),
  ('CFTV.PERIFERICOS.ARMAZENAMENTO.CARTAO', 'Cartão de Memória'),
  ('CFTV.PERIFERICOS.ARMAZENAMENTO.CARTAO', 'Cartão microSD'),
  ('CFTV.PERIFERICOS.ARMAZENAMENTO.CARTAO', 'MicroSD'),
  ('CFTV.PERIFERICOS.ARMAZENAMENTO.CARTAO', 'Cartão SD'),
  ('CFTV.PERIFERICOS.ENERGIA.NOBREAK', 'Nobreak'),
  ('CFTV.PERIFERICOS.ENERGIA.NOBREAK', 'UPS'),
  ('CFTV.PERIFERICOS.ENERGIA.FONTE', 'Fonte'),
  ('CFTV.PERIFERICOS.ENERGIA.FONTE', 'Fonte 12V'),
  ('CFTV.PERIFERICOS.ENERGIA.FONTE', 'Fonte Colmeia'),
  ('CFTV.PERIFERICOS.ENERGIA.FONTE', 'Fonte Chaveada'),
  ('CFTV.PERIFERICOS.ENERGIA.FONTE', 'Fonte para CFTV'),
  ('CFTV.PERIFERICOS.ENERGIA.BATERIA', 'Bateria para Nobreak'),
  ('CFTV.PERIFERICOS.ENERGIA.PROTECAO', 'DPS'),
  ('CFTV.PERIFERICOS.ENERGIA.PROTECAO', 'Protetor de Surto'),
  ('CFTV.PERIFERICOS.ENERGIA.PROTECAO', 'Protetor de Vídeo'),
  ('CFTV.PERIFERICOS.REDE.SWITCH_POE', 'Switch PoE'),
  ('CFTV.PERIFERICOS.REDE.SWITCH', 'Switch'),
  ('CFTV.PERIFERICOS.REDE.SWITCH', 'Switch de Rede'),
  ('CFTV.PERIFERICOS.REDE.POE', 'Injetor PoE'),
  ('CFTV.PERIFERICOS.REDE.POE', 'Extensor PoE'),
  ('CFTV.PERIFERICOS.REDE.POE', 'Splitter PoE'),
  ('CFTV.PERIFERICOS.REDE.ROTEADOR', 'Roteador'),
  ('CFTV.PERIFERICOS.REDE.ROTEADOR', 'Router'),
  ('CFTV.PERIFERICOS.REDE.ROTEADOR', 'Access Point'),
  ('CFTV.PERIFERICOS.REDE.CONVERSOR', 'Conversor de Mídia'),
  ('CFTV.PERIFERICOS.REDE.CONVERSOR', 'Media Converter'),
  ('CFTV.PERIFERICOS.CABOS.UTP', 'Cabo UTP'),
  ('CFTV.PERIFERICOS.CABOS.UTP', 'Cabo de Rede'),
  ('CFTV.PERIFERICOS.CABOS.UTP', 'Cabo CAT5e'),
  ('CFTV.PERIFERICOS.CABOS.UTP', 'Cabo CAT6'),
  ('CFTV.PERIFERICOS.CABOS.COAXIAL', 'Cabo Coaxial'),
  ('CFTV.PERIFERICOS.CABOS.COAXIAL', 'Coaxial'),
  ('CFTV.PERIFERICOS.CABOS.COAXIAL', 'Cabo Coaxial Bipolar'),
  ('CFTV.PERIFERICOS.CABOS.FIBRA', 'Fibra Óptica'),
  ('CFTV.PERIFERICOS.CABOS.FIBRA', 'Cabo de Fibra'),
  ('CFTV.PERIFERICOS.CABOS.FIBRA', 'Cordão Óptico'),
  ('CFTV.PERIFERICOS.CABOS.ENERGIA', 'Cabo PP'),
  ('CFTV.PERIFERICOS.CABOS.ENERGIA', 'Cabo de Energia'),
  ('CFTV.PERIFERICOS.CABOS.VIDEO', 'Cabo HDMI'),
  ('CFTV.PERIFERICOS.CABOS.VIDEO', 'Cabo VGA'),
  ('CFTV.PERIFERICOS.CONECTORES.CONECTOR', 'Conector'),
  ('CFTV.PERIFERICOS.CONECTORES.CONECTOR', 'Conector BNC'),
  ('CFTV.PERIFERICOS.CONECTORES.CONECTOR', 'Conector P4'),
  ('CFTV.PERIFERICOS.CONECTORES.CONECTOR', 'Conector RJ45'),
  ('CFTV.PERIFERICOS.CONECTORES.CONECTOR', 'BNC'),
  ('CFTV.PERIFERICOS.CONECTORES.CONECTOR', 'RJ45'),
  ('CFTV.PERIFERICOS.CONECTORES.BALUN', 'Balun'),
  ('CFTV.PERIFERICOS.CONECTORES.BALUN', 'Video Balun'),
  ('CFTV.PERIFERICOS.ACESSORIOS.SUPORTE', 'Suporte'),
  ('CFTV.PERIFERICOS.ACESSORIOS.SUPORTE', 'Suporte para Câmera'),
  ('CFTV.PERIFERICOS.ACESSORIOS.CAIXA', 'Caixa de Passagem'),
  ('CFTV.PERIFERICOS.ACESSORIOS.CAIXA', 'Caixa Hermética'),
  ('CFTV.PERIFERICOS.ACESSORIOS.RACK', 'Rack'),
  ('CFTV.PERIFERICOS.ACESSORIOS.RACK', 'Rack de Parede'),
  ('CFTV.PERIFERICOS.VISUALIZACAO.MONITOR', 'Monitor de Vídeo'),
  ('CFTV.PERIFERICOS.VISUALIZACAO.MONITOR', 'Monitor CFTV'),
  ('CFTV.PERIFERICOS.VISUALIZACAO.CONTROLADORA', 'Mesa Controladora'),
  ('CFTV.PERIFERICOS.VISUALIZACAO.CONTROLADORA', 'Joystick'),
  ('CFTV.PERIFERICOS.VISUALIZACAO.CONTROLADORA', 'Teclado Controlador')
) as a(code, alias)
join public.catalog_taxonomy_nodes n on n.code = a.code
on conflict (normalized_alias) do nothing;

-- =====================================================================
-- 5) BACKFILL — só CFTV ainda NAO_CLASSIFICADO cuja subcategoria legada é
--    exatamente um alias de um nó de Periféricos (espelha classifyCatalogItem).
-- =====================================================================
update public.inventory_items i
set canonical_taxonomy_id = n.id, classification_status = 'CLASSIFICADO'
from public.catalog_taxonomy_aliases a
join public.catalog_taxonomy_nodes n on n.id = a.taxonomy_node_id
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'cftv'
  and n.code like 'CFTV.PERIFERICOS.%'
  and a.active
  and a.normalized_alias = public.fireowl_catalog_norm(i.subcategory);
