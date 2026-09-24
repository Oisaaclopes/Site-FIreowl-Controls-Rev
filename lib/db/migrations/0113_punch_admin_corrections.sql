-- 0113 — Correção ADMINISTRATIVA do ponto via ajustes efetivos (Rodada 2A).
--
-- Escopo: somente a correção administrativa. Fechamento mensal / assinatura /
-- snapshot ficam para uma migration posterior (Rodada 2B).
--
-- Princípios:
--   * time_punches é EVIDÊNCIA ORIGINAL: nunca sobrescrita nem apagada.
--   * Toda correção é uma linha em punch_adjustments (quem, quando, motivo,
--     valor original e valor efetivo). Correção nova SUBSTITUI a anterior
--     (status SUBSTITUIDO) — nada é editado nem apagado.
--   * Funcionário só SOLICITA (nasce PENDENTE). Gestor/administrativo corrige
--     com efeito imediato pela RPC punch_admin_correct (auditada).
--
-- Requer 0014, 0017, 0061/0068 (auth_role / is_active_profile), 0080.
-- Idempotente. Não altera nenhum time_punches.

begin;

-- ---------------------------------------------------------------------------
-- 1) Semântica e auditoria do ajuste
-- ---------------------------------------------------------------------------
alter table public.punch_adjustments
  add column if not exists action text not null default 'AJUSTE',
  add column if not exists origin text not null default 'SOLICITACAO',
  add column if not exists created_by uuid default auth.uid() references auth.users(id) on delete set null,
  add column if not exists created_by_name text,
  add column if not exists original_at timestamptz,
  add column if not exists replaces_adjustment_id uuid references public.punch_adjustments(id) on delete restrict,
  add column if not exists superseded_at timestamptz,
  add column if not exists superseded_by uuid references auth.users(id) on delete set null;

-- Reexecução segura: os gatilhos (recriados abaixo) não podem barrar o backfill.
drop trigger if exists punch_adjustments_link_original_trg on public.punch_adjustments;
drop trigger if exists punch_adjustments_guard_update_trg on public.punch_adjustments;

-- Linhas existentes: todas foram solicitações do próprio funcionário (a RLS de
-- insert sempre exigiu user_id = auth.uid()). Autoria = user_id; horário
-- original copiado da batida vinculada (quando há vínculo).
update public.punch_adjustments set created_by = user_id where created_by is null;
update public.punch_adjustments a
   set original_at = tp.punched_at
  from public.time_punches tp
 where a.original_punch_id = tp.id and a.original_at is null;

alter table public.punch_adjustments drop constraint if exists punch_adj_action_chk;
alter table public.punch_adjustments add constraint punch_adj_action_chk
  check (action in ('AJUSTE', 'INCLUSAO', 'DESCONSIDERAR'));

alter table public.punch_adjustments drop constraint if exists punch_adj_origin_chk;
alter table public.punch_adjustments add constraint punch_adj_origin_chk
  check (origin in ('SOLICITACAO', 'ADMINISTRATIVO'));

-- Novo status SUBSTITUIDO (correção posterior aprovada no lugar desta).
alter table public.punch_adjustments drop constraint if exists punch_adjustments_status_check;
alter table public.punch_adjustments drop constraint if exists punch_adj_status_chk;
alter table public.punch_adjustments add constraint punch_adj_status_chk
  check (status in ('PENDENTE', 'APROVADO', 'REJEITADO', 'SUBSTITUIDO'));

-- Desconsiderar precisa de um alvo (batida original ou inclusão anterior).
alter table public.punch_adjustments drop constraint if exists punch_adj_discard_target_chk;
alter table public.punch_adjustments add constraint punch_adj_discard_target_chk
  check (action <> 'DESCONSIDERAR' or original_punch_id is not null or replaces_adjustment_id is not null);

-- Ajuste/inclusão aprovado exige horário. NOT VALID: não reprova legado.
alter table public.punch_adjustments drop constraint if exists punch_adj_time_required_chk;
alter table public.punch_adjustments add constraint punch_adj_time_required_chk
  check (action = 'DESCONSIDERAR' or status <> 'APROVADO'
         or (requested_time is not null and btrim(requested_time) <> '')) not valid;

create index if not exists punch_adj_ref_date_idx on public.punch_adjustments (ref_date);

-- ---------------------------------------------------------------------------
-- 2) Quem administra o ponto (fonte única no banco)
-- ---------------------------------------------------------------------------
create or replace function public.can_manage_time_clock() returns boolean
language sql stable security definer set search_path = public as $$
  select public.auth_role() in ('ADMINISTRATIVO', 'GESTOR');
$$;
revoke all on function public.can_manage_time_clock() from public, anon;
grant execute on function public.can_manage_time_clock() to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Integridade do vínculo com a batida original (insert e update)
--    * a batida referenciada precisa ser do MESMO funcionário do ajuste;
--    * original_at é sempre copiado do banco (nunca vem do cliente).
-- ---------------------------------------------------------------------------
create or replace function public.punch_adjustments_link_original() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_at timestamptz;
begin
  if new.original_punch_id is null then
    if tg_op = 'INSERT' then new.original_at := null; end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.original_punch_id is not distinct from old.original_punch_id then
    return new;
  end if;
  select user_id, punched_at into v_owner, v_at from public.time_punches where id = new.original_punch_id;
  if v_owner is null then
    raise exception 'Batida original inexistente.' using errcode = '23503';
  end if;
  if v_owner <> new.user_id then
    raise exception 'A batida original pertence a outro funcionário.' using errcode = '42501';
  end if;
  new.original_at := v_at;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 4) Imutabilidade do ajuste: o conteúdo nunca muda; só transições de status
--    PENDENTE → APROVADO | REJEITADO  (revisão)
--    APROVADO → SUBSTITUIDO           (correção posterior)
-- ---------------------------------------------------------------------------
create or replace function public.punch_adjustments_guard_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if row(new.user_id, new.employee_name, new.ref_date, new.type, new.requested_time, new.reason,
         new.action, new.origin, new.created_by, new.created_by_name, new.created_at,
         new.original_at, new.replaces_adjustment_id)
     is distinct from
     row(old.user_id, old.employee_name, old.ref_date, old.type, old.requested_time, old.reason,
         old.action, old.origin, old.created_by, old.created_by_name, old.created_at,
         old.original_at, old.replaces_adjustment_id) then
    raise exception 'Ajuste de ponto é imutável: registre uma nova correção.' using errcode = '42501';
  end if;
  -- Vínculo à batida original só pode ser preenchido na aprovação de uma
  -- solicitação que ainda não o tinha (fluxo legado).
  if new.original_punch_id is distinct from old.original_punch_id
     and not (old.original_punch_id is null and old.status = 'PENDENTE' and new.status = 'APROVADO') then
    raise exception 'Vínculo com a batida original é imutável.' using errcode = '42501';
  end if;

  if old.status = 'PENDENTE' and new.status in ('APROVADO', 'REJEITADO') then
    if new.superseded_at is not null or new.superseded_by is not null then
      raise exception 'Transição inválida.' using errcode = '42501';
    end if;
    return new;
  end if;
  if old.status = 'APROVADO' and new.status = 'SUBSTITUIDO' then
    if row(new.reviewed_at, new.reviewed_by, new.reviewer_name, new.reviewer_note)
       is distinct from row(old.reviewed_at, old.reviewed_by, old.reviewer_name, old.reviewer_note) then
      raise exception 'Dados da revisão são imutáveis.' using errcode = '42501';
    end if;
    -- Autoria da substituição sempre registrada pelo banco (nunca pelo cliente).
    new.superseded_at := now();
    new.superseded_by := auth.uid();
    return new;
  end if;
  raise exception 'Transição de status % → % não permitida.', old.status, new.status using errcode = '42501';
end $$;

create trigger punch_adjustments_link_original_trg
  before insert or update on public.punch_adjustments
  for each row execute function public.punch_adjustments_link_original();

create trigger punch_adjustments_guard_update_trg
  before update on public.punch_adjustments
  for each row execute function public.punch_adjustments_guard_update();

-- ---------------------------------------------------------------------------
-- 5) RLS de punch_adjustments
--    Brecha corrigida: antes o funcionário podia inserir o próprio ajuste já
--    com status APROVADO (a policy só checava user_id).
-- ---------------------------------------------------------------------------
drop policy if exists "adj insert own" on public.punch_adjustments;
drop policy if exists "adj insert request" on public.punch_adjustments;
create policy "adj insert request"
  on public.punch_adjustments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and created_by = auth.uid()
    and status = 'PENDENTE'
    and origin = 'SOLICITACAO'
    and action in ('AJUSTE', 'INCLUSAO')
    and reviewed_at is null and reviewed_by is null
    and reviewer_name is null and reviewer_note is null
    and replaces_adjustment_id is null
    and superseded_at is null and superseded_by is null
  );
-- Correção administrativa NÃO entra por insert direto: só pela RPC abaixo.
-- "adj select" (próprio ou ADMIN/GESTOR) e "adj update" (ADMIN/GESTOR) seguem
-- da 0014; o update agora é limitado pelo gatilho de imutabilidade acima.

-- ---------------------------------------------------------------------------
-- 6) time_punches = evidência original imutável
--    * remove UPDATE direto por ADMIN/GESTOR (0017): contradizia a auditoria.
--      A Edge Function reverse-geocode usa service_role (não depende disso).
--    * INSERT volta a ser só do próprio funcionário: gestor não fabrica
--      "batida original" de terceiros — inclusão é INCLUSAO auditada.
-- ---------------------------------------------------------------------------
drop policy if exists "punches update" on public.time_punches;
revoke update on public.time_punches from authenticated;

drop policy if exists "punches insert" on public.time_punches;
drop policy if exists "punches insert own" on public.time_punches;
create policy "punches insert own"
  on public.time_punches for insert
  to authenticated
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 7) RPC — correção administrativa com efeito imediato
--    AJUSTE        corrige horário de uma batida (original) ou de uma
--                  inclusão anterior (p_replaces_adjustment_id).
--    INCLUSAO      adiciona batida ausente (sem original).
--    DESCONSIDERAR retira uma batida original (ou revoga uma inclusão) do
--                  cálculo. A batida continua em time_punches.
--    Ajuste APROVADO anterior sobre o mesmo alvo vira SUBSTITUIDO.
-- ---------------------------------------------------------------------------
create or replace function public.punch_admin_correct(
  p_user_id uuid,
  p_action text,
  p_type text,
  p_ref_date date,
  p_requested_time text,
  p_reason text,
  p_original_punch_id uuid default null,
  p_replaces_adjustment_id uuid default null
) returns public.punch_adjustments
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_employee_name text;
  v_punch public.time_punches%rowtype;
  v_prev public.punch_adjustments%rowtype;
  v_original uuid := p_original_punch_id;
  v_action text := p_action;
  v_row public.punch_adjustments%rowtype;
begin
  if not public.can_manage_time_clock() then
    raise exception 'Sem permissão para corrigir o ponto.' using errcode = '42501';
  end if;
  if p_action not in ('AJUSTE', 'INCLUSAO', 'DESCONSIDERAR') then
    raise exception 'Ação inválida: %.', p_action using errcode = '22023';
  end if;
  if p_type not in ('ENTRADA', 'PAUSA', 'RETORNO', 'SAIDA') then
    raise exception 'Tipo de batida inválido: %.', p_type using errcode = '22023';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Motivo obrigatório.' using errcode = '22023';
  end if;
  if p_ref_date is null then
    raise exception 'Data obrigatória.' using errcode = '22023';
  end if;
  if p_action <> 'DESCONSIDERAR'
     and (p_requested_time is null or p_requested_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$') then
    raise exception 'Horário obrigatório no formato HH:MM.' using errcode = '22023';
  end if;

  -- Alvo anterior (inclusão/ajuste já aprovado) sendo substituído.
  if p_replaces_adjustment_id is not null then
    select * into v_prev from public.punch_adjustments where id = p_replaces_adjustment_id for update;
    if not found or v_prev.status <> 'APROVADO' or v_prev.user_id <> p_user_id then
      raise exception 'Ajuste a substituir inexistente ou não vigente.' using errcode = '22023';
    end if;
    v_original := coalesce(v_original, v_prev.original_punch_id);
    -- Corrigir o horário de uma batida INCLUÍDA (sem original) continua sendo
    -- uma inclusão — agora com o horário corrigido.
    if p_action = 'AJUSTE' and v_original is null then v_action := 'INCLUSAO'; end if;
  end if;

  if p_action = 'INCLUSAO' then
    if v_original is not null or p_replaces_adjustment_id is not null then
      raise exception 'Inclusão não referencia batida existente.' using errcode = '22023';
    end if;
  elsif v_original is null and p_replaces_adjustment_id is null then
    raise exception 'Informe a batida a corrigir/desconsiderar.' using errcode = '22023';
  end if;

  if v_original is not null then
    select * into v_punch from public.time_punches where id = v_original;
    if not found or v_punch.user_id <> p_user_id then
      raise exception 'Batida original inexistente ou de outro funcionário.' using errcode = '42501';
    end if;
    if v_punch.type <> p_type then
      raise exception 'O tipo da correção deve ser o mesmo da batida original (%).', v_punch.type using errcode = '22023';
    end if;
  end if;

  select coalesce(nullif(p.name, ''), p.full_name) into v_actor_name from public.profiles p where p.id = v_actor;
  -- Mesmo nome das batidas do funcionário (a apuração cruza userId/nome).
  select tp.employee_name into v_employee_name
    from public.time_punches tp
   where tp.user_id = p_user_id and coalesce(tp.employee_name, '') <> ''
   order by tp.punched_at desc limit 1;
  if v_employee_name is null then
    select coalesce(nullif(p.name, ''), p.full_name) into v_employee_name from public.profiles p where p.id = p_user_id;
  end if;
  if v_employee_name is null then
    raise exception 'Funcionário inexistente.' using errcode = '22023';
  end if;

  -- Substitui o que estava vigente sobre o mesmo alvo (nunca apaga).
  update public.punch_adjustments
     set status = 'SUBSTITUIDO', superseded_at = now(), superseded_by = v_actor
   where status = 'APROVADO'
     and ((v_original is not null and original_punch_id = v_original)
          or id = p_replaces_adjustment_id);

  insert into public.punch_adjustments (
    user_id, employee_name, ref_date, type, requested_time, reason, status,
    action, origin, created_by, created_by_name,
    original_punch_id, replaces_adjustment_id,
    reviewed_at, reviewed_by, reviewer_name, reviewer_note
  ) values (
    p_user_id, v_employee_name, p_ref_date, p_type,
    case when p_action = 'DESCONSIDERAR' then null else left(p_requested_time, 5) end,
    btrim(p_reason), 'APROVADO',
    v_action, 'ADMINISTRATIVO', v_actor, v_actor_name,
    v_original, p_replaces_adjustment_id,
    now(), v_actor, v_actor_name, 'Correção administrativa'
  ) returning * into v_row;

  return v_row;
end $$;

revoke all on function public.punch_admin_correct(uuid, text, text, date, text, text, uuid, uuid) from public, anon;
grant execute on function public.punch_admin_correct(uuid, text, text, date, text, text, uuid, uuid) to authenticated;

commit;
