-- ETAPA 3B.4 — ITEM DE EVIDÊNCIA do atendimento.
--
-- Auditoria: NÃO existe entidade equivalente. Hoje a foto (field_photos) carrega
-- momento (evidence_moment, 0087) e equipamento (0086), mas as fotos ANTES/
-- DURANTE/DEPOIS não têm como se agrupar por "o que foi trabalhado" (uma sirene,
-- um acionador, um eletroduto). field_photo_comparisons resolve só o par
-- Antes×Depois, não a unidade técnica com N fotos por momento. Por isso criamos
-- o Item de Evidência como identidade própria, e ligamos as fotos a ele.
--
-- Aditiva, idempotente, não-destrutiva. Independe da 0086. NÃO edita 0083/0084/
-- 0085/0087. Requer 0083 (service_attendances), 0033/0073 (ordens_servico),
-- 0064 (field_photos), 0005 (auth_role).

-- 1) Tabela do Item ---------------------------------------------------------
create table if not exists public.service_attendance_evidence_items (
  id                    uuid primary key default gen_random_uuid(),
  service_attendance_id uuid not null references public.service_attendances(id) on delete cascade,
  work_order_id         uuid references public.ordens_servico(id) on delete set null,
  title                 text not null,
  category              text not null default 'EQUIPAMENTO'
                        check (category in ('EQUIPAMENTO','INFRAESTRUTURA','CABEAMENTO','CENTRAL','OUTRO')),
  location              text,           -- local/setor (ex.: "Corredor dos carrinhos")
  device_address        text,          -- endereço técnico do dispositivo (ex.: "42", "L1-125")
  catalog_item_id       text,          -- inventory_items.id quando veio do catálogo (sem FK: pode ser manual/legado)
  manufacturer          text,          -- fabricante (catálogo OU manual)
  model                 text,          -- modelo (catálogo OU manual)
  notes                 text,
  -- Resultado por item (§26). Opcional; o resultado do ATENDIMENTO é outro campo.
  status                text check (status is null or status in
                          ('PENDENTE','RESOLVIDO','PARCIALMENTE_RESOLVIDO','NAO_RESOLVIDO')),
  created_by            uuid default auth.uid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists saei_attendance_idx on public.service_attendance_evidence_items (service_attendance_id);
create index if not exists saei_os_idx         on public.service_attendance_evidence_items (work_order_id);

drop trigger if exists saei_set_updated_at on public.service_attendance_evidence_items;
create trigger saei_set_updated_at
  before update on public.service_attendance_evidence_items
  for each row execute function public.set_updated_at();

-- 2) field_photos ganha o vínculo NULLABLE ao Item (fotos avulsas continuam) --
alter table public.field_photos
  add column if not exists evidence_item_id uuid
    references public.service_attendance_evidence_items(id) on delete set null;

comment on column public.field_photos.evidence_item_id is
  'Item de Evidência (3B.4) a que a foto pertence. NULL = foto avulsa/Registro '
  'Rápido/central geral. on delete set null: apagar o Item não apaga as fotos.';

create index if not exists field_photos_evidence_item_idx
  on public.field_photos (evidence_item_id)
  where evidence_item_id is not null;

-- 3) RLS — dono do atendimento (técnico) ou gestão. Sem service role. --------
alter table public.service_attendance_evidence_items enable row level security;
grant select, insert, update, delete on public.service_attendance_evidence_items to authenticated;

-- Helper: o item pertence a um atendimento que o usuário pode gerenciar.
create or replace function public.owns_attendance_item(p_attendance_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.service_attendances sa
    where sa.id = p_attendance_id
      and (public.auth_role() in ('ADMINISTRATIVO','GESTOR') or sa.technician_id = auth.uid())
  );
$$;
grant execute on function public.owns_attendance_item(uuid) to authenticated;

drop policy if exists "evidence items read" on public.service_attendance_evidence_items;
create policy "evidence items read" on public.service_attendance_evidence_items for select to authenticated
  using (
    public.auth_role() in ('ADMINISTRATIVO','GESTOR','FINANCEIRO')
    or public.owns_attendance_item(service_attendance_id)
  );

drop policy if exists "evidence items write" on public.service_attendance_evidence_items;
create policy "evidence items write" on public.service_attendance_evidence_items for all to authenticated
  using (public.owns_attendance_item(service_attendance_id))
  with check (public.owns_attendance_item(service_attendance_id));

-- 4) Realtime — reaproveita a publicação existente (sem canal novo, §44). -----
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'service_attendance_evidence_items'
  ) then
    execute 'alter publication supabase_realtime add table public.service_attendance_evidence_items';
  end if;
end $$;
