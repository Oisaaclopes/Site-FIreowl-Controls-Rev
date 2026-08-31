-- FASE 3.2 — Passada 2: comparações Antes × Depois entre field_photos.
-- Uma comparação é uma RELAÇÃO; nunca duplica imagem/metadata. As field_photos
-- seguem sendo a fonte de verdade (ON DELETE CASCADE só remove a relação, não
-- as fotos). Não altera 0064/0066. Idempotente.

create table if not exists public.field_photo_comparisons (
  id uuid primary key default gen_random_uuid(),
  before_photo_id uuid not null references public.field_photos(id) on delete cascade,
  after_photo_id  uuid not null references public.field_photos(id) on delete cascade,
  client_id text not null references public.clients(id),
  report_id uuid references public.reports(id) on delete set null,
  os_id uuid references public.ordens_servico(id) on delete set null,
  pendencia_id uuid references public.pendencias(id) on delete set null,
  titulo text,
  descricao text,
  resultado text check (resultado in ('corrigido','parcial','pendente')),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint field_photo_comparisons_distinct check (before_photo_id <> after_photo_id)
);

-- Dedup: A+B e B+A são a mesma dupla (índice sobre o par normalizado).
create unique index if not exists field_photo_comparisons_pair_key
  on public.field_photo_comparisons (least(before_photo_id, after_photo_id), greatest(before_photo_id, after_photo_id));
create index if not exists field_photo_comparisons_client_idx
  on public.field_photo_comparisons (client_id, created_at desc);

alter table public.field_photo_comparisons enable row level security;
grant select, insert, update, delete on public.field_photo_comparisons to authenticated;

-- Dono de UMA foto: técnico da sessão OU papel administrativo/gestor. SECURITY
-- DEFINER com search_path fixo; não abre profiles nem outras tabelas com PII.
create or replace function public.owns_field_photo(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.field_photos fp
      join public.field_photo_sessions s on s.id = fp.session_id
     where fp.id = pid
       and (s.tecnico_id = auth.uid() or public.auth_role() in ('ADMINISTRATIVO','GESTOR'))
  );
$$;
grant execute on function public.owns_field_photo(uuid) to authenticated;

-- Acesso à comparação exige acesso às DUAS fotos relacionadas.
drop policy if exists "field photo comparisons read" on public.field_photo_comparisons;
create policy "field photo comparisons read" on public.field_photo_comparisons for select to authenticated
  using (public.owns_field_photo(before_photo_id) and public.owns_field_photo(after_photo_id));

drop policy if exists "field photo comparisons write" on public.field_photo_comparisons;
create policy "field photo comparisons write" on public.field_photo_comparisons for all to authenticated
  using (public.owns_field_photo(before_photo_id) and public.owns_field_photo(after_photo_id))
  with check (public.owns_field_photo(before_photo_id) and public.owns_field_photo(after_photo_id));
