-- Ocorrências do dia por funcionário: observação, atestado, feriado.
-- Requer 0004/0005 (auth_role). Idempotente.

create table if not exists public.day_entries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  employee_name    text,
  ref_date         date not null,
  kind             text not null default 'OBSERVACAO'
                   check (kind in ('OBSERVACAO', 'ATESTADO', 'FERIADO', 'FOLGA')),
  note             text,
  certificate_path text, -- caminho do atestado no Storage privado (employee-docs)
  author_name      text,
  author_role      text,
  created_at       timestamptz not null default now()
);

create index if not exists day_entries_user_idx on public.day_entries (user_id, ref_date);

alter table public.day_entries enable row level security;

grant select, insert, delete on public.day_entries to authenticated;

-- Inserir: o próprio funcionário (para si) OU admin/gestor (para qualquer um)
drop policy if exists "day_entries insert" on public.day_entries;
create policy "day_entries insert"
  on public.day_entries for insert
  to authenticated
  with check (user_id = auth.uid() or public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));

-- Ver: as próprias OU admin/gestor
drop policy if exists "day_entries select" on public.day_entries;
create policy "day_entries select"
  on public.day_entries for select
  to authenticated
  using (user_id = auth.uid() or public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));

-- Excluir: o autor (dono) OU admin/gestor
drop policy if exists "day_entries delete" on public.day_entries;
create policy "day_entries delete"
  on public.day_entries for delete
  to authenticated
  using (user_id = auth.uid() or public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));
