-- ETAPA 7 QA: protege a conversão inicial Levantamento -> Pedido e a numeração
-- comercial de OS contra concorrência. Aditiva; preserva vínculos manuais.
-- Requer 0008, 0033, 0044, 0056 e 0057.

-- A mesma origem pode ter pedidos adicionais deliberados, mas apenas UM vínculo
-- de conversão inicial. Vínculos existentes são classificados sem apagá-los.
alter table public.report_order_links
  add column if not exists operation text not null default 'manual';

with ranked as (
  select id, row_number() over (partition by report_id order by created_at, id) as position
  from public.report_order_links
  where operation = 'manual'
)
update public.report_order_links links
set operation = 'initial_conversion'
from ranked
where links.id = ranked.id and ranked.position = 1;

create unique index if not exists report_order_links_initial_conversion_uniq
  on public.report_order_links(report_id)
  where operation = 'initial_conversion';

-- Recebe o pedido já montado pelo app. A regra de composição continua em
-- TypeScript; o banco só serializa a criação e o vínculo inicial.
create or replace function public.get_or_create_order_from_survey(
  p_report_id uuid,
  p_pedido jsonb
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_pedido_id text;
  v_pedido public.pedidos%rowtype;
begin
  if p_pedido is null or coalesce(nullif(trim(p_pedido->>'id'), ''), '') = '' then
    raise exception 'pedido obrigatorio';
  end if;

  -- Serializa somente a origem, não bloqueia conversões de outros levantamentos.
  perform pg_advisory_xact_lock(hashtextextended('fireowl:survey:' || p_report_id::text, 0));

  -- A leitura respeita RLS por SECURITY INVOKER e também impede origem inexistente.
  perform 1 from public.reports
    where id = p_report_id and tipo = 'LEVANTAMENTO' and status = 'finalizado';
  if not found then raise exception 'levantamento finalizado % nao encontrado ou sem acesso', p_report_id; end if;

  select pedido_id into v_pedido_id
  from public.report_order_links
  where report_id = p_report_id and operation = 'initial_conversion'
  limit 1;
  if v_pedido_id is not null then
    select * into v_pedido from public.pedidos where id = v_pedido_id;
    return jsonb_build_object('pedido_id', v_pedido_id, 'already_exists', true, 'pedido', to_jsonb(v_pedido));
  end if;

  insert into public.pedidos (
    id, numero_pedido, referencia, cliente_id, cliente_nome, fornecedor,
    data_emissao, responsavel_comercial_id, responsavel_comercial_nome,
    status, valor_total, proposal, created_at, updated_at
  ) values (
    p_pedido->>'id', p_pedido->>'numero_pedido', p_pedido->>'referencia',
    p_pedido->>'cliente_id', p_pedido->>'cliente_nome', p_pedido->>'fornecedor',
    p_pedido->>'data_emissao', p_pedido->>'responsavel_comercial_id',
    p_pedido->>'responsavel_comercial_nome', p_pedido->>'status',
    coalesce((p_pedido->>'valor_total')::numeric, 0),
    coalesce(p_pedido->'proposal', '{}'::jsonb),
    coalesce((p_pedido->>'created_at')::timestamptz, now()),
    coalesce((p_pedido->>'updated_at')::timestamptz, now())
  ) returning * into v_pedido;

  insert into public.report_order_links(report_id, pedido_id, operation)
  values (p_report_id, v_pedido.id, 'initial_conversion');

  return jsonb_build_object('pedido_id', v_pedido.id, 'already_exists', false, 'pedido', to_jsonb(v_pedido));
end;
$$;
grant execute on function public.get_or_create_order_from_survey(uuid, jsonb) to authenticated;

-- A numeração de OS mantém OS-AAAA-NNNN. O lock por ano protege competências
-- distintas concorrentes; a proteção de unicidade é criada somente se o
-- histórico já estiver limpo, sem apagar ou alterar duplicatas antigas.
do $$
begin
  if not exists (
    select 1 from public.ordens_servico
    where numero is not null
    group by numero having count(*) > 1
  ) then
    execute 'create unique index if not exists ordens_servico_numero_uniq on public.ordens_servico(numero) where numero is not null';
  else
    raise warning 'Índice único de ordens_servico.numero não criado: existem números históricos duplicados. Corrija-os manualmente antes de criar o índice.';
  end if;
end $$;

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
  select coalesce(max(nullif(split_part(numero, '-', 3), '')::int), 0) into v_seq
    from public.ordens_servico where numero like 'OS-' || v_ano || '-%';
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
