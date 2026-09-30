-- =====================================================================
-- 0115_cftv_taxonomy_families
-- Amplia a taxonomia canônica CFTV com famílias ESPECÍFICAS de CFTV, no
-- mesmo nível de Câmeras/Gravadores (Área → Família → Tipo), sem nível
-- intermediário artificial:
--   CFTV → Armazenamento            → HD | SSD | Cartão de Memória
--   CFTV → Transmissão de Vídeo     → Balun | Extensor / Conversor de Vídeo
--   CFTV → Acessórios de Instalação → Suportes | Caixas de Passagem / Herméticas
--   CFTV → Visualização e Operação  → Monitor | Mesa Controladora / Joystick
--
-- Itens TRANSVERSAIS (energia, rede, cabeamento, racks) NÃO ficam aqui: são
-- o domínio INFRA (0116 estrutura + 0117 dados). Câmeras/Gravadores intactos.
--
-- SOMENTE DADOS DE TAXONOMIA (nós + aliases). NÃO reclassifica produtos
-- (backfill será decidido na 0119 após consulta real). NÃO toca saldo,
-- preço, custo, SDAI.BATERIAS nem SDAI.ALIMENTACAO.
--
-- Idempotente (on conflict do nothing). Rode ANTES da 0116 (não usa `scope`;
-- a 0116 preenche scope='AREA' pelo default).
-- Rollback lógico (enquanto nenhum produto apontar para estes nós):
--   delete from catalog_taxonomy_nodes where code like any (array[
--     'CFTV.ARMAZENAMENTO%','CFTV.TRANSMISSAO%','CFTV.ACESSORIOS%','CFTV.VISUALIZACAO%'])
--   (filhos antes dos pais; aliases caem por cascade).
-- =====================================================================

-- 1) Famílias (parent NULL), após Câmeras (10) e Gravadores (20)
insert into public.catalog_taxonomy_nodes (area, parent_id, node_type, code, name, sort_order) values
  ('CFTV', null, 'FAMILY', 'CFTV.ARMAZENAMENTO', 'Armazenamento',            30),
  ('CFTV', null, 'FAMILY', 'CFTV.TRANSMISSAO',   'Transmissão de Vídeo',     40),
  ('CFTV', null, 'FAMILY', 'CFTV.ACESSORIOS',    'Acessórios de Instalação', 50),
  ('CFTV', null, 'FAMILY', 'CFTV.VISUALIZACAO',  'Visualização e Operação',  60)
on conflict (code) do nothing;

-- 2) Tipos
insert into public.catalog_taxonomy_nodes (area, parent_id, node_type, code, name, sort_order)
select v.area, p.id, v.node_type, v.code, v.name, v.sort_order
from (values
  ('CFTV','CFTV.ARMAZENAMENTO','TYPE','CFTV.ARMAZENAMENTO.HD',         'Disco Rígido (HD)',               10),
  ('CFTV','CFTV.ARMAZENAMENTO','TYPE','CFTV.ARMAZENAMENTO.SSD',        'SSD',                             20),
  ('CFTV','CFTV.ARMAZENAMENTO','TYPE','CFTV.ARMAZENAMENTO.CARTAO',     'Cartão de Memória',               30),
  ('CFTV','CFTV.TRANSMISSAO',  'TYPE','CFTV.TRANSMISSAO.BALUN',        'Balun',                           10),
  ('CFTV','CFTV.TRANSMISSAO',  'TYPE','CFTV.TRANSMISSAO.EXTENSOR',     'Extensor / Conversor de Vídeo',   20),
  ('CFTV','CFTV.ACESSORIOS',   'TYPE','CFTV.ACESSORIOS.SUPORTE',       'Suportes',                        10),
  ('CFTV','CFTV.ACESSORIOS',   'TYPE','CFTV.ACESSORIOS.CAIXA',         'Caixas de Passagem / Herméticas', 20),
  ('CFTV','CFTV.VISUALIZACAO', 'TYPE','CFTV.VISUALIZACAO.MONITOR',     'Monitor',                         10),
  ('CFTV','CFTV.VISUALIZACAO', 'TYPE','CFTV.VISUALIZACAO.CONTROLADORA','Mesa Controladora / Joystick',    20)
) as v(area, parent_code, node_type, code, name, sort_order)
join public.catalog_taxonomy_nodes p on p.code = v.parent_code
on conflict (code) do nothing;

-- 3) Aliases (espelho de lib/catalogTaxonomy.ts). Sem colisão com os
--    existentes: "Monitor" segue = módulo monitor SDAI.
insert into public.catalog_taxonomy_aliases (taxonomy_node_id, alias, normalized_alias)
select n.id, a.alias, public.fireowl_catalog_norm(a.alias)
from (values
  ('CFTV.ARMAZENAMENTO.HD', 'HD'),
  ('CFTV.ARMAZENAMENTO.HD', 'HDD'),
  ('CFTV.ARMAZENAMENTO.HD', 'Disco Rígido'),
  ('CFTV.ARMAZENAMENTO.HD', 'HD Surveillance'),
  ('CFTV.ARMAZENAMENTO.HD', 'HD para CFTV'),
  ('CFTV.ARMAZENAMENTO.SSD', 'SSD'),
  ('CFTV.ARMAZENAMENTO.CARTAO', 'Cartão de Memória'),
  ('CFTV.ARMAZENAMENTO.CARTAO', 'Cartão microSD'),
  ('CFTV.ARMAZENAMENTO.CARTAO', 'MicroSD'),
  ('CFTV.ARMAZENAMENTO.CARTAO', 'Cartão SD'),
  ('CFTV.TRANSMISSAO.BALUN', 'Balun'),
  ('CFTV.TRANSMISSAO.BALUN', 'Video Balun'),
  ('CFTV.TRANSMISSAO.BALUN', 'Balun HDCVI'),
  ('CFTV.TRANSMISSAO.EXTENSOR', 'Extensor de Vídeo'),
  ('CFTV.TRANSMISSAO.EXTENSOR', 'Conversor de Vídeo'),
  ('CFTV.TRANSMISSAO.EXTENSOR', 'Conversor HDCVI'),
  ('CFTV.TRANSMISSAO.EXTENSOR', 'Extensor HDMI'),
  ('CFTV.ACESSORIOS.SUPORTE', 'Suporte'),
  ('CFTV.ACESSORIOS.SUPORTE', 'Suporte para Câmera'),
  ('CFTV.ACESSORIOS.CAIXA', 'Caixa de Passagem'),
  ('CFTV.ACESSORIOS.CAIXA', 'Caixa Hermética'),
  ('CFTV.VISUALIZACAO.MONITOR', 'Monitor de Vídeo'),
  ('CFTV.VISUALIZACAO.MONITOR', 'Monitor CFTV'),
  ('CFTV.VISUALIZACAO.CONTROLADORA', 'Mesa Controladora'),
  ('CFTV.VISUALIZACAO.CONTROLADORA', 'Joystick'),
  ('CFTV.VISUALIZACAO.CONTROLADORA', 'Teclado Controlador')
) as a(code, alias)
join public.catalog_taxonomy_nodes n on n.code = a.code
on conflict (normalized_alias) do nothing;
