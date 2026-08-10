-- Instâncias de relatório preenchido + respostas por campo. Requer 0018/0023.
-- Idempotente.

create table if not exists public.reports (
  id              uuid primary key default gen_random_uuid(),
  template_codigo text not null,
  tipo            text not null
                  check (tipo in ('LEVANTAMENTO', 'CORRETIVA', 'PREVENTIVA')),
  cliente_id      text references public.clients(id) on delete set null,
  contrato_id     text,           -- preventiva vinculada a contrato
  os_id           text,           -- corretiva vinculada a OS
  tecnico_nome    text,
  tecnico_uid     uuid default auth.uid(),
  titulo          text,
  local           text,
  status          text not null default 'rascunho'
                  check (status in ('rascunho', 'finalizado', 'cancelado')),
  iniciado_em     timestamptz not null default now(),
  finalizado_em   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists reports_cliente_idx on public.reports (cliente_id);
create index if not exists reports_tecnico_idx on public.reports (tecnico_uid);

-- Respostas por campo (uma linha por campo; repeater usa repeater_idx).
create table if not exists public.report_answers (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.reports(id) on delete cascade,
  secao       text,
  field_key   text not null,
  valor       jsonb,             -- valor: texto/número/select/array/objeto
  repeater_idx int,              -- índice do card quando o campo é repeater
  created_at  timestamptz not null default now()
);

create index if not exists report_answers_report_idx on public.report_answers (report_id);

-- Helper: o usuário atual é dono do relatório (técnico) OU admin/gestor.
create or replace function public.owns_report(rid uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1 from public.reports r
    where r.id = rid
      and (r.tecnico_uid = auth.uid() or public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'))
  );
$$;
grant execute on function public.owns_report(uuid) to authenticated;

alter table public.reports enable row level security;
alter table public.report_answers enable row level security;
grant select, insert, update, delete on public.reports to authenticated;
grant select, insert, update, delete on public.report_answers to authenticated;

-- reports: técnico vê/edita os próprios; ADMIN/GESTOR veem/editam todos.
drop policy if exists "reports select" on public.reports;
create policy "reports select"
  on public.reports for select
  to authenticated
  using (tecnico_uid = auth.uid() or public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));

drop policy if exists "reports insert" on public.reports;
create policy "reports insert"
  on public.reports for insert
  to authenticated
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'TECNICO'));

drop policy if exists "reports update" on public.reports;
create policy "reports update"
  on public.reports for update
  to authenticated
  using (tecnico_uid = auth.uid() or public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'))
  with check (tecnico_uid = auth.uid() or public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));

drop policy if exists "reports delete" on public.reports;
create policy "reports delete"
  on public.reports for delete
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));

-- report_answers: acompanham a posse do relatório.
drop policy if exists "report_answers select" on public.report_answers;
create policy "report_answers select"
  on public.report_answers for select
  to authenticated
  using (public.owns_report(report_id));

drop policy if exists "report_answers insert" on public.report_answers;
create policy "report_answers insert"
  on public.report_answers for insert
  to authenticated
  with check (public.owns_report(report_id));

drop policy if exists "report_answers update" on public.report_answers;
create policy "report_answers update"
  on public.report_answers for update
  to authenticated
  using (public.owns_report(report_id))
  with check (public.owns_report(report_id));

drop policy if exists "report_answers delete" on public.report_answers;
create policy "report_answers delete"
  on public.report_answers for delete
  to authenticated
  using (public.owns_report(report_id));
