-- Módulo "Experiência, Clientes e Marcas" (apresentação institucional das
-- propostas). Duas entidades novas — NÃO mistura com `brands` (homologação de
-- fornecedores) nem com `clients`. Áreas e segmentos como text[] (relacional o
-- suficiente; o admin pode digitar novos). Requer 0037 (company_profile) e a
-- função public.auth_role(). Idempotente.

-- ============ Empresas atendidas (clientes de destaque) ============
create table if not exists public.empresas_atendidas (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  nome_fantasia    text,
  logo_path        text,
  descricao        text,
  segmentos        text[] not null default '{}',
  areas            text[] not null default '{}',
  destaque         boolean not null default false,
  ativo            boolean not null default true,
  exibir_proposta  boolean not null default true,
  -- nao_informado | autorizado | nao_autorizado
  autorizacao      text not null default 'nao_informado',
  ordem            int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ============ Marcas e tecnologias (fabricantes reconhecidos) ============
create table if not exists public.marcas_tecnologias (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  logo_path        text,
  descricao        text,
  categoria        text,
  areas            text[] not null default '{}',
  tecnologias      text[] not null default '{}',
  ativo            boolean not null default true,
  exibir_proposta  boolean not null default true,
  ordem            int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ============ Identidade visual + textos institucionais + limites ============
alter table public.company_profile add column if not exists logo_principal_path text;
alter table public.company_profile add column if not exists logo_claro_path     text;
alter table public.company_profile add column if not exists logo_escuro_path    text;
alter table public.company_profile add column if not exists logo_icone_path     text;
alter table public.company_profile add column if not exists exp_intro           text;
alter table public.company_profile add column if not exists tech_intro          text;
alter table public.company_profile add column if not exists exp_max_empresas    int not null default 8;
alter table public.company_profile add column if not exists exp_max_marcas      int not null default 8;

-- ============ RLS ============
alter table public.empresas_atendidas  enable row level security;
alter table public.marcas_tecnologias  enable row level security;
grant select, insert, update, delete on public.empresas_atendidas to authenticated;
grant select, insert, update, delete on public.marcas_tecnologias to authenticated;

-- Todos os perfis leem (as propostas usam esses dados).
drop policy if exists "empresas_atendidas select" on public.empresas_atendidas;
create policy "empresas_atendidas select" on public.empresas_atendidas for select to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO', 'TECNICO'));
drop policy if exists "empresas_atendidas write" on public.empresas_atendidas;
create policy "empresas_atendidas write" on public.empresas_atendidas for all to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));

drop policy if exists "marcas_tecnologias select" on public.marcas_tecnologias;
create policy "marcas_tecnologias select" on public.marcas_tecnologias for select to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO', 'TECNICO'));
drop policy if exists "marcas_tecnologias write" on public.marcas_tecnologias;
create policy "marcas_tecnologias write" on public.marcas_tecnologias for all to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));
