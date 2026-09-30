-- =====================================================================
-- 0117_infra_taxonomy
-- Dados do domínio TRANSVERSAL "Infraestrutura" (scope='TRANSVERSAL',
-- area NULL). Itens físicos compartilhados entre áreas comerciais:
--   Infraestrutura → Energia             → Fonte | Nobreak | Bateria | Proteção Elétrica (DPS)
--   Infraestrutura → Rede                → Switch | Switch PoE | Injetor / Extensor PoE | Roteador / Access Point | Conversor de Mídia
--   Infraestrutura → Cabeamento          → Cabo UTP | Cabo Coaxial | Fibra Óptica | Cabo de Energia / PP | Cabo HDMI / VGA | Conectores
--   Infraestrutura → Racks e Organização → Rack | Patch Panel | Organizador de Cabos | Acessórios de Rack
--
-- "Infraestrutura" NÃO é um nó: como as áreas, é o domínio; as famílias
-- INFRA.* ficam na raiz (parent_id NULL).
--
-- SOMENTE nós + aliases. NÃO reclassifica produtos (0119 decidirá após
-- consulta real). NÃO toca SDAI.BATERIAS / SDAI.ALIMENTACAO: "Bateria",
-- "Fonte Auxiliar" e "Fonte Nobreak" continuam apontando para SDAI.
--
-- Idempotente. Depende de 0116 (scope + trigger pai/filho).
-- Rollback lógico (enquanto nenhum produto apontar para INFRA.*):
--   delete from catalog_taxonomy_nodes where code like 'INFRA.%.%';
--   delete from catalog_taxonomy_nodes where code like 'INFRA.%';
-- =====================================================================

-- 1) Famílias transversais (raiz)
insert into public.catalog_taxonomy_nodes (scope, area, parent_id, node_type, code, name, sort_order) values
  ('TRANSVERSAL', null, null, 'FAMILY', 'INFRA.ENERGIA',    'Energia',             10),
  ('TRANSVERSAL', null, null, 'FAMILY', 'INFRA.REDE',       'Rede',                20),
  ('TRANSVERSAL', null, null, 'FAMILY', 'INFRA.CABEAMENTO', 'Cabeamento',          30),
  ('TRANSVERSAL', null, null, 'FAMILY', 'INFRA.RACKS',      'Racks e Organização', 40)
on conflict (code) do nothing;

-- 2) Tipos (herdam scope/area do pai — validado pelo trigger da 0116)
insert into public.catalog_taxonomy_nodes (scope, area, parent_id, node_type, code, name, sort_order)
select p.scope, p.area, p.id, 'TYPE', v.code, v.name, v.sort_order
from (values
  ('INFRA.ENERGIA',    'INFRA.ENERGIA.FONTE',          'Fonte',                    10),
  ('INFRA.ENERGIA',    'INFRA.ENERGIA.NOBREAK',        'Nobreak',                  20),
  ('INFRA.ENERGIA',    'INFRA.ENERGIA.BATERIA',        'Bateria',                  30),
  ('INFRA.ENERGIA',    'INFRA.ENERGIA.DPS',            'Proteção Elétrica (DPS)',  40),
  ('INFRA.REDE',       'INFRA.REDE.SWITCH',            'Switch',                   10),
  ('INFRA.REDE',       'INFRA.REDE.SWITCH_POE',        'Switch PoE',               20),
  ('INFRA.REDE',       'INFRA.REDE.POE',               'Injetor / Extensor PoE',   30),
  ('INFRA.REDE',       'INFRA.REDE.ROTEADOR',          'Roteador / Access Point',  40),
  ('INFRA.REDE',       'INFRA.REDE.CONVERSOR',         'Conversor de Mídia',       50),
  ('INFRA.CABEAMENTO', 'INFRA.CABEAMENTO.UTP',         'Cabo UTP',                 10),
  ('INFRA.CABEAMENTO', 'INFRA.CABEAMENTO.COAXIAL',     'Cabo Coaxial',             20),
  ('INFRA.CABEAMENTO', 'INFRA.CABEAMENTO.FIBRA',       'Fibra Óptica',             30),
  ('INFRA.CABEAMENTO', 'INFRA.CABEAMENTO.ENERGIA',     'Cabo de Energia / PP',     40),
  ('INFRA.CABEAMENTO', 'INFRA.CABEAMENTO.VIDEO',       'Cabo HDMI / VGA',          50),
  ('INFRA.CABEAMENTO', 'INFRA.CABEAMENTO.CONECTORES',  'Conectores',               60),
  ('INFRA.RACKS',      'INFRA.RACKS.RACK',             'Rack',                     10),
  ('INFRA.RACKS',      'INFRA.RACKS.PATCH_PANEL',      'Patch Panel',              20),
  ('INFRA.RACKS',      'INFRA.RACKS.ORGANIZADOR',      'Organizador de Cabos',     30),
  ('INFRA.RACKS',      'INFRA.RACKS.ACESSORIOS',       'Acessórios de Rack',       40)
) as v(parent_code, code, name, sort_order)
join public.catalog_taxonomy_nodes p on p.code = v.parent_code
on conflict (code) do nothing;

-- 3) Aliases (espelho de lib/catalogTaxonomy.ts; sem colisão com SDAI/CFTV)
insert into public.catalog_taxonomy_aliases (taxonomy_node_id, alias, normalized_alias)
select n.id, a.alias, public.fireowl_catalog_norm(a.alias)
from (values
  ('INFRA.ENERGIA.FONTE', 'Fonte'),
  ('INFRA.ENERGIA.FONTE', 'Fonte 12V'),
  ('INFRA.ENERGIA.FONTE', 'Fonte Colmeia'),
  ('INFRA.ENERGIA.FONTE', 'Fonte Chaveada'),
  ('INFRA.ENERGIA.NOBREAK', 'Nobreak'),
  ('INFRA.ENERGIA.NOBREAK', 'UPS'),
  ('INFRA.ENERGIA.BATERIA', 'Bateria Estacionária'),
  ('INFRA.ENERGIA.BATERIA', 'Bateria para Nobreak'),
  ('INFRA.ENERGIA.DPS', 'DPS'),
  ('INFRA.ENERGIA.DPS', 'Protetor de Surto'),
  ('INFRA.ENERGIA.DPS', 'Dispositivo de Proteção contra Surtos'),
  ('INFRA.REDE.SWITCH', 'Switch'),
  ('INFRA.REDE.SWITCH', 'Switch de Rede'),
  ('INFRA.REDE.SWITCH_POE', 'Switch PoE'),
  ('INFRA.REDE.POE', 'Injetor PoE'),
  ('INFRA.REDE.POE', 'Extensor PoE'),
  ('INFRA.REDE.POE', 'Splitter PoE'),
  ('INFRA.REDE.ROTEADOR', 'Roteador'),
  ('INFRA.REDE.ROTEADOR', 'Router'),
  ('INFRA.REDE.ROTEADOR', 'Access Point'),
  ('INFRA.REDE.CONVERSOR', 'Conversor de Mídia'),
  ('INFRA.REDE.CONVERSOR', 'Media Converter'),
  ('INFRA.CABEAMENTO.UTP', 'Cabo UTP'),
  ('INFRA.CABEAMENTO.UTP', 'Cabo de Rede'),
  ('INFRA.CABEAMENTO.UTP', 'Cabo CAT5e'),
  ('INFRA.CABEAMENTO.UTP', 'Cabo CAT6'),
  ('INFRA.CABEAMENTO.COAXIAL', 'Cabo Coaxial'),
  ('INFRA.CABEAMENTO.COAXIAL', 'Coaxial'),
  ('INFRA.CABEAMENTO.COAXIAL', 'Cabo Coaxial Bipolar'),
  ('INFRA.CABEAMENTO.FIBRA', 'Fibra Óptica'),
  ('INFRA.CABEAMENTO.FIBRA', 'Cabo de Fibra'),
  ('INFRA.CABEAMENTO.FIBRA', 'Cordão Óptico'),
  ('INFRA.CABEAMENTO.ENERGIA', 'Cabo PP'),
  ('INFRA.CABEAMENTO.ENERGIA', 'Cabo de Energia'),
  ('INFRA.CABEAMENTO.VIDEO', 'Cabo HDMI'),
  ('INFRA.CABEAMENTO.VIDEO', 'Cabo VGA'),
  ('INFRA.CABEAMENTO.CONECTORES', 'Conector'),
  ('INFRA.CABEAMENTO.CONECTORES', 'Conector RJ45'),
  ('INFRA.CABEAMENTO.CONECTORES', 'Conector BNC'),
  ('INFRA.CABEAMENTO.CONECTORES', 'Conector P4'),
  ('INFRA.CABEAMENTO.CONECTORES', 'RJ45'),
  ('INFRA.CABEAMENTO.CONECTORES', 'BNC'),
  ('INFRA.RACKS.RACK', 'Rack'),
  ('INFRA.RACKS.RACK', 'Rack de Parede'),
  ('INFRA.RACKS.RACK', 'Rack de Piso'),
  ('INFRA.RACKS.PATCH_PANEL', 'Patch Panel'),
  ('INFRA.RACKS.ORGANIZADOR', 'Organizador de Cabos'),
  ('INFRA.RACKS.ORGANIZADOR', 'Guia de Cabos'),
  ('INFRA.RACKS.ACESSORIOS', 'Acessório de Rack'),
  ('INFRA.RACKS.ACESSORIOS', 'Bandeja de Rack'),
  ('INFRA.RACKS.ACESSORIOS', 'Régua de Tomadas')
) as a(code, alias)
join public.catalog_taxonomy_nodes n on n.code = a.code
on conflict (normalized_alias) do nothing;
