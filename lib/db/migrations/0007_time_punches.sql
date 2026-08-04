-- Registros de ponto (folha de frequência) — versão enxuta (sem foto).
-- Requer 0004 e 0005 aplicadas (profiles + auth_role). Idempotente.

create table if not exists public.time_punches (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  employee_name text,
  type         text not null check (type in ('ENTRADA', 'PAUSA', 'RETORNO', 'SAIDA')),
  punched_at   timestamptz not null default now(),
  lat          double precision,
  lng          double precision,
  accuracy     integer,
  status       text not null default 'APROVADO',
  created_at   timestamptz not null default now()
);

create index if not exists time_punches_user_idx on public.time_punches (user_id);
create index if not exists time_punches_at_idx on public.time_punches (punched_at desc);

alter table public.time_punches enable row level security;

grant select, insert on public.time_punches to authenticated;

-- Cada um registra o próprio ponto
drop policy if exists "punches insert own" on public.time_punches;
create policy "punches insert own"
  on public.time_punches for insert
  to authenticated
  with check (user_id = auth.uid());

-- Cada um vê o próprio ponto; ADMINISTRATIVO e GESTOR veem todos (auditoria)
drop policy if exists "punches select" on public.time_punches;
create policy "punches select"
  on public.time_punches for select
  to authenticated
  using (user_id = auth.uid() or public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));
