-- ETAPA 3D — Levantamentos técnicos + histórico de verificação de ativos.
--
-- technical_surveys: um levantamento (PONTUAL/PARCIAL/COMPLETO) por área, que
-- alimenta a Base Técnica incrementalmente (§6A). device_verifications: histórico
-- de condição por ativo (nunca sobrescreve o passado, §8/§73/§106). field_photos
-- ganha vínculo opcional a ativo e a levantamento (evidência da verificação).
--
-- Aditiva, idempotente. Requer 0018 (clients), 0029/0094 (devices), 0064
-- (field_photos), 0005 (auth_role). NÃO edita migrações aplicadas.

-- 1) Levantamentos --------------------------------------------------------------
create table if not exists public.technical_surveys (
  id                 uuid primary key default gen_random_uuid(),
  cliente_id         text not null references public.clients(id) on delete cascade,
  area               text not null
                     check (area in ('SDAI','CFTV','CONTROLE_ACESSO','BMS','ALARME')),
  mode               text not null default 'PONTUAL'
                     check (mode in ('PONTUAL','PARCIAL','COMPLETO')),
  scope              jsonb not null default '{}'::jsonb,   -- escopo declarado (setor/laço/gravador…)
  status             text not null default 'EM_ANDAMENTO'
                     check (status in ('EM_ANDAMENTO','FINALIZADO','CANCELADO')),
  expected_count     integer,                               -- base/checklist (COMPLETO/PARCIAL)
  verified_count     integer not null default 0,
  notes              text,
  created_by         uuid default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  finished_at        timestamptz
);
create index if not exists surveys_cliente_idx on public.technical_surveys (cliente_id, area);

drop trigger if exists technical_surveys_set_updated_at on public.technical_surveys;
create trigger technical_surveys_set_updated_at
  before update on public.technical_surveys
  for each row execute function public.set_updated_at();

-- 2) Verificações (histórico de condição por ativo) -----------------------------
create table if not exists public.device_verifications (
  id            uuid primary key default gen_random_uuid(),
  device_id     uuid not null references public.devices(id) on delete cascade,
  cliente_id    text references public.clients(id) on delete set null,
  survey_id     uuid references public.technical_surveys(id) on delete set null,
  condicao      text not null
                check (condicao in ('NORMAL','COM_AVARIA','INOPERANTE','NAO_TESTADO','NAO_LOCALIZADO','INADEQUADO')),
  -- Reconciliação no COMPLETO (§43/§6J): como o ativo apareceu nesta verificação.
  reconciliation text
                check (reconciliation is null or reconciliation in ('VERIFICADO','NAO_LOCALIZADO','NOVO','DUPLICADO','ALTERADO')),
  notes         text,
  verified_by   uuid default auth.uid(),
  verified_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index if not exists device_verifications_device_idx on public.device_verifications (device_id, verified_at desc);
create index if not exists device_verifications_survey_idx on public.device_verifications (survey_id);

-- 3) field_photos: evidência ligada a ativo / levantamento ----------------------
alter table public.field_photos
  add column if not exists device_id           uuid references public.devices(id) on delete set null,
  add column if not exists technical_survey_id uuid references public.technical_surveys(id) on delete set null;
create index if not exists field_photos_device_idx on public.field_photos (device_id) where device_id is not null;

-- 4) RLS — técnico opera em campo; gestão administra ----------------------------
alter table public.technical_surveys   enable row level security;
alter table public.device_verifications enable row level security;
grant select, insert, update, delete on public.technical_surveys   to authenticated;
grant select, insert, update, delete on public.device_verifications to authenticated;

drop policy if exists "surveys select" on public.technical_surveys;
create policy "surveys select" on public.technical_surveys for select to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'));
drop policy if exists "surveys write" on public.technical_surveys;
create policy "surveys write" on public.technical_surveys for all to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'))
  with check (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'));

drop policy if exists "verifications select" on public.device_verifications;
create policy "verifications select" on public.device_verifications for select to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'));
drop policy if exists "verifications write" on public.device_verifications;
create policy "verifications write" on public.device_verifications for all to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'))
  with check (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'));

-- 5) Realtime — reaproveita a publicação existente (sem canal novo). ------------
do $$
declare t text; tables text[] := array['technical_surveys','device_verifications'];
begin
  foreach t in array tables loop
    if to_regclass(format('public.%I', t)) is not null
       and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
