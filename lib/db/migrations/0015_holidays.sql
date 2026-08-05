-- Feriados (Nacional/Estadual/Municipal/Facultativo). Requer 0004/0005. Idempotente.

create table if not exists public.holidays (
  ref_date     date primary key,
  name         text not null,
  type         text not null default 'Nacional',
  is_recurring boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table public.holidays enable row level security;

grant select, insert, update, delete on public.holidays to authenticated;

-- Todos os autenticados leem os feriados
drop policy if exists "holidays select" on public.holidays;
create policy "holidays select"
  on public.holidays for select
  to authenticated
  using (true);

-- Só ADMINISTRATIVO gerencia
drop policy if exists "holidays write" on public.holidays;
create policy "holidays write"
  on public.holidays for all
  to authenticated
  using (public.auth_role() = 'ADMINISTRATIVO')
  with check (public.auth_role() = 'ADMINISTRATIVO');

-- Carga 2026 — Londrina/PR
insert into public.holidays (ref_date, name, type, is_recurring) values
  ('2026-01-01', 'Confraternização Universal', 'Nacional', true),
  ('2026-02-17', 'Carnaval', 'Facultativo', false),
  ('2026-04-03', 'Paixão de Cristo (Sexta-feira Santa)', 'Nacional', false),
  ('2026-04-21', 'Tiradentes', 'Nacional', true),
  ('2026-05-01', 'Dia do Trabalhador', 'Nacional', true),
  ('2026-06-04', 'Corpus Christi', 'Nacional', false),
  ('2026-06-12', 'Sagrado Coração de Jesus (Padroeiro)', 'Municipal', false),
  ('2026-09-07', 'Independência do Brasil', 'Nacional', true),
  ('2026-10-12', 'Nossa Senhora Aparecida', 'Nacional', true),
  ('2026-11-02', 'Finados', 'Nacional', true),
  ('2026-11-15', 'Proclamação da República', 'Nacional', true),
  ('2026-11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'Nacional', true),
  ('2026-12-10', 'Aniversário de Londrina', 'Municipal', true),
  ('2026-12-25', 'Natal', 'Nacional', true)
on conflict (ref_date) do nothing;
