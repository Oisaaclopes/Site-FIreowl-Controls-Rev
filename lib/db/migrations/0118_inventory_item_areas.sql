-- =====================================================================
-- 0118_inventory_item_areas
-- APLICABILIDADE de produto: em quais áreas comerciais um produto pode ser
-- usado. Relação N×N produto × área, SEM duplicar produto nem saldo.
--
--   Catálogo      = identidade + UMA classificação canônica (inventory_items.canonical_taxonomy_id)
--   Estoque       = UM saldo por produto (inventory_items.quantity) — intocado
--   Aplicabilidade= N áreas por produto (esta tabela)
--   Base Técnica  = equipamentos instalados em clientes — intocada
--
-- Regras:
--   • produto classificado em nó scope='AREA': a área do nó é IMPLÍCITA e
--     NÃO gera linha aqui (linha redundante é rejeitada no insert/update);
--     linhas extras são aplicabilidades adicionais opcionais;
--   • produto classificado em nó TRANSVERSAL (INFRA): as áreas vêm SÓ desta
--     tabela. Sem linha = "sem aplicabilidade" (sinalizado; nunca criado
--     automaticamente). A obrigatoriedade é validada no fluxo de gravação do
--     app e exposta na view inventory_items_sem_aplicabilidade;
--   • produto sem classificação: fallback legado pela category (texto).
--
-- NÃO cria linhas (sem backfill — 0119 será decidida após consulta real).
-- NÃO toca inventory_items, saldo, classificação nem technical_catalog (0120).
-- Idempotente. Depende de 0116 (scope).
--
-- Rollback lógico (dados de aplicabilidade são perdidos):
--   drop view inventory_items_sem_aplicabilidade;
--   drop view inventory_item_effective_areas;
--   drop table inventory_item_areas;   (cascade leva trigger/policies)
--   drop function inventory_item_areas_guard();
-- =====================================================================

-- 1) Tabela
create table if not exists public.inventory_item_areas (
  item_id    uuid not null references public.inventory_items(id) on delete cascade,
  area       text not null
             constraint inventory_item_areas_area_chk
             check (area in ('SDAI', 'CFTV', 'ALARME', 'BMS', 'CONTROLE_ACESSO')),
  origin     text not null default 'MANUAL'
             constraint inventory_item_areas_origin_chk
             check (origin in ('MANUAL', 'BACKFILL', 'IMPORT')),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  constraint inventory_item_areas_pkey primary key (item_id, area)
);

-- "produtos aplicáveis à área X" (a PK já cobre a busca por item)
create index if not exists inventory_item_areas_area_idx on public.inventory_item_areas (area, item_id);

comment on table public.inventory_item_areas is
  'Aplicabilidade N×N produto × área comercial. Não duplica produto/saldo. Área implícita da classificação (scope AREA) não gera linha.';

-- 2) Guarda: auditoria confiável + rejeita linha redundante
create or replace function public.inventory_item_areas_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := coalesce(auth.uid(), new.created_by);
  else
    -- auditoria de criação é imutável
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;

  if exists (
    select 1
    from public.inventory_items i
    join public.catalog_taxonomy_nodes n on n.id = i.canonical_taxonomy_id
    where i.id = new.item_id
      and n.scope = 'AREA'
      and n.area = new.area
  ) then
    raise exception 'inventory_item_areas: % já é implícita pela classificação do produto (linha redundante)', new.area
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_inventory_item_areas_guard on public.inventory_item_areas;
create trigger trg_inventory_item_areas_guard
  before insert or update on public.inventory_item_areas
  for each row execute function public.inventory_item_areas_guard();

-- 3) RLS — mesmos perfis de inventory_items (0005): ADMINISTRATIVO e GESTOR
alter table public.inventory_item_areas enable row level security;
revoke all on public.inventory_item_areas from anon;
grant select, insert, update, delete on public.inventory_item_areas to authenticated;

drop policy if exists "item areas select" on public.inventory_item_areas;
create policy "item areas select" on public.inventory_item_areas for select to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));
drop policy if exists "item areas insert" on public.inventory_item_areas;
create policy "item areas insert" on public.inventory_item_areas for insert to authenticated
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));
drop policy if exists "item areas update" on public.inventory_item_areas;
create policy "item areas update" on public.inventory_item_areas for update to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));
drop policy if exists "item areas delete" on public.inventory_item_areas;
create policy "item areas delete" on public.inventory_item_areas for delete to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));

-- 4) Áreas efetivas por produto (espelha lib/catalogApplicability.ts).
--    security_invoker: respeita a RLS de inventory_items/inventory_item_areas.
--    source: CLASSIFICACAO (área do nó AREA) | APLICABILIDADE (linha) |
--            LEGADO (sem classificação → category textual).
create or replace view public.inventory_item_effective_areas
with (security_invoker = true) as
with legacy as (
  select i.id as item_id, public.fireowl_catalog_norm(i.category) as cat
  from public.inventory_items i
  where i.canonical_taxonomy_id is null
),
src as (
  select i.id as item_id, n.area, 'CLASSIFICACAO'::text as source
  from public.inventory_items i
  join public.catalog_taxonomy_nodes n on n.id = i.canonical_taxonomy_id
  where n.scope = 'AREA'
  union all
  select a.item_id, a.area, 'APLICABILIDADE'::text
  from public.inventory_item_areas a
  union all
  select l.item_id, m.area, 'LEGADO'::text
  from legacy l
  join (values
    ('SDAI', 'sdai'), ('CFTV', 'cftv'), ('ALARME', 'alarme'),
    ('BMS', 'bms'), ('BMS', 'automacao'),
    ('CONTROLE_ACESSO', 'controle'), ('CONTROLE_ACESSO', 'acesso')
  ) as m(area, token) on l.cat like '%' || m.token || '%'
)
select item_id, area, array_agg(distinct source order by source) as sources
from src
group by item_id, area;

revoke all on public.inventory_item_effective_areas from anon;
grant select on public.inventory_item_effective_areas to authenticated;

comment on view public.inventory_item_effective_areas is
  'Áreas efetivas de cada produto: área implícita da classificação (AREA) ∪ aplicabilidades ∪ fallback legado (sem classificação). Uma linha por produto×área.';

-- 5) Pendência explícita: produto TRANSVERSAL sem nenhuma aplicabilidade
create or replace view public.inventory_items_sem_aplicabilidade
with (security_invoker = true) as
select i.id as item_id, i.code, i.name, i.brand, i.model, n.code as taxonomy_code
from public.inventory_items i
join public.catalog_taxonomy_nodes n on n.id = i.canonical_taxonomy_id
where n.scope = 'TRANSVERSAL'
  and not exists (select 1 from public.inventory_item_areas a where a.item_id = i.id);

revoke all on public.inventory_items_sem_aplicabilidade from anon;
grant select on public.inventory_items_sem_aplicabilidade to authenticated;

comment on view public.inventory_items_sem_aplicabilidade is
  'Produtos classificados em nó TRANSVERSAL (INFRA) sem aplicabilidade — não estão prontos para uso em propostas.';
