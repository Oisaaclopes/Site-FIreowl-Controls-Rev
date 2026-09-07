-- OPERACIONAL — PAUSA/RETOMADA DE ATENDIMENTO (§2/§3 do QA).
-- Distingue "atendimento ABERTO" de "técnico OCUPADO": um atendimento pode ficar
-- PAUSADO (aguardando material, clima, acesso, terceiro, retorno, fim de jornada,
-- impedimento técnico) sem que o técnico continue ocupado — liberando-o para
-- outro atendimento. O histórico de pausas/retomadas é preservado em uma tabela
-- de eventos IMUTÁVEL (fonte canônica da linha do tempo e do tempo efetivo).
--
-- Requer: 0083 (service_attendances + índice one_active_per_tech), 0074/0068
-- (auth_role). ADITIVA e idempotente. NÃO edita 0107 nem migrations anteriores.
-- REVISAR e rodar no SQL Editor do Supabase — o agente não aplica migrations.

-- =====================================================================
-- 1) STATUS: adiciona PAUSADO ao CHECK (aberto: EM_EXECUCAO|PAUSADO; fechado:
-- FINALIZADO). O índice de exclusividade (0083) é `where status='EM_EXECUCAO'`
-- e NÃO é tocado — logo PAUSADO não conta como técnico ocupado (§1/§13).
-- =====================================================================
alter table public.service_attendances
  drop constraint if exists service_attendances_status_check;
alter table public.service_attendances
  add constraint service_attendances_status_check
  check (status in ('EM_EXECUCAO','PAUSADO','FINALIZADO'));

-- =====================================================================
-- 2) EVENTOS — histórico operacional imutável do atendimento (§2/§7).
-- STARTED/PAUSED/RESUMED/FINALIZED. `reason` é CÓDIGO canônico (só PAUSED);
-- `note` é texto complementar opcional. Preserva MÚLTIPLAS pausas (não há
-- sobrescrita de paused_at/resumed_at no attendance).
-- =====================================================================
create table if not exists public.service_attendance_events (
  id                    uuid primary key default gen_random_uuid(),
  service_attendance_id uuid not null references public.service_attendances(id) on delete cascade,
  technician_id         uuid references public.profiles(id) on delete set null,
  type                  text not null check (type in ('STARTED','PAUSED','RESUMED','FINALIZED')),
  reason                text
                        check (reason is null or reason in
                          ('AGUARDANDO_MATERIAL','CONDICAO_CLIMATICA','AGUARDANDO_ACESSO',
                           'DEPENDENCIA_TERCEIRO','RETORNO_SOLICITADO_CLIENTE','FIM_JORNADA',
                           'IMPEDIMENTO_TECNICO','OUTRO')),
  note                  text,
  created_by            uuid default auth.uid(),
  created_at            timestamptz not null default now()
);
create index if not exists sae_attendance_created_idx
  on public.service_attendance_events (service_attendance_id, created_at);

alter table public.service_attendance_events enable row level security;

-- Leitura: técnico dono do atendimento OU gestão (§3). Escrita direta do cliente
-- é BLOQUEADA (sem policy de insert/update/delete) — o histórico é imutável e só
-- cresce por RPC/trigger SECURITY DEFINER (INSERT via domínio, §3). Grant só SELECT.
grant select on public.service_attendance_events to authenticated;
drop policy if exists "sae select" on public.service_attendance_events;
create policy "sae select" on public.service_attendance_events for select to authenticated
  using (
    public.auth_role() in ('ADMINISTRATIVO','GESTOR','FINANCEIRO')
    or exists (
      select 1 from public.service_attendances s
      where s.id = service_attendance_events.service_attendance_id
        and s.technician_id = auth.uid()
    )
  );

-- =====================================================================
-- 3) TRIGGER — STARTED e FINALIZED automáticos e ATÔMICOS com a própria
-- escrita do atendimento, cobrindo TODOS os caminhos (OS, contratual, offline
-- replay) sem depender de cada fluxo lembrar de registrar (§7/§9). PAUSED e
-- RESUMED NÃO passam por aqui — são inseridos pelas RPCs (carregam motivo).
-- SECURITY DEFINER: grava o evento mesmo com RLS de escrita fechada.
-- =====================================================================
create or replace function public.log_service_attendance_event() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.service_attendance_events (service_attendance_id, technician_id, type, created_by)
    values (new.id, new.technician_id, 'STARTED', auth.uid());
  elsif tg_op = 'UPDATE'
        and new.status = 'FINALIZADO'
        and new.status is distinct from old.status then
    insert into public.service_attendance_events (service_attendance_id, technician_id, type, created_by)
    values (new.id, new.technician_id, 'FINALIZED', auth.uid());
  end if;
  return null; -- AFTER trigger
end;
$$;

drop trigger if exists service_attendances_log_started on public.service_attendances;
create trigger service_attendances_log_started
  after insert on public.service_attendances
  for each row execute function public.log_service_attendance_event();

drop trigger if exists service_attendances_log_finalized on public.service_attendances;
create trigger service_attendances_log_finalized
  after update on public.service_attendances
  for each row execute function public.log_service_attendance_event();

-- =====================================================================
-- 4) RPC pause_service_attendance — EM_EXECUCAO → PAUSADO (atômico, §5).
-- Autoriza o técnico DONO ou gestão. Insere PAUSED (motivo/observação/autoria)
-- e muda o status na MESMA transação. Não permite PAUSADO→PAUSADO nem
-- FINALIZADO→PAUSADO. NÃO toca jornada/OS/operação (§14).
-- =====================================================================
create or replace function public.pause_service_attendance(
  p_attendance_id uuid,
  p_reason        text,
  p_note          text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_att    public.service_attendances%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_note   text := nullif(btrim(coalesce(p_note, '')), '');
  v_event  uuid;
begin
  if auth.uid() is null then raise exception 'nao autenticado'; end if;

  select * into v_att from public.service_attendances where id = p_attendance_id for update;
  if not found then raise exception 'atendimento % nao encontrado', p_attendance_id; end if;

  -- Autorização: dono do atendimento OU gestão. A exclusividade e a checagem
  -- valem pelo technician_id do atendimento, não por quem clicou (§13).
  if not (v_att.technician_id = auth.uid()
          or public.auth_role() in ('ADMINISTRATIVO','GESTOR')) then
    raise exception 'sem permissao para pausar este atendimento';
  end if;

  if v_att.status <> 'EM_EXECUCAO' then
    raise exception 'atendimento em status % nao pode ser pausado', v_att.status using errcode = 'P0001';
  end if;
  if v_reason is null then
    raise exception 'motivo da pausa obrigatorio' using errcode = 'P0001';
  end if;
  if v_reason not in ('AGUARDANDO_MATERIAL','CONDICAO_CLIMATICA','AGUARDANDO_ACESSO',
                      'DEPENDENCIA_TERCEIRO','RETORNO_SOLICITADO_CLIENTE','FIM_JORNADA',
                      'IMPEDIMENTO_TECNICO','OUTRO') then
    raise exception 'motivo de pausa invalido: %', v_reason using errcode = 'P0001';
  end if;

  insert into public.service_attendance_events (service_attendance_id, technician_id, type, reason, note, created_by)
  values (v_att.id, v_att.technician_id, 'PAUSED', v_reason, v_note, auth.uid())
  returning id into v_event;

  update public.service_attendances
     set status = 'PAUSADO', updated_at = now()
   where id = v_att.id
   returning * into v_att;

  return jsonb_build_object('success', true, 'attendance', to_jsonb(v_att), 'event_id', v_event);
end;
$$;
revoke all on function public.pause_service_attendance(uuid, text, text) from public;
grant execute on function public.pause_service_attendance(uuid, text, text) to authenticated;

-- =====================================================================
-- 5) RPC resume_service_attendance — PAUSADO → EM_EXECUCAO (atômico, §6/§13).
-- Valida exclusividade pelo technician_id: se o técnico já tiver OUTRO
-- atendimento EM_EXECUCAO, NÃO retoma e devolve o atendimento bloqueador
-- (success=false) para a UI mostrar Cliente/OS/Serviço. O índice único da 0083
-- é o backstop (23505 → também devolve bloqueio). Não cria OS/atendimento/
-- relatório/draft. Mesmo técnico responsável (não troca).
-- =====================================================================
create or replace function public.resume_service_attendance(
  p_attendance_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_att    public.service_attendances%rowtype;
  v_active public.service_attendances%rowtype;
begin
  if auth.uid() is null then raise exception 'nao autenticado'; end if;

  select * into v_att from public.service_attendances where id = p_attendance_id for update;
  if not found then raise exception 'atendimento % nao encontrado', p_attendance_id; end if;

  if not (v_att.technician_id = auth.uid()
          or public.auth_role() in ('ADMINISTRATIVO','GESTOR')) then
    raise exception 'sem permissao para retomar este atendimento';
  end if;

  if v_att.status <> 'PAUSADO' then
    raise exception 'atendimento em status % nao pode ser retomado', v_att.status using errcode = 'P0001';
  end if;

  -- Exclusividade pelo TECHNICIAN_ID do atendimento (§13): outro EM_EXECUCAO bloqueia.
  select * into v_active
    from public.service_attendances
   where technician_id = v_att.technician_id
     and status = 'EM_EXECUCAO'
     and id <> v_att.id
   order by started_at desc
   limit 1;
  if found then
    return jsonb_build_object('success', false, 'reason', 'ACTIVE_EXISTS', 'active', to_jsonb(v_active));
  end if;

  begin
    update public.service_attendances
       set status = 'EM_EXECUCAO', updated_at = now()
     where id = v_att.id
     returning * into v_att;
  exception when unique_violation then
    -- Corrida com o índice one_active_per_tech (0083): outro atendimento assumiu
    -- EM_EXECUCAO entre a checagem e o update. Devolve o bloqueio, sem retomar.
    select * into v_active
      from public.service_attendances
     where technician_id = v_att.technician_id and status = 'EM_EXECUCAO'
     order by started_at desc limit 1;
    return jsonb_build_object('success', false, 'reason', 'ACTIVE_EXISTS', 'active', to_jsonb(v_active));
  end;

  insert into public.service_attendance_events (service_attendance_id, technician_id, type, created_by)
  values (v_att.id, v_att.technician_id, 'RESUMED', auth.uid());

  return jsonb_build_object('success', true, 'attendance', to_jsonb(v_att));
end;
$$;
revoke all on function public.resume_service_attendance(uuid) from public;
grant execute on function public.resume_service_attendance(uuid) to authenticated;

-- =====================================================================
-- 6) REALTIME (§17) — a UI reflete pausa/retomada entre telas/dispositivos a
-- partir da mudança de status em service_attendances (já na publicação desde a
-- 0083). Adiciona service_attendance_events à publicação de forma idempotente
-- para telas que renderizam a linha do tempo em tempo real.
-- =====================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'service_attendance_events'
  ) then
    execute 'alter publication supabase_realtime add table public.service_attendance_events';
  end if;
end $$;

-- =====================================================================
-- COMPATIBILIDADE (§8): atendimentos criados ANTES da 0108 não têm evento
-- STARTED. NÃO há backfill (não inventa horário). A camada de domínio usa
-- service_attendances.started_at como âncora inicial quando não existe STARTED;
-- a primeira ação pós-0108 (PAUSED/RESUMED/FINALIZED) já entra como evento real.
-- =====================================================================
