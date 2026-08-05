-- Contratos de manutenção/serviço. Requer 0004/0005 (auth_role). Idempotente.

create table if not exists public.contracts (
  id                 text primary key,
  client_name        text not null,
  unit               text,
  monthly_value      numeric default 0,
  renewal_date       text,
  readjustment_index text,
  contracted_hours   numeric default 0,
  used_hours         numeric default 0,
  status             text default 'ATIVO',
  responsible_tech   text,
  art_document_ref   text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.contracts enable row level security;

grant select, insert, update, delete on public.contracts to authenticated;

-- Leitura: ADMIN, GESTOR e FINANCEIRO (donos/usuários do módulo)
drop policy if exists "contracts select" on public.contracts;
create policy "contracts select"
  on public.contracts for select
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'));

-- Escrita: ADMIN, GESTOR e FINANCEIRO
drop policy if exists "contracts insert" on public.contracts;
create policy "contracts insert"
  on public.contracts for insert
  to authenticated
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'));

drop policy if exists "contracts update" on public.contracts;
create policy "contracts update"
  on public.contracts for update
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'));

drop policy if exists "contracts delete" on public.contracts;
create policy "contracts delete"
  on public.contracts for delete
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'));
