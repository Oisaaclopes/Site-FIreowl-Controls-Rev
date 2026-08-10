-- Mídia (fotos) dos relatórios, com geo/timestamp de origem. A "bandeja de
-- não classificadas" é simplesmente report_media com answer_id = null.
-- Requer 0025_reports e 0023_devices. Idempotente.

create table if not exists public.report_media (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references public.reports(id) on delete cascade,
  answer_id    uuid references public.report_answers(id) on delete set null, -- null = bandeja
  pendencia_id uuid,                                                          -- vínculo direto (opcional)
  device_id    uuid references public.devices(id) on delete set null,
  storage_path text not null,        -- caminho no bucket privado de mídia
  rotulo       text check (rotulo in ('antes', 'depois') or rotulo is null),
  nota_rapida  text,
  grupo        text,                 -- chip de grupo atribuído na captura
  lat          double precision,
  lng          double precision,
  accuracy     double precision,
  captured_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists report_media_report_idx on public.report_media (report_id);
create index if not exists report_media_answer_idx on public.report_media (answer_id);
create index if not exists report_media_bandeja_idx on public.report_media (report_id) where answer_id is null;

alter table public.report_media enable row level security;
grant select, insert, update, delete on public.report_media to authenticated;

-- Acompanha a posse do relatório (helper public.owns_report de 0025).
drop policy if exists "report_media select" on public.report_media;
create policy "report_media select"
  on public.report_media for select
  to authenticated
  using (public.owns_report(report_id));

drop policy if exists "report_media insert" on public.report_media;
create policy "report_media insert"
  on public.report_media for insert
  to authenticated
  with check (public.owns_report(report_id));

drop policy if exists "report_media update" on public.report_media;
create policy "report_media update"
  on public.report_media for update
  to authenticated
  using (public.owns_report(report_id))
  with check (public.owns_report(report_id));

drop policy if exists "report_media delete" on public.report_media;
create policy "report_media delete"
  on public.report_media for delete
  to authenticated
  using (public.owns_report(report_id));
