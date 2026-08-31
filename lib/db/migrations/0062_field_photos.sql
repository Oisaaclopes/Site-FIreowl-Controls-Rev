-- FASE 3.1 — evidências independentes de relatório.
-- Não altera report_media: ela continua vinculada obrigatoriamente a reports.

create table if not exists public.field_photo_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(id),
  local_setor text,
  tecnico_id uuid not null default auth.uid(),
  tecnico_nome text,
  iniciado_em timestamptz not null default now(),
  finalizado_em timestamptz,
  client_uuid uuid not null default gen_random_uuid(),
  sync_status text not null default 'sincronizado' check (sync_status in ('pendente','sincronizado','erro')),
  created_at timestamptz not null default now()
);
create unique index if not exists field_photo_sessions_client_uuid_key on public.field_photo_sessions(client_uuid);
create index if not exists field_photo_sessions_client_idx on public.field_photo_sessions(client_id, iniciado_em desc);

create table if not exists public.field_photos (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.field_photo_sessions(id) on delete cascade,
  client_id text not null references public.clients(id),
  report_id uuid references public.reports(id) on delete set null,
  os_id uuid references public.ordens_servico(id) on delete set null,
  pendencia_id uuid references public.pendencias(id) on delete set null,
  storage_path_original text not null,
  storage_path_markup text,
  storage_path_evidencia text,
  nota_rapida text,
  marcador text check (marcador in ('antes','depois','falha','corrigido','pendente')),
  capturado_em timestamptz not null,
  geo jsonb,
  client_uuid uuid not null default gen_random_uuid(),
  sync_status text not null default 'sincronizado' check (sync_status in ('pendente','sincronizado','erro')),
  created_at timestamptz not null default now()
);
create unique index if not exists field_photos_client_uuid_key on public.field_photos(client_uuid);
create index if not exists field_photos_session_idx on public.field_photos(session_id, capturado_em);
create index if not exists field_photos_unclassified_idx on public.field_photos(client_id, capturado_em desc) where report_id is null and os_id is null and pendencia_id is null;

alter table public.field_photo_sessions enable row level security;
alter table public.field_photos enable row level security;
grant select, insert, update, delete on public.field_photo_sessions, public.field_photos to authenticated;

create or replace function public.owns_field_photo_session(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.field_photo_sessions s where s.id = sid
    and (s.tecnico_id = auth.uid() or public.auth_role() in ('ADMINISTRATIVO','GESTOR')));
$$;
grant execute on function public.owns_field_photo_session(uuid) to authenticated;

create policy "field photo sessions read" on public.field_photo_sessions for select to authenticated
  using (tecnico_id = auth.uid() or public.auth_role() in ('ADMINISTRATIVO','GESTOR'));
create policy "field photo sessions write" on public.field_photo_sessions for all to authenticated
  using (tecnico_id = auth.uid() or public.auth_role() in ('ADMINISTRATIVO','GESTOR'))
  with check (tecnico_id = auth.uid() or public.auth_role() in ('ADMINISTRATIVO','GESTOR'));
create policy "field photos read" on public.field_photos for select to authenticated
  using (public.owns_field_photo_session(session_id));
create policy "field photos write" on public.field_photos for all to authenticated
  using (public.owns_field_photo_session(session_id)) with check (public.owns_field_photo_session(session_id));
