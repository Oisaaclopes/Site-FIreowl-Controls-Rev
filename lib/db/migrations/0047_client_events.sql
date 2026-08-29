-- Notas e eventos comerciais/operacionais que complementam o histórico automático do cliente.
create table if not exists public.client_events (
  id text primary key,
  client_id text not null references public.clients(id) on delete cascade,
  event_type text not null default 'nota',
  content text not null,
  author_name text,
  created_at timestamptz not null default now()
);

create index if not exists client_events_client_created_idx on public.client_events(client_id, created_at desc);

alter table public.client_events enable row level security;
grant select, insert, delete on public.client_events to authenticated;

drop policy if exists "client events select" on public.client_events;
create policy "client events select" on public.client_events for select to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO', 'TECNICO'));

drop policy if exists "client events insert" on public.client_events;
create policy "client events insert" on public.client_events for insert to authenticated
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO', 'TECNICO'));

drop policy if exists "client events delete" on public.client_events;
create policy "client events delete" on public.client_events for delete to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));
