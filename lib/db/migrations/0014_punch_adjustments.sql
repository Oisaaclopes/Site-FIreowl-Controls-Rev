-- Solicitações de ajuste de ponto. Requer 0004/0005 (auth_role). Idempotente.

create table if not exists public.punch_adjustments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  employee_name  text,
  ref_date       date not null,
  type           text not null check (type in ('ENTRADA', 'PAUSA', 'RETORNO', 'SAIDA')),
  requested_time text,
  reason         text,
  status         text not null default 'PENDENTE' check (status in ('PENDENTE', 'APROVADO', 'REJEITADO')),
  reviewer_note  text,
  created_at     timestamptz not null default now(),
  reviewed_at    timestamptz
);

create index if not exists punch_adj_status_idx on public.punch_adjustments (status);
create index if not exists punch_adj_user_idx on public.punch_adjustments (user_id);

alter table public.punch_adjustments enable row level security;

grant select, insert, update on public.punch_adjustments to authenticated;

-- Cada um cria a própria solicitação
drop policy if exists "adj insert own" on public.punch_adjustments;
create policy "adj insert own"
  on public.punch_adjustments for insert
  to authenticated
  with check (user_id = auth.uid());

-- Vê as próprias; ADMIN e GESTOR veem todas
drop policy if exists "adj select" on public.punch_adjustments;
create policy "adj select"
  on public.punch_adjustments for select
  to authenticated
  using (user_id = auth.uid() or public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));

-- Aprovar/rejeitar: só ADMIN e GESTOR
drop policy if exists "adj update" on public.punch_adjustments;
create policy "adj update"
  on public.punch_adjustments for update
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));
