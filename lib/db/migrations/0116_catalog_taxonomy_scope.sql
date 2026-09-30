-- =====================================================================
-- 0116_catalog_taxonomy_scope
-- Estrutura TRANSVERSAL da taxonomia canônica (somente esquema).
--
--   scope = 'AREA'        → nó de uma área comercial (area obrigatória)
--   scope = 'TRANSVERSAL' → nó de domínio transversal do catálogo (INFRA),
--                           area = NULL. NÃO é área comercial: não aparece em
--                           propostas/contratos/levantamentos como área.
--
-- Também passa a aceitar CONTROLE_ACESSO como área de nó (antes o CHECK só
-- tinha SDAI/CFTV/ALARME/BMS, divergindo de CANONICAL_AREAS do app).
--
-- Preserva 100% dos registros: todos recebem scope='AREA' (default) e já
-- têm area em SDAI/CFTV — a nova constraint valida sem alterar dados.
-- Pai/filho passam a ser validados NO BANCO (mesmo scope e mesma area).
--
-- NÃO toca inventory_items, saldo, classificação de produtos nem aliases.
-- Idempotente. Depende de 0070 (e rode após 0115).
--
-- Rollback lógico (só enquanto NÃO existirem nós TRANSVERSAL nem de
-- CONTROLE_ACESSO — ou seja, antes da 0117):
--   drop trigger trg_catalog_taxonomy_parent_consistency on catalog_taxonomy_nodes;
--   drop function catalog_taxonomy_parent_consistency();
--   alter table catalog_taxonomy_nodes drop constraint catalog_taxonomy_nodes_scope_area_chk;
--   alter table catalog_taxonomy_nodes drop constraint catalog_taxonomy_nodes_scope_chk;
--   alter table catalog_taxonomy_nodes alter column area set not null;
--   alter table catalog_taxonomy_nodes add constraint catalog_taxonomy_nodes_area_check
--     check (area in ('SDAI','CFTV','ALARME','BMS'));
--   alter table catalog_taxonomy_nodes drop column scope;
-- =====================================================================

-- 0) Pré-condição: a árvore atual já é consistente (pai/filho mesma área).
--    Se não for, aborta ANTES de qualquer mudança (nada é corrigido às cegas).
do $$
begin
  if exists (
    select 1
    from public.catalog_taxonomy_nodes c
    join public.catalog_taxonomy_nodes p on p.id = c.parent_id
    where p.area is distinct from c.area
  ) then
    raise exception '0116: árvore existente tem pai/filho com áreas diferentes — revisar antes de aplicar.';
  end if;
end $$;

-- 1) Coluna scope (todos os nós atuais = AREA)
alter table public.catalog_taxonomy_nodes
  add column if not exists scope text not null default 'AREA';

-- 2) Remove o CHECK antigo de área (nome automático da 0070) e qualquer outro
--    CHECK legado que restrinja `area`, preservando os novos desta migration.
alter table public.catalog_taxonomy_nodes drop constraint if exists catalog_taxonomy_nodes_area_check;
do $$
declare r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.catalog_taxonomy_nodes'::regclass
      and contype = 'c'
      and conname not in ('catalog_taxonomy_nodes_scope_chk', 'catalog_taxonomy_nodes_scope_area_chk')
      and pg_get_constraintdef(oid) ~* '\marea\M'
  loop
    execute format('alter table public.catalog_taxonomy_nodes drop constraint %I', r.conname);
  end loop;
end $$;

-- 3) area opcional — mas só para TRANSVERSAL (garantido pelo CHECK abaixo)
alter table public.catalog_taxonomy_nodes alter column area drop not null;

-- 4) Constraints consistentes
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'catalog_taxonomy_nodes_scope_chk') then
    alter table public.catalog_taxonomy_nodes
      add constraint catalog_taxonomy_nodes_scope_chk
      check (scope in ('AREA', 'TRANSVERSAL'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'catalog_taxonomy_nodes_scope_area_chk') then
    alter table public.catalog_taxonomy_nodes
      add constraint catalog_taxonomy_nodes_scope_area_chk
      check (
        (scope = 'AREA' and area in ('SDAI', 'CFTV', 'ALARME', 'BMS', 'CONTROLE_ACESSO'))
        or (scope = 'TRANSVERSAL' and area is null)
      );
  end if;
end $$;

create index if not exists catalog_taxonomy_nodes_scope_idx on public.catalog_taxonomy_nodes (scope);

-- 5) Validação pai/filho no banco: filho herda exatamente scope + area do pai,
--    e um pai com filhos não pode mudar de scope/area.
create or replace function public.catalog_taxonomy_parent_consistency()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  p_scope text;
  p_area  text;
begin
  if new.parent_id is not null then
    select scope, area into p_scope, p_area
    from public.catalog_taxonomy_nodes where id = new.parent_id;
    if not found then
      raise exception 'catalog_taxonomy_nodes: pai inexistente para %', new.code using errcode = '23503';
    end if;
    if p_scope is distinct from new.scope or p_area is distinct from new.area then
      raise exception 'catalog_taxonomy_nodes: % deve ter o mesmo scope/area do pai (%/%)', new.code, p_scope, coalesce(p_area, 'NULL')
        using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE'
     and (old.scope is distinct from new.scope or old.area is distinct from new.area)
     and exists (
       select 1 from public.catalog_taxonomy_nodes c
       where c.parent_id = new.id
         and (c.scope is distinct from new.scope or c.area is distinct from new.area)
     ) then
    raise exception 'catalog_taxonomy_nodes: % tem filhos; não pode mudar scope/area', new.code using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_catalog_taxonomy_parent_consistency on public.catalog_taxonomy_nodes;
create trigger trg_catalog_taxonomy_parent_consistency
  before insert or update of parent_id, scope, area on public.catalog_taxonomy_nodes
  for each row execute function public.catalog_taxonomy_parent_consistency();

comment on column public.catalog_taxonomy_nodes.scope is
  'AREA = nó de área comercial (area obrigatória). TRANSVERSAL = domínio transversal do catálogo (INFRA), area NULL; não é área comercial.';
