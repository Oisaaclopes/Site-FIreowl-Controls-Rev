-- Clientes (carteira). Requer 0004/0005 (auth_role). Idempotente.

create table if not exists public.clients (
  id                    text primary key,
  code                  text,
  name                  text not null,
  cnpj                  text,
  segment               text,
  contract_status       text default 'EM DIA',
  last_os_date          text,
  last_os_type          text,
  address               text,
  contacts              jsonb not null default '[]'::jsonb,
  total_contracts_value numeric default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.clients enable row level security;

grant select, insert, update, delete on public.clients to authenticated;

-- Leitura: ADMIN, GESTOR e FINANCEIRO (donos/usuários do módulo)
drop policy if exists "clients select" on public.clients;
create policy "clients select"
  on public.clients for select
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'));

-- Escrita: ADMIN, GESTOR e FINANCEIRO
drop policy if exists "clients insert" on public.clients;
create policy "clients insert"
  on public.clients for insert
  to authenticated
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'));

drop policy if exists "clients update" on public.clients;
create policy "clients update"
  on public.clients for update
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'));

drop policy if exists "clients delete" on public.clients;
create policy "clients delete"
  on public.clients for delete
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'));
