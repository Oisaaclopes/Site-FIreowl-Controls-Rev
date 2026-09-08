-- Ocorrências operacionais observadas em campo, sem duplicar a Base Técnica.
-- `devices` continua canônico; esta tabela preserva estado aberto/resolvido,
-- origem e snapshots inclusive quando o ativo ainda não existe na Base.

create table if not exists public.device_occurrences (
  id                    uuid primary key,
  dedupe_key            text not null unique,
  cliente_id            text references public.clients(id) on delete cascade,
  device_id             uuid references public.devices(id) on delete set null,
  occurrence_type       text not null check (occurrence_type in ('FAULT','DISABLED','ALARM')),
  status                text not null default 'OPEN' check (status in ('OPEN','RESOLVED')),
  observed_at           timestamptz not null default now(),
  resolved_at           timestamptz,
  resolved_by           uuid,
  source_type           text not null default 'PREVENTIVA' check (source_type in ('PREVENTIVA','CORRETIVA','ATENDIMENTO','MANUAL')),
  report_id             uuid references public.reports(id) on delete set null,
  work_order_id         uuid references public.ordens_servico(id) on delete set null,
  service_attendance_id uuid references public.service_attendances(id) on delete set null,
  pendencia_id          uuid references public.pendencias(id) on delete set null,
  loop_snapshot         text,
  address_snapshot      text,
  identification_snapshot text,
  manufacturer_snapshot text,
  model_snapshot        text,
  location_snapshot     text,
  notes                 text,
  created_by            uuid default auth.uid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists device_occurrences_client_status_idx
  on public.device_occurrences (cliente_id, status, occurrence_type);
create index if not exists device_occurrences_device_idx
  on public.device_occurrences (device_id, observed_at desc) where device_id is not null;

drop trigger if exists device_occurrences_set_updated_at on public.device_occurrences;
create trigger device_occurrences_set_updated_at before update on public.device_occurrences
  for each row execute function public.set_updated_at();

alter table public.device_occurrences enable row level security;
grant select, insert, update, delete on public.device_occurrences to authenticated;

drop policy if exists "device occurrences select" on public.device_occurrences;
create policy "device occurrences select" on public.device_occurrences for select to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'));
drop policy if exists "device occurrences insert" on public.device_occurrences;
create policy "device occurrences insert" on public.device_occurrences for insert to authenticated
  with check (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'));
drop policy if exists "device occurrences update" on public.device_occurrences;
create policy "device occurrences update" on public.device_occurrences for update to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'))
  with check (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='device_occurrences'
  ) then
    alter publication supabase_realtime add table public.device_occurrences;
  end if;
end $$;

