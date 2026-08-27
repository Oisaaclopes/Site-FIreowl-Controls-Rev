-- Perfil da empresa (dados que aparecem nos documentos): razão social, nome
-- fantasia, CNPJ, contato, regime tributário, logotipo e a biblioteca de textos
-- institucionais (§8). Tabela singleton: uma única linha (id = 1). Antes disso o
-- perfil só existia em memória (padrão vindo do código). Idempotente.

create table if not exists public.company_profile (
  id                 int primary key default 1 check (id = 1),
  razao_social       text not null default 'Fireowl Controls Technology Ltda.',
  nome_fantasia      text,
  cnpj               text,
  endereco           text,
  telefone           text,
  email              text,
  regime_tributario  text,
  logo_url           text,
  apresentacao_geral text,
  apresentacao_areas jsonb not null default '{}'::jsonb,
  updated_at         timestamptz not null default now()
);

alter table public.company_profile enable row level security;
grant select, insert, update on public.company_profile to authenticated;

-- Todos os perfis leem (os documentos usam esses dados).
drop policy if exists "company_profile select" on public.company_profile;
create policy "company_profile select" on public.company_profile for select to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO', 'TECNICO'));

-- Só administrativo/gestor edita os dados da empresa.
drop policy if exists "company_profile insert" on public.company_profile;
create policy "company_profile insert" on public.company_profile for insert to authenticated
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));

drop policy if exists "company_profile update" on public.company_profile;
create policy "company_profile update" on public.company_profile for update to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));
