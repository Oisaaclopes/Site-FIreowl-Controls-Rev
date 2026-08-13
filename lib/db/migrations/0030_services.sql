-- Catálogo de Serviços persistido (antes era mock em memória). Alimenta o
-- autocomplete_catalogo do motor de relatórios junto com o Estoque.
-- Requer 0004/0005 (auth_role). Idempotente.

create table if not exists public.services (
  id             text primary key,
  code           text,
  title          text not null,
  category       text,
  standard_value numeric default 0,
  estimated_hours numeric default 0,
  nbr_norm_ref   text,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.services enable row level security;
grant select, insert, update, delete on public.services to authenticated;

-- Leitura: todos os autenticados (técnico usa no autocomplete).
drop policy if exists "services select" on public.services;
create policy "services select" on public.services for select
  to authenticated using (true);

-- Escrita: ADMIN e GESTOR.
drop policy if exists "services write" on public.services;
create policy "services write" on public.services for all
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR'))
  with check (public.auth_role() in ('ADMINISTRATIVO','GESTOR'));
