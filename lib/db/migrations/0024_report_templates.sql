-- Templates de relatório técnico (schema JSON de seções e campos consumido
-- pelo motor de formulários). Requer 0004/0005 (auth_role). Idempotente.

create table if not exists public.report_templates (
  id         uuid primary key default gen_random_uuid(),
  codigo     text unique not null,            -- LEVANTAMENTO_SDAI, CORRETIVA_SDAI, PREVENTIVA_SDAI
  nome       text not null,
  tipo       text not null
             check (tipo in ('LEVANTAMENTO', 'CORRETIVA', 'PREVENTIVA')),
  schema     jsonb not null default '{}'::jsonb,  -- seções + campos (inclui repeater)
  ativo      boolean not null default true,
  versao     int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.report_templates enable row level security;
grant select, insert, update, delete on public.report_templates to authenticated;

-- Leitura: todos os autenticados (o técnico precisa do template para preencher).
drop policy if exists "report_templates select" on public.report_templates;
create policy "report_templates select"
  on public.report_templates for select
  to authenticated
  using (true);

-- Gestão do catálogo de templates: apenas ADMINISTRATIVO.
drop policy if exists "report_templates write" on public.report_templates;
create policy "report_templates write"
  on public.report_templates for all
  to authenticated
  using (public.auth_role() = 'ADMINISTRATIVO')
  with check (public.auth_role() = 'ADMINISTRATIVO');
