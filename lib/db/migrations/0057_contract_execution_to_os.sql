-- ETAPA 4 — Ponte Competência → OS. Gera uma Ordem de Serviço a partir de uma
-- execução de rotina (competência), de forma IDEMPOTENTE: nunca cria uma 2ª OS
-- para a mesma competência. E integra o status: OS concluída → execução
-- EXECUTADO; relatório vinculado → RELATORIO_EMITIDO. Requer 0033 (ordens_servico)
-- e 0056 (contract_routine_executions). Idempotente.

-- ===================== RPC: gerar OS da execução =====================
create or replace function public.generate_os_from_execution(
  p_execution_id uuid,
  p_prioridade   text default 'media',
  p_titulo       text default null,
  p_descricao    text default null
) returns jsonb
language plpgsql
security invoker
as $$
declare
  ex   public.contract_routine_executions%rowtype;
  rot  public.contract_routines%rowtype;
  ctr  public.contracts%rowtype;
  v_tipo    text;
  v_numero  text;
  v_seq     integer;
  v_ano     integer := extract(year from current_date);
  v_os      uuid;
  v_titulo  text;
  v_desc    text;
  v_num_existente text;
begin
  -- Serializa concorrentes na MESMA execução (protege duplo clique / corrida).
  select * into ex from public.contract_routine_executions where id = p_execution_id for update;
  if not found then raise exception 'execucao % nao encontrada', p_execution_id; end if;

  -- Idempotência: já existe OS para esta competência → devolve a existente.
  if ex.ordem_servico_id is not null then
    select numero into v_num_existente from public.ordens_servico where id = ex.ordem_servico_id;
    return jsonb_build_object('os_id', ex.ordem_servico_id, 'numero', v_num_existente,
                              'already_existed', true, 'status', ex.status);
  end if;

  select * into rot from public.contract_routines where id = ex.routine_id;
  select * into ctr from public.contracts        where id = ex.contract_id;

  v_tipo := case rot.tipo
              when 'preventiva' then 'preventiva'
              when 'corretiva'  then 'corretiva'
              when 'instalacao' then 'instalacao'
              else 'outro' end;

  -- Próximo número OS-AAAA-NNNN (dentro da transação).
  select coalesce(max(nullif(split_part(numero, '-', 3), '')::int), 0)
    into v_seq from public.ordens_servico where numero like 'OS-' || v_ano || '-%';
  v_numero := 'OS-' || v_ano || '-' || lpad((v_seq + 1)::text, 4, '0');

  v_titulo := coalesce(nullif(trim(p_titulo), ''),
              initcap(coalesce(rot.tipo, 'preventiva'))
              || coalesce(' ' || rot.area, '')
              || ' — ' || ex.competencia);
  v_desc := coalesce(nullif(trim(p_descricao), ''),
            'Gerada da rotina contratual. Contrato ' || ctr.id
            || ', competência ' || ex.competencia
            || coalesce(' · janela ' || rot.horario_inicio || '–' || rot.horario_fim, '')
            || coalesce(' · SLA ' || rot.sla, '')
            || coalesce(' · ' || rot.qtd_tecnicos || ' técnico(s)', ''));

  insert into public.ordens_servico
    (numero, cliente_id, contrato_id, tipo, titulo, descricao, status, prioridade, data_prevista)
  values
    (v_numero, ctr.client_id, ctr.id, v_tipo, v_titulo, v_desc, 'agendada',
     coalesce(nullif(p_prioridade, ''), 'media'), ex.data_programada)
  returning id into v_os;

  update public.contract_routine_executions
    set ordem_servico_id = v_os, status = 'os_gerada'
    where id = ex.id;

  return jsonb_build_object('os_id', v_os, 'numero', v_numero,
                            'already_existed', false, 'status', 'os_gerada');
end;
$$;
grant execute on function public.generate_os_from_execution(uuid, text, text, text) to authenticated;

-- ===================== Trigger: integração automática de status =====================
-- OS concluída → execução EXECUTADO; relatório vinculado → RELATORIO_EMITIDO.
create or replace function public.sync_execution_on_os() returns trigger
language plpgsql as $$
begin
  if new.status = 'concluida' and (old.status is distinct from new.status) then
    update public.contract_routine_executions
      set status = 'executado'
      where ordem_servico_id = new.id
        and status in ('previsto', 'agendado', 'os_gerada');
  end if;
  if new.report_id is not null and (old.report_id is distinct from new.report_id) then
    update public.contract_routine_executions
      set status = 'relatorio_emitido', report_id = new.report_id
      where ordem_servico_id = new.id
        and status <> 'cancelado';
  end if;
  return new;
end;
$$;

drop trigger if exists ordens_servico_sync_execution on public.ordens_servico;
create trigger ordens_servico_sync_execution
  after update on public.ordens_servico
  for each row execute function public.sync_execution_on_os();
