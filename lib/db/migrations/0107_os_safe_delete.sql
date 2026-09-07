-- OPERACIONAL — EXCLUSÃO SEGURA DE OS SEM HISTÓRICO TÉCNICO (§9).
-- Hard delete de EXCEÇÃO para OS criada por engano/teste OU gerada por rotina
-- contratual e nunca executada (status aberta/agendada, sem NENHUMA evidência
-- técnica). Complementa — NÃO substitui — o delete_os_if_unused (0074), que
-- cobre apenas OS avulsa 'aberta' virgem e BLOQUEIA execução de rotina.
--
-- Por que uma RPC nova e SECURITY DEFINER: o guard PRECISA enxergar TODAS as
-- evidências, inclusive as ocultas por RLS restritiva (transactions só ADMIN/
-- FINANCEIRO; field_photos só o dono da sessão; device_verifications policy
-- própria). Com INVOKER o guard contaria zero e liberaria delete erroneamente.
-- A operação é transacional/atômica: valida, religa a execução da rotina, apaga
-- atendimento(s) comprovadamente vazio(s) e a OS — nunca por CASCADE cego.
--
-- Requer: 0033 (ordens_servico + pendencia_ids), 0056 (contract_routine_executions,
-- contract_hour_ledger), 0057/0059 (generate_os_from_execution), 0064 (field_photos),
-- 0067 (field_photo_comparisons), 0074 (auth_role/lifecycle), 0083 (service_attendances),
-- 0088 (service_attendance_evidence_items), 0091 (assinatura), 0095/0098
-- (device_verifications + contexto de OS/atendimento), 0106 (reports.service_attendance_id).
-- ADITIVA e idempotente. REVISAR e rodar no SQL Editor do Supabase — o agente não
-- aplica migrations em produção. NÃO editar/reaplicar migrations anteriores.

-- =====================================================================
-- 1) Ledger de números de OS APOSENTADOS (§10 — nunca reutilizar número).
-- A numeração OS-AAAA-NNNN é derivada de max()+1 sobre ordens_servico. Ao apagar
-- fisicamente uma OS o número sairia da tabela e o próximo max() o reemitiria.
-- Este ledger preserva os números já emitidos para que a geração some-os ao
-- teto. Cresce só por exclusão (sem backfill; começa vazio). Somente leitura
-- para o app; a escrita ocorre exclusivamente dentro da RPC DEFINER abaixo.
-- =====================================================================
create table if not exists public.retired_os_numbers (
  numero      text primary key,
  os_id       uuid,                    -- id da OS excluída (referência histórica; sem FK — a OS deixou de existir)
  retired_at  timestamptz not null default now(),
  retired_by  uuid references public.profiles(id) on delete set null
);
create index if not exists retired_os_numbers_ano_idx
  on public.retired_os_numbers (numero);

alter table public.retired_os_numbers enable row level security;
grant select on public.retired_os_numbers to authenticated;
-- Leitura liberada (a geração de número — SECURITY INVOKER — precisa somar o
-- teto aposentado). Sem policy de escrita: clientes não inserem/alteram; só a
-- RPC DEFINER (que roda como owner e ignora RLS) grava aqui.
drop policy if exists "retired os numbers read" on public.retired_os_numbers;
create policy "retired os numbers read" on public.retired_os_numbers
  for select to authenticated using (true);

-- =====================================================================
-- 2) Geração de número de OS passa a considerar o teto APOSENTADO.
-- Redefine generate_os_from_execution (versão viva: 0059) preservando corpo,
-- locks e mapeamento de tipo — muda APENAS o cálculo do próximo número, que
-- passa a ser greatest(teto em ordens_servico, teto em retired_os_numbers) + 1.
-- Assim a OS de rotina (única criadora destas OS descartáveis) nunca reemite um
-- número aposentado. Mantém o mesmo advisory lock anual (serialização).
-- =====================================================================
create or replace function public.generate_os_from_execution(
  p_execution_id uuid,
  p_prioridade text default 'media',
  p_titulo text default null,
  p_descricao text default null
) returns jsonb
language plpgsql
security invoker
as $$
declare
  ex public.contract_routine_executions%rowtype;
  rot public.contract_routines%rowtype;
  ctr public.contracts%rowtype;
  v_tipo text; v_numero text; v_seq integer; v_ano integer := extract(year from current_date);
  v_os uuid; v_titulo text; v_desc text; v_num_existente text;
begin
  select * into ex from public.contract_routine_executions where id = p_execution_id for update;
  if not found then raise exception 'execucao % nao encontrada', p_execution_id; end if;
  if ex.ordem_servico_id is not null then
    select numero into v_num_existente from public.ordens_servico where id = ex.ordem_servico_id;
    return jsonb_build_object('os_id', ex.ordem_servico_id, 'numero', v_num_existente, 'already_existed', true, 'status', ex.status);
  end if;

  select * into rot from public.contract_routines where id = ex.routine_id;
  select * into ctr from public.contracts where id = ex.contract_id;
  v_tipo := case rot.tipo when 'preventiva' then 'preventiva' when 'corretiva' then 'corretiva' when 'instalacao' then 'instalacao' else 'outro' end;

  -- Serialização anual: evita que duas competências recebam o mesmo próximo número.
  perform pg_advisory_xact_lock(hashtextextended('fireowl:os:number:' || v_ano::text, 0));
  -- Teto = maior número VIVO ou APOSENTADO do ano (§10: não reutiliza número).
  select greatest(
           coalesce((select max(nullif(split_part(numero, '-', 3), '')::int)
                       from public.ordens_servico where numero like 'OS-' || v_ano || '-%'), 0),
           coalesce((select max(nullif(split_part(numero, '-', 3), '')::int)
                       from public.retired_os_numbers where numero like 'OS-' || v_ano || '-%'), 0)
         ) into v_seq;
  v_numero := 'OS-' || v_ano || '-' || lpad((v_seq + 1)::text, 4, '0');
  v_titulo := coalesce(nullif(trim(p_titulo), ''), initcap(coalesce(rot.tipo, 'preventiva')) || coalesce(' ' || rot.area, '') || ' — ' || ex.competencia);
  v_desc := coalesce(nullif(trim(p_descricao), ''), 'Gerada da rotina contratual. Contrato ' || ctr.id || ', competência ' || ex.competencia || coalesce(' · janela ' || rot.horario_inicio || '–' || rot.horario_fim, '') || coalesce(' · SLA ' || rot.sla, '') || coalesce(' · ' || rot.qtd_tecnicos || ' técnico(s)', ''));
  insert into public.ordens_servico(numero, cliente_id, contrato_id, tipo, titulo, descricao, status, prioridade, data_prevista)
  values (v_numero, ctr.client_id, ctr.id, v_tipo, v_titulo, v_desc, 'agendada', coalesce(nullif(p_prioridade, ''), 'media'), ex.data_programada)
  returning id into v_os;
  update public.contract_routine_executions set ordem_servico_id = v_os, status = 'os_gerada' where id = ex.id;
  return jsonb_build_object('os_id', v_os, 'numero', v_numero, 'already_existed', false, 'status', 'os_gerada');
end;
$$;
grant execute on function public.generate_os_from_execution(uuid, text, text, text) to authenticated;

-- =====================================================================
-- 3) RPC delete_contract_os_if_clean — HARD DELETE seguro e atômico.
-- SECURITY DEFINER (vê evidência oculta por RLS), search_path fixo, ADMIN/GESTOR.
-- Elegível: status aberta/agendada, SEM histórico técnico. Bloqueia com a
-- mensagem de domínio ao encontrar QUALQUER vínculo relevante. Atendimento só é
-- removido junto quando comprovadamente VAZIO. Execução de rotina é RELIGADA
-- (ordem_servico_id NULL, os_gerada → agendado) para poder gerar nova OS sem
-- duplicar (UNIQUE(routine,competencia) intacto). NÃO usa CASCADE para decidir.
-- =====================================================================
create or replace function public.delete_contract_os_if_clean(
  p_os_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_os          public.ordens_servico%rowtype;
  v_numero      text;
  v_att_total   integer;
  v_att_content integer;
  v_exec_reset  integer;
  c_preserve constant text := 'Esta OS possui histórico técnico e deve ser preservada.';
begin
  -- Autenticação e papel (TÉCNICO nunca exclui administrativamente).
  if auth.uid() is null then
    raise exception 'nao autenticado';
  end if;
  if public.auth_role() not in ('ADMINISTRATIVO', 'GESTOR') then
    raise exception 'sem permissao para excluir OS';
  end if;

  select * into v_os from public.ordens_servico where id = p_os_id for update;
  if not found then
    raise exception 'OS % nao encontrada', p_os_id;
  end if;
  v_numero := v_os.numero;

  -- ---- Elegibilidade por status (§2). Só aberta/agendada; cancelada/concluida/
  -- em_execucao representam ato operacional e são preservadas (conservador). ----
  if v_os.status not in ('aberta', 'agendada') then
    raise exception '%', c_preserve using errcode = 'P0001';
  end if;

  -- ---- Pendências que originaram a OS (§3) — vínculo por pendencia_ids. --------
  if coalesce(array_length(v_os.pendencia_ids, 1), 0) > 0 then
    raise exception '%', c_preserve using errcode = 'P0001';
  end if;

  -- ---- Relatório vinculado por QUALQUER caminho (§3). -------------------------
  if v_os.report_id is not null then
    raise exception '%', c_preserve using errcode = 'P0001';
  end if;
  if exists (select 1 from public.reports r
              where r.os_id = p_os_id::text
                 or (v_numero is not null and r.os_id = v_numero)) then
    raise exception '%', c_preserve using errcode = 'P0001';
  end if;
  -- Relatório de atendimento (0106): reports.service_attendance_id → atendimento desta OS.
  if exists (select 1 from public.reports r
              join public.service_attendances s on s.id = r.service_attendance_id
              where s.work_order_id = p_os_id) then
    raise exception '%', c_preserve using errcode = 'P0001';
  end if;

  -- ---- Verificações de dispositivo (teste) por OS ou por atendimento (§3). ----
  if exists (select 1 from public.device_verifications v
              where v.work_order_id = p_os_id
                 or v.service_attendance_id in
                    (select id from public.service_attendances where work_order_id = p_os_id)) then
    raise exception '%', c_preserve using errcode = 'P0001';
  end if;

  -- ---- Itens de evidência do atendimento por OS ou por atendimento (§3). ------
  if exists (select 1 from public.service_attendance_evidence_items e
              where e.work_order_id = p_os_id
                 or e.service_attendance_id in
                    (select id from public.service_attendances where work_order_id = p_os_id)) then
    raise exception '%', c_preserve using errcode = 'P0001';
  end if;

  -- ---- Fotos e comparações de campo (§3). -------------------------------------
  if exists (select 1 from public.field_photos f where f.os_id = p_os_id) then
    raise exception '%', c_preserve using errcode = 'P0001';
  end if;
  if exists (select 1 from public.field_photo_comparisons c where c.os_id = p_os_id) then
    raise exception '%', c_preserve using errcode = 'P0001';
  end if;

  -- ---- Horas apontadas (§3). --------------------------------------------------
  if exists (select 1 from public.contract_hour_ledger h where h.ordem_servico_id = p_os_id) then
    raise exception '%', c_preserve using errcode = 'P0001';
  end if;

  -- ---- Movimentação financeira (texto: id ou numero) (§3). --------------------
  if exists (select 1 from public.transactions t
              where t.os_id = p_os_id::text
                 or (v_numero is not null and t.os_id = v_numero)) then
    raise exception '%', c_preserve using errcode = 'P0001';
  end if;

  -- ---- Atendimento(s): só prossegue se TODOS estiverem VAZIOS (§4). -----------
  -- Conteúdo técnico do próprio atendimento (as evidências ligadas a ele já foram
  -- bloqueadas acima). Aqui olhamos estado/execução/assinatura do atendimento.
  select count(*) into v_att_total
    from public.service_attendances s where s.work_order_id = p_os_id;
  select count(*) into v_att_content
    from public.service_attendances s
    where s.work_order_id = p_os_id
      and (
        s.status = 'FINALIZADO'
        or s.finished_at is not null
        or s.result is not null
        or nullif(btrim(coalesce(s.diagnosis, '')), '') is not null
        or nullif(btrim(coalesce(s.execution_notes, '')), '') is not null
        or s.client_signature_status is not null
        or s.client_signature_path is not null
        or nullif(btrim(coalesce(s.client_signature_name, '')), '') is not null
        or s.client_signed_at is not null
      );
  if v_att_content > 0 then
    raise exception '%', c_preserve using errcode = 'P0001';
  end if;

  -- =============================== APAGAR ====================================
  -- Ordem determinística e explícita (não confiar em CASCADE para decidir):
  -- (a) religar execução de rotina; (b) apagar atendimentos vazios; (c) OS;
  -- (d) registrar número aposentado. Tudo na mesma transação (atômico).

  -- (a) Execução contratual (§5): solta a OS e volta ao estado que permite
  -- gerar nova OS. Só toca 'os_gerada' (estados adiante implicariam histórico já
  -- bloqueado acima). NÃO apaga execução/rotina/contrato.
  update public.contract_routine_executions
     set ordem_servico_id = null,
         status = case when status = 'os_gerada' then 'agendado' else status end
   where ordem_servico_id = p_os_id;
  get diagnostics v_exec_reset = row_count;

  -- (b) Atendimentos comprovadamente vazios (0..N). Explícito, não por CASCADE.
  delete from public.service_attendances where work_order_id = p_os_id;

  -- (c) A OS.
  delete from public.ordens_servico where id = p_os_id;

  -- (d) Número aposentado (§10): nunca será reemitido.
  if v_numero is not null then
    insert into public.retired_os_numbers (numero, os_id, retired_by)
    values (v_numero, p_os_id, auth.uid())
    on conflict (numero) do nothing;
  end if;

  return jsonb_build_object(
    'success', true,
    'deleted_os_id', p_os_id,
    'numero', v_numero,
    'routine_execution_reset', v_exec_reset > 0,
    'removed_empty_attendance', v_att_total
  );
end;
$$;
revoke all on function public.delete_contract_os_if_clean(uuid) from public;
grant execute on function public.delete_contract_os_if_clean(uuid) to authenticated;

-- =====================================================================
-- NOTA — AGENDA (§6): calendar_events (0105) NÃO possui vínculo com
-- ordens_servico (é entidade de compromissos LIVRES, sem OS/cliente derivado).
-- Não há evento derivado desta OS para religar/limpar. Nada a fazer aqui.
-- =====================================================================
