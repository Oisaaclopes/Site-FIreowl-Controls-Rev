-- Fornecedores homologados. Requer 0004/0005 (auth_role). Idempotente.

create table if not exists public.suppliers (
  id             text primary key,
  code           text,
  name           text not null,
  cnpj           text,
  category       text,
  contact_name   text,
  phone          text,
  email          text,
  city           text,
  rating         numeric default 0,
  lead_time_days integer default 0,
  active_status  text default 'HOMOLOGADO',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.suppliers enable row level security;

grant select, insert, update, delete on public.suppliers to authenticated;

-- Leitura: ADMIN, FINANCEIRO (donos do módulo) e GESTOR (usa no estoque)
drop policy if exists "suppliers select" on public.suppliers;
create policy "suppliers select"
  on public.suppliers for select
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'FINANCEIRO', 'GESTOR'));

-- Escrita: ADMIN e FINANCEIRO
drop policy if exists "suppliers insert" on public.suppliers;
create policy "suppliers insert"
  on public.suppliers for insert
  to authenticated
  with check (public.auth_role() in ('ADMINISTRATIVO', 'FINANCEIRO'));

drop policy if exists "suppliers update" on public.suppliers;
create policy "suppliers update"
  on public.suppliers for update
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'FINANCEIRO'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'FINANCEIRO'));

drop policy if exists "suppliers delete" on public.suppliers;
create policy "suppliers delete"
  on public.suppliers for delete
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'FINANCEIRO'));
