-- Trilha de auditoria PERSISTIDA (Parte 3 regra 3). Antes era só em memória.
-- Toda ação do módulo de relatórios (e demais) grava aqui. Requer 0004/0005.
-- Idempotente.

create table if not exists public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  ts         timestamptz not null default now(),
  user_id    uuid default auth.uid(),
  user_name  text,
  user_role  text,
  action     text not null,
  module     text,
  details    text,
  ip         text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_ts_idx on public.audit_logs (ts desc);
create index if not exists audit_logs_module_idx on public.audit_logs (module);

alter table public.audit_logs enable row level security;
grant select, insert on public.audit_logs to authenticated;

-- Inserir: qualquer autenticado registra a própria ação.
drop policy if exists "audit insert" on public.audit_logs;
create policy "audit insert" on public.audit_logs for insert
  to authenticated with check (true);

-- Ler: ADMIN e GESTOR (trilha é de supervisão).
drop policy if exists "audit select" on public.audit_logs;
create policy "audit select" on public.audit_logs for select
  to authenticated using (public.auth_role() in ('ADMINISTRATIVO','GESTOR'));
