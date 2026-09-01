-- =====================================================================
-- 0070_canonical_catalog_taxonomy
-- Taxonomia técnica canônica Fireowl (dicionário controlado).
--
-- Camada ADITIVA. NÃO altera saldo, custo, preço, fornecedor, histórico,
-- nem remove/renomeia produtos. Preserva TODOS os campos legados
-- (category, subcategory, brand, product_line, model, description,
-- technologies, technical_specs). A UI antiga continua funcionando.
--
-- Backfill determinístico e auditável APENAS para SDAI e CFTV.
-- ALARME e BMS permanecem NAO_CLASSIFICADO (passada própria no futuro).
--
-- Idempotente: pode ser reaplicada com segurança (create ... if not exists,
-- add column if not exists, on conflict do nothing, e o backfill só toca
-- linhas ainda NAO_CLASSIFICADO — nunca sobrescreve decisão humana).
--
-- Rode no SQL Editor do Supabase. NÃO edite migrations anteriores.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Normalizador determinístico (espelha lib normalizedCatalogKey):
--    minúsculas, remove acentos PT-BR e tudo que não for [a-z0-9].
--    Sem dependência de extensão (unaccent) — usa translate().
-- ---------------------------------------------------------------------
create or replace function public.fireowl_catalog_norm(v text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(
    translate(
      lower(coalesce(v, '')),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'
    ),
    '[^a-z0-9]', '', 'g'
  );
$$;

-- ---------------------------------------------------------------------
-- 1) Nós canônicos da árvore (dicionário controlado, ID estável).
--    Famílias têm parent_id NULL; cada família tem sua própria árvore.
-- ---------------------------------------------------------------------
create table if not exists public.catalog_taxonomy_nodes (
  id          uuid primary key default gen_random_uuid(),
  area        text not null check (area in ('SDAI', 'CFTV', 'ALARME', 'BMS')),
  parent_id   uuid references public.catalog_taxonomy_nodes(id) on delete restrict,
  node_type   text not null check (node_type in ('FAMILY', 'GROUP', 'TYPE', 'FUNCTION', 'TECHNOLOGY', 'FORM_FACTOR')),
  code        text not null unique,
  name        text not null,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists catalog_taxonomy_nodes_parent_idx on public.catalog_taxonomy_nodes (parent_id);
create index if not exists catalog_taxonomy_nodes_area_idx   on public.catalog_taxonomy_nodes (area);

-- ---------------------------------------------------------------------
-- 2) Sinônimos / aliases → nó canônico. Normalizado para busca robusta.
--    NÃO altera a descrição original do produto; serve só p/ classificação/busca.
-- ---------------------------------------------------------------------
create table if not exists public.catalog_taxonomy_aliases (
  id               uuid primary key default gen_random_uuid(),
  taxonomy_node_id uuid not null references public.catalog_taxonomy_nodes(id) on delete cascade,
  alias            text not null,
  normalized_alias text not null unique,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

create index if not exists catalog_taxonomy_aliases_node_idx on public.catalog_taxonomy_aliases (taxonomy_node_id);

-- ---------------------------------------------------------------------
-- 3) Vínculo produto → classificação canônica (ADITIVO em inventory_items).
-- ---------------------------------------------------------------------
alter table public.inventory_items
  add column if not exists canonical_taxonomy_id uuid references public.catalog_taxonomy_nodes(id) on delete set null;

alter table public.inventory_items
  add column if not exists classification_status text not null default 'NAO_CLASSIFICADO';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inventory_items_classification_status_chk'
  ) then
    alter table public.inventory_items
      add constraint inventory_items_classification_status_chk
      check (classification_status in ('CLASSIFICADO', 'REVISAR', 'NAO_CLASSIFICADO'));
  end if;
end $$;

create index if not exists inventory_items_canonical_idx        on public.inventory_items (canonical_taxonomy_id);
create index if not exists inventory_items_classification_idx   on public.inventory_items (classification_status);

-- ---------------------------------------------------------------------
-- 4) updated_at automático nos nós.
-- ---------------------------------------------------------------------
create or replace function public.set_catalog_taxonomy_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists trg_catalog_taxonomy_updated_at on public.catalog_taxonomy_nodes;
create trigger trg_catalog_taxonomy_updated_at
  before update on public.catalog_taxonomy_nodes
  for each row execute function public.set_catalog_taxonomy_updated_at();

-- ---------------------------------------------------------------------
-- 5) RLS — legível pelos mesmos perfis que consultam o catálogo
--    (ADMINISTRATIVO, GESTOR). Escrita/classificação: ADMINISTRATIVO.
--    Não enfraquece nada de inventory_items.
-- ---------------------------------------------------------------------
alter table public.catalog_taxonomy_nodes   enable row level security;
alter table public.catalog_taxonomy_aliases enable row level security;

revoke all on public.catalog_taxonomy_nodes   from anon;
revoke all on public.catalog_taxonomy_aliases from anon;
grant select, insert, update, delete on public.catalog_taxonomy_nodes   to authenticated;
grant select, insert, update, delete on public.catalog_taxonomy_aliases to authenticated;

drop policy if exists "taxonomy nodes select" on public.catalog_taxonomy_nodes;
create policy "taxonomy nodes select" on public.catalog_taxonomy_nodes for select to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));
drop policy if exists "taxonomy nodes write insert" on public.catalog_taxonomy_nodes;
create policy "taxonomy nodes write insert" on public.catalog_taxonomy_nodes for insert to authenticated
  with check (public.auth_role() = 'ADMINISTRATIVO');
drop policy if exists "taxonomy nodes write update" on public.catalog_taxonomy_nodes;
create policy "taxonomy nodes write update" on public.catalog_taxonomy_nodes for update to authenticated
  using (public.auth_role() = 'ADMINISTRATIVO') with check (public.auth_role() = 'ADMINISTRATIVO');
drop policy if exists "taxonomy nodes write delete" on public.catalog_taxonomy_nodes;
create policy "taxonomy nodes write delete" on public.catalog_taxonomy_nodes for delete to authenticated
  using (public.auth_role() = 'ADMINISTRATIVO');

drop policy if exists "taxonomy aliases select" on public.catalog_taxonomy_aliases;
create policy "taxonomy aliases select" on public.catalog_taxonomy_aliases for select to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));
drop policy if exists "taxonomy aliases write insert" on public.catalog_taxonomy_aliases;
create policy "taxonomy aliases write insert" on public.catalog_taxonomy_aliases for insert to authenticated
  with check (public.auth_role() = 'ADMINISTRATIVO');
drop policy if exists "taxonomy aliases write update" on public.catalog_taxonomy_aliases;
create policy "taxonomy aliases write update" on public.catalog_taxonomy_aliases for update to authenticated
  using (public.auth_role() = 'ADMINISTRATIVO') with check (public.auth_role() = 'ADMINISTRATIVO');
drop policy if exists "taxonomy aliases write delete" on public.catalog_taxonomy_aliases;
create policy "taxonomy aliases write delete" on public.catalog_taxonomy_aliases for delete to authenticated
  using (public.auth_role() = 'ADMINISTRATIVO');

-- ---------------------------------------------------------------------
-- 6) Seed dos nós. Códigos estáveis em notação de ponto. parent via code.
--    Só nós com produto real ou necessários como ancestral/alvo de alias.
-- ---------------------------------------------------------------------
insert into public.catalog_taxonomy_nodes (area, parent_id, node_type, code, name, sort_order) values
  -- SDAI · Centrais de Alarme de Incêndio
  ('SDAI', null, 'FAMILY',      'SDAI.CENTRAIS',              'Centrais de Alarme de Incêndio', 10),
  ('SDAI', null, 'FAMILY',      'SDAI.DETECTORES',           'Detectores',                     20),
  ('SDAI', null, 'FAMILY',      'SDAI.MODULOS',              'Módulos',                        30),
  ('SDAI', null, 'FAMILY',      'SDAI.BASES',                'Bases',                          40),
  ('SDAI', null, 'FAMILY',      'SDAI.ACIONADORES',          'Acionadores Manuais',            50),
  ('SDAI', null, 'FAMILY',      'SDAI.ANUNCIADORES',         'Repetidoras / Anunciadores',     60),
  -- CFTV famílias
  ('CFTV', null, 'FAMILY',      'CFTV.CAMERAS',              'Câmeras',                        10),
  ('CFTV', null, 'FAMILY',      'CFTV.GRAVADORES',           'Gravadores',                     20)
on conflict (code) do nothing;

insert into public.catalog_taxonomy_nodes (area, parent_id, node_type, code, name, sort_order)
select v.area, p.id, v.node_type, v.code, v.name, v.sort_order
from (values
  -- Centrais › Equipamentos › tecnologia
  ('SDAI','SDAI.CENTRAIS',            'GROUP',       'SDAI.CENTRAIS.EQUIP',        'Equipamentos',            10),
  ('SDAI','SDAI.DETECTORES',          'TYPE',        'SDAI.DETECTORES.FUMACA',     'Fumaça',                  10),
  ('SDAI','SDAI.DETECTORES',          'TYPE',        'SDAI.DETECTORES.TEMP',       'Temperatura',             20),
  ('SDAI','SDAI.DETECTORES',          'TYPE',        'SDAI.DETECTORES.ASP',        'Aspiração',               30),
  ('SDAI','SDAI.MODULOS',             'FUNCTION',    'SDAI.MODULOS.ENTRADA',       'Entrada / Monitor',       10),
  ('SDAI','SDAI.MODULOS',             'FUNCTION',    'SDAI.MODULOS.SAIDA',         'Saída / Controle',        20),
  ('SDAI','SDAI.MODULOS',             'FUNCTION',    'SDAI.MODULOS.IO',            'Entrada e Saída (I/O)',   30),
  ('SDAI','SDAI.MODULOS',             'FUNCTION',    'SDAI.MODULOS.RELE',          'Relé',                    40),
  ('SDAI','SDAI.MODULOS',             'FUNCTION',    'SDAI.MODULOS.ISOLADOR',      'Isolador',                50),
  ('CFTV','CFTV.CAMERAS',             'TECHNOLOGY',  'CFTV.CAMERAS.IP',            'IP',                      10),
  ('CFTV','CFTV.CAMERAS',             'TECHNOLOGY',  'CFTV.CAMERAS.HDCVI',         'HDCVI / Analógica',       20),
  ('CFTV','CFTV.GRAVADORES',          'TECHNOLOGY',  'CFTV.GRAVADORES.NVR',        'NVR',                     10),
  ('CFTV','CFTV.GRAVADORES',          'TECHNOLOGY',  'CFTV.GRAVADORES.DVR_HIBRIDO','DVR / Híbrido',           20)
) as v(area, parent_code, node_type, code, name, sort_order)
join public.catalog_taxonomy_nodes p on p.code = v.parent_code
on conflict (code) do nothing;

insert into public.catalog_taxonomy_nodes (area, parent_id, node_type, code, name, sort_order)
select v.area, p.id, v.node_type, v.code, v.name, v.sort_order
from (values
  ('SDAI','SDAI.CENTRAIS.EQUIP',      'TECHNOLOGY',  'SDAI.CENTRAIS.EQUIP.END',    'Endereçável',             10),
  ('SDAI','SDAI.CENTRAIS.EQUIP',      'TECHNOLOGY',  'SDAI.CENTRAIS.EQUIP.CONV',   'Convencional',            20),
  ('SDAI','SDAI.DETECTORES.FUMACA',   'TECHNOLOGY',  'SDAI.DETECTORES.FUMACA.END', 'Endereçável',             10),
  ('SDAI','SDAI.DETECTORES.FUMACA',   'TECHNOLOGY',  'SDAI.DETECTORES.FUMACA.CONV','Convencional',            20),
  ('SDAI','SDAI.DETECTORES.TEMP',     'TECHNOLOGY',  'SDAI.DETECTORES.TEMP.END',   'Endereçável',             10),
  ('SDAI','SDAI.DETECTORES.TEMP',     'TECHNOLOGY',  'SDAI.DETECTORES.TEMP.CONV',  'Convencional',            20),
  ('SDAI','SDAI.ACIONADORES',         'TECHNOLOGY',  'SDAI.ACIONADORES.END',       'Endereçável',             10),
  ('SDAI','SDAI.ACIONADORES',         'TECHNOLOGY',  'SDAI.ACIONADORES.CONV',      'Convencional',            20),
  ('CFTV','CFTV.CAMERAS.IP',          'FORM_FACTOR', 'CFTV.CAMERAS.IP.BULLET',     'Bullet',                  10),
  ('CFTV','CFTV.CAMERAS.IP',          'FORM_FACTOR', 'CFTV.CAMERAS.IP.DOME',       'Dome',                    20)
) as v(area, parent_code, node_type, code, name, sort_order)
join public.catalog_taxonomy_nodes p on p.code = v.parent_code
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- 7) Seed dos aliases (sinônimos técnicos → nó). normalized_alias único.
-- ---------------------------------------------------------------------
insert into public.catalog_taxonomy_aliases (taxonomy_node_id, alias, normalized_alias)
select n.id, a.alias, public.fireowl_catalog_norm(a.alias)
from (values
  -- Centrais de Alarme de Incêndio (converge "Central"/"Central de Alarme")
  ('SDAI.CENTRAIS',            'Central'),
  ('SDAI.CENTRAIS',            'Central de Alarme'),
  ('SDAI.CENTRAIS',            'Central de Incêndio'),
  ('SDAI.CENTRAIS',            'Central de Alarme de Incêndio'),
  ('SDAI.CENTRAIS',            'Painel de Incêndio'),
  ('SDAI.CENTRAIS',            'FACP'),
  -- Módulos
  ('SDAI.MODULOS.ISOLADOR',    'Isolador'),
  ('SDAI.MODULOS.ISOLADOR',    'Isolator'),
  ('SDAI.MODULOS.ISOLADOR',    'Isolator Module'),
  ('SDAI.MODULOS.ISOLADOR',    'Isolador de Laço'),
  ('SDAI.MODULOS.ISOLADOR',    'Módulo Isolador'),
  ('SDAI.MODULOS.IO',          'I/O'),
  ('SDAI.MODULOS.IO',          'Input Output'),
  ('SDAI.MODULOS.IO',          'Input/Output'),
  ('SDAI.MODULOS.IO',          'Entrada/Saída'),
  ('SDAI.MODULOS.IO',          'Entrada e Saída'),
  ('SDAI.MODULOS.IO',          'Módulo de Entrada e Saída'),
  ('SDAI.MODULOS.ENTRADA',     'Módulo Monitor'),
  ('SDAI.MODULOS.ENTRADA',     'Monitor'),
  ('SDAI.MODULOS.ENTRADA',     'Módulo de Entrada'),
  ('SDAI.MODULOS.ENTRADA',     'Input Module'),
  ('SDAI.MODULOS.SAIDA',       'Módulo de Controle'),
  ('SDAI.MODULOS.SAIDA',       'Control Module'),
  ('SDAI.MODULOS.SAIDA',       'Módulo de Saída'),
  ('SDAI.MODULOS.SAIDA',       'Output Module'),
  ('SDAI.MODULOS.RELE',        'Módulo Relé'),
  ('SDAI.MODULOS.RELE',        'Relé'),
  ('SDAI.MODULOS.RELE',        'Relay Module'),
  ('SDAI.MODULOS.RELE',        'Saída Relé'),
  -- Detectores
  ('SDAI.DETECTORES',          'Detector'),
  ('SDAI.DETECTORES',          'Detetor'),
  ('SDAI.DETECTORES.FUMACA',   'Fumaça'),
  ('SDAI.DETECTORES.FUMACA',   'Smoke'),
  ('SDAI.DETECTORES.FUMACA',   'Detector de Fumaça'),
  ('SDAI.DETECTORES.TEMP',     'Térmico'),
  ('SDAI.DETECTORES.TEMP',     'Temperatura'),
  ('SDAI.DETECTORES.TEMP',     'Heat'),
  ('SDAI.DETECTORES.TEMP',     'Detector Térmico'),
  ('SDAI.DETECTORES.ASP',      'Aspiração'),
  ('SDAI.DETECTORES.ASP',      'Detector por Aspiração'),
  ('SDAI.DETECTORES.ASP',      'VESDA'),
  -- Bases / Acionadores / Anunciadores
  ('SDAI.BASES',               'Base'),
  ('SDAI.BASES',               'Base para Detector'),
  ('SDAI.ACIONADORES',         'AM'),
  ('SDAI.ACIONADORES',         'Acionador'),
  ('SDAI.ACIONADORES',         'Acionador Manual'),
  ('SDAI.ACIONADORES',         'Botoeira'),
  ('SDAI.ACIONADORES',         'Manual Call Point'),
  ('SDAI.ACIONADORES',         'Pull Station'),
  ('SDAI.ANUNCIADORES',        'Anunciador'),
  ('SDAI.ANUNCIADORES',        'Repetidora'),
  ('SDAI.ANUNCIADORES',        'Annunciator'),
  -- CFTV
  ('CFTV.CAMERAS',             'Câmera'),
  ('CFTV.CAMERAS',             'Camera'),
  ('CFTV.CAMERAS.IP',          'Câmera IP'),
  ('CFTV.CAMERAS.IP',          'Network Camera'),
  ('CFTV.CAMERAS.HDCVI',       'HDCVI'),
  ('CFTV.CAMERAS.HDCVI',       'Analógica'),
  ('CFTV.CAMERAS.HDCVI',       'Câmera HDCVI'),
  ('CFTV.CAMERAS.IP.BULLET',   'Bullet'),
  ('CFTV.CAMERAS.IP.DOME',     'Dome'),
  ('CFTV.GRAVADORES',          'Gravador'),
  ('CFTV.GRAVADORES',          'Recorder'),
  ('CFTV.GRAVADORES.NVR',      'NVR'),
  ('CFTV.GRAVADORES.NVR',      'Gravador NVR'),
  ('CFTV.GRAVADORES.DVR_HIBRIDO','DVR'),
  ('CFTV.GRAVADORES.DVR_HIBRIDO','Híbrido'),
  ('CFTV.GRAVADORES.DVR_HIBRIDO','Gravador Híbrido')
) as a(code, alias)
join public.catalog_taxonomy_nodes n on n.code = a.code
on conflict (normalized_alias) do nothing;

-- =====================================================================
-- 8) BACKFILL determinístico e auditável (SDAI + CFTV).
--    Toca APENAS canonical_taxonomy_id e classification_status.
--    Guarda `classification_status = 'NAO_CLASSIFICADO'` → não sobrescreve
--    reclassificação humana e mantém a reaplicação idempotente.
--    NÃO altera quantity/price/cost/supplier/model/description.
-- =====================================================================

-- Helper local: id do nó por code
-- (usado como subselect escalar em cada UPDATE abaixo).

-- token de tecnologia a partir de name+description+product_line (normalizado)
-- => usamos expressões inline por auditabilidade.

-- ---- SDAI · CENTRAIS ------------------------------------------------
update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code = 'SDAI.CENTRAIS.EQUIP.CONV'),
    classification_status = 'CLASSIFICADO'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'sdai'
  and public.fireowl_catalog_norm(i.subcategory) = 'central'
  and public.fireowl_catalog_norm(coalesce(i.name,'')||coalesce(i.description,'')||coalesce(i.product_line,'')) like '%convencional%';

update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code = 'SDAI.CENTRAIS.EQUIP.END'),
    classification_status = 'CLASSIFICADO'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'sdai'
  and public.fireowl_catalog_norm(i.subcategory) = 'central'
  and public.fireowl_catalog_norm(coalesce(i.name,'')||coalesce(i.description,'')||coalesce(i.product_line,'')) ~ '(enderecavel|inteligente|lsn)';

update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code = 'SDAI.CENTRAIS.EQUIP'),
    classification_status = 'REVISAR'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'sdai'
  and public.fireowl_catalog_norm(i.subcategory) = 'central';

-- ---- SDAI · DETECTORES ---------------------------------------------
update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code =
      case when public.fireowl_catalog_norm(coalesce(i.name,'')||coalesce(i.description,'')) like '%convencional%'
           then 'SDAI.DETECTORES.FUMACA.CONV' else 'SDAI.DETECTORES.FUMACA.END' end),
    classification_status = 'CLASSIFICADO'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'sdai'
  and public.fireowl_catalog_norm(i.subcategory) = 'detectordefumaca';

update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code =
      case when public.fireowl_catalog_norm(coalesce(i.name,'')||coalesce(i.description,'')) like '%convencional%'
           then 'SDAI.DETECTORES.TEMP.CONV' else 'SDAI.DETECTORES.TEMP.END' end),
    classification_status = 'CLASSIFICADO'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'sdai'
  and public.fireowl_catalog_norm(i.subcategory) = 'detectortermico';

update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code = 'SDAI.DETECTORES.ASP'),
    classification_status = 'CLASSIFICADO'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'sdai'
  and public.fireowl_catalog_norm(i.subcategory) = 'detectorporaspiracao';

-- Ascael HORUS: DFX* = fumaça, DTX* = térmico (convenção de modelo F/T do fabricante)
update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code = 'SDAI.DETECTORES.FUMACA.END'),
    classification_status = 'CLASSIFICADO'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'sdai'
  and public.fireowl_catalog_norm(i.subcategory) = 'detector'
  and public.fireowl_catalog_norm(i.brand) = 'ascael'
  and coalesce(i.model, i.code) ilike 'DF%';

update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code = 'SDAI.DETECTORES.TEMP.END'),
    classification_status = 'CLASSIFICADO'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'sdai'
  and public.fireowl_catalog_norm(i.subcategory) = 'detector'
  and public.fireowl_catalog_norm(i.brand) = 'ascael'
  and coalesce(i.model, i.code) ilike 'DT%';

-- Detector genérico (Edwards SIGA, Bosch FAP/FAH) — tipo ambíguo → REVISAR na família
update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code = 'SDAI.DETECTORES'),
    classification_status = 'REVISAR'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'sdai'
  and public.fireowl_catalog_norm(i.subcategory) = 'detector';

-- ---- SDAI · MÓDULOS -------------------------------------------------
update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code = 'SDAI.MODULOS.ENTRADA'),
    classification_status = 'CLASSIFICADO'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'sdai'
  and public.fireowl_catalog_norm(i.subcategory) = 'modulomonitor';

update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code =
      case when coalesce(i.model, i.code) ilike '%REL%' then 'SDAI.MODULOS.RELE' else 'SDAI.MODULOS.SAIDA' end),
    classification_status = 'CLASSIFICADO'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'sdai'
  and public.fireowl_catalog_norm(i.subcategory) = 'modulocontrole';

update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code = 'SDAI.MODULOS.ISOLADOR'),
    classification_status = 'CLASSIFICADO'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'sdai'
  and public.fireowl_catalog_norm(i.subcategory) = 'moduloisolador';

-- Módulo genérico (Edwards SIGA) — função ambígua → REVISAR na família
update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code = 'SDAI.MODULOS'),
    classification_status = 'REVISAR'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'sdai'
  and public.fireowl_catalog_norm(i.subcategory) = 'modulo';

-- ---- SDAI · BASES / ACIONADORES / ANUNCIADORES ----------------------
update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code = 'SDAI.BASES'),
    classification_status = 'CLASSIFICADO'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'sdai'
  and public.fireowl_catalog_norm(i.subcategory) = 'base';

update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code = 'SDAI.ACIONADORES.CONV'),
    classification_status = 'CLASSIFICADO'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'sdai'
  and public.fireowl_catalog_norm(i.subcategory) = 'acionadormanual'
  and public.fireowl_catalog_norm(coalesce(i.name,'')||coalesce(i.description,'')) like '%convencional%';

update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code = 'SDAI.ACIONADORES.END'),
    classification_status = 'CLASSIFICADO'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'sdai'
  and public.fireowl_catalog_norm(i.subcategory) = 'acionadormanual'
  and public.fireowl_catalog_norm(coalesce(i.name,'')||coalesce(i.description,'')||coalesce(i.product_line,'')) ~ '(enderecavel|horus)';

update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code = 'SDAI.ACIONADORES'),
    classification_status = 'REVISAR'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'sdai'
  and public.fireowl_catalog_norm(i.subcategory) = 'acionadormanual';

update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code = 'SDAI.ANUNCIADORES'),
    classification_status = 'CLASSIFICADO'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'sdai'
  and public.fireowl_catalog_norm(i.subcategory) = 'anunciador';

-- ---- CFTV · CÂMERAS -------------------------------------------------
-- Intelbras VIP: sufixo de modelo B=Bullet / D=Dome (regra específica de
-- fabricante+linha, apenas quando o token de forma é isolado). specs.housing
-- também é aceito. Ambíguos (SD/PAN/TL/T/…) ficam no nó IP (sem forma).
update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code = 'CFTV.CAMERAS.IP.BULLET'),
    classification_status = 'CLASSIFICADO'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'cftv'
  and public.fireowl_catalog_norm(i.brand) = 'intelbras'
  and public.fireowl_catalog_norm(i.subcategory) in ('cameraip','cameraipbullet')
  and ( coalesce(i.model, i.code) ~ '(^|[[:space:]])B([[:space:]]|$)'
        or (i.technical_specs ->> 'housing') = 'bullet' );

update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code = 'CFTV.CAMERAS.IP.DOME'),
    classification_status = 'CLASSIFICADO'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'cftv'
  and public.fireowl_catalog_norm(i.brand) = 'intelbras'
  and public.fireowl_catalog_norm(i.subcategory) in ('cameraip','cameraipbullet')
  and coalesce(i.model, i.code) ~ '(^|[[:space:]])D([[:space:]]|$)';

-- Demais câmeras IP (Intelbras ambíguas + outras marcas p.ex. Hikvision) → nó IP
update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code = 'CFTV.CAMERAS.IP'),
    classification_status = 'CLASSIFICADO'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'cftv'
  and public.fireowl_catalog_norm(i.subcategory) in ('cameraip','cameraipbullet');

update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code = 'CFTV.CAMERAS.HDCVI'),
    classification_status = 'CLASSIFICADO'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'cftv'
  and public.fireowl_catalog_norm(i.subcategory) = 'camerahdcvi';

-- ---- CFTV · GRAVADORES ---------------------------------------------
update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code = 'CFTV.GRAVADORES.NVR'),
    classification_status = 'CLASSIFICADO'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'cftv'
  and public.fireowl_catalog_norm(i.subcategory) = 'gravadornvr';

update public.inventory_items i
set canonical_taxonomy_id = (select id from public.catalog_taxonomy_nodes where code = 'CFTV.GRAVADORES.DVR_HIBRIDO'),
    classification_status = 'CLASSIFICADO'
where i.classification_status = 'NAO_CLASSIFICADO'
  and public.fireowl_catalog_norm(i.category) = 'cftv'
  and public.fireowl_catalog_norm(i.subcategory) = 'dvrgravadorhibrido';

-- ALARME e BMS: permanecem NAO_CLASSIFICADO (default). Sem classificação nesta passada.
