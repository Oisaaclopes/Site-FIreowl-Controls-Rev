-- OPERACIONAL 2A — Integridade Pedido/Proposta → Ordem de Serviço.
-- Liga uma OS ao Pedido comercial que a originou usando a IDENTIDADE ESTRUTURAL
-- real (pedidos.id, TEXT) e nunca o numero_pedido (que NÃO é único: existem dois
-- pedidos distintos com numero_pedido = 'PED-2026-252'). ADITIVA e idempotente.
-- Requer 0008 (pedidos), 0033 (ordens_servico), 0048 (padrão source_pedido em
-- contracts) e 0059 (numeração concorrente-segura de OS). REVISAR e rodar no SQL
-- Editor do Supabase — o agente não aplica migrations em produção.

-- =====================================================================
-- 1) Vínculo estrutural OS → Pedido (TEXT, pois pedidos.id é TEXT).
-- =====================================================================
alter table public.ordens_servico
  add column if not exists source_pedido_id text
    references public.pedidos(id) on delete set null;

create index if not exists ordens_servico_source_pedido_idx
  on public.ordens_servico (source_pedido_id);

-- Regra de negócio: UM Pedido → NO MÁXIMO UMA OS ATIVA.
-- Índice único PARCIAL: OS canceladas/concluídas ficam no histórico e o Pedido
-- poderá gerar outra futuramente (isso será tratado na OPERACIONAL 2B).
-- Status ativos confirmados no CHECK de 0033: aberta, agendada, em_execucao.
create unique index if not exists ordens_servico_active_source_pedido_uniq
  on public.ordens_servico (source_pedido_id)
  where source_pedido_id is not null
    and status in ('aberta', 'agendada', 'em_execucao');

-- =====================================================================
-- 2) Backfill EXPLÍCITO e único da OS oficial já existente.
-- Autorizado no handoff: OS-2026-0001 → pedidos.id = 'ped_1788208403374'
-- (cliente Muffato Foods). Nenhum backfill genérico por numero_pedido, cliente,
-- descrição ou data. OS legadas sem origem conhecida permanecem NULL.
-- =====================================================================
update public.ordens_servico os
   set source_pedido_id = 'ped_1788208403374'
 where os.numero = 'OS-2026-0001'
   and os.source_pedido_id is null
   and exists (select 1 from public.pedidos p where p.id = 'ped_1788208403374');

-- =====================================================================
-- 3) RPC idempotente: get_or_create_os_from_pedido.
-- SECURITY INVOKER → respeita a RLS de 0033 (INSERT restrito a
-- ADMINISTRATIVO/GESTOR). A composição do Pedido continua no app; o banco
-- serializa a criação, protege a numeração e garante a unicidade da OS ativa.
-- =====================================================================
create or replace function public.get_or_create_os_from_pedido(
  p_pedido_id     text,
  p_tipo          text default 'corretiva',
  p_prioridade    text default 'media',
  p_titulo        text default null,
  p_descricao     text default null,
  p_pendencia_ids uuid[] default '{}'
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  ped       public.pedidos%rowtype;
  v_os      public.ordens_servico%rowtype;
  v_ano     integer := extract(year from current_date);
  v_seq     integer;
  v_numero  text;
  v_contrato text;
begin
  if auth.uid() is null then
    raise exception 'nao autenticado';
  end if;
  if coalesce(nullif(trim(p_pedido_id), ''), '') = '' then
    raise exception 'pedido obrigatorio';
  end if;

  -- Leitura sob RLS (SECURITY INVOKER): pedido inexistente OU sem acesso falha.
  select * into ped from public.pedidos where id = p_pedido_id;
  if not found then
    raise exception 'pedido % nao encontrado ou sem acesso', p_pedido_id;
  end if;

  -- Serializa concorrentes DO MESMO pedido (duplo clique, duas abas, corrida).
  perform pg_advisory_xact_lock(hashtextextended('fireowl:os:pedido:' || p_pedido_id, 0));

  -- Idempotência ESTRUTURAL: já existe OS ativa deste pedidos.id?
  select * into v_os from public.ordens_servico
   where source_pedido_id = p_pedido_id
     and status in ('aberta', 'agendada', 'em_execucao')
   order by created_at, id
   limit 1;
  if found then
    return jsonb_build_object('created', false, 'os', to_jsonb(v_os));
  end if;

  -- Contrato recorrente originado do mesmo Pedido, quando houver (0048).
  select id into v_contrato from public.contracts where source_pedido_id = p_pedido_id limit 1;

  -- Numeração OS-AAAA-NNNN concorrente-segura (lock anual, padrão de 0059).
  perform pg_advisory_xact_lock(hashtextextended('fireowl:os:number:' || v_ano::text, 0));
  select coalesce(max(nullif(split_part(numero, '-', 3), '')::int), 0)
    into v_seq from public.ordens_servico where numero like 'OS-' || v_ano || '-%';
  v_numero := 'OS-' || v_ano || '-' || lpad((v_seq + 1)::text, 4, '0');

  begin
    insert into public.ordens_servico
      (numero, cliente_id, contrato_id, tipo, titulo, descricao,
       status, prioridade, pendencia_ids, source_pedido_id)
    values
      (v_numero, ped.cliente_id, v_contrato,
       coalesce(nullif(p_tipo, ''), 'corretiva'),
       coalesce(nullif(trim(p_titulo), ''), coalesce(nullif(trim(ped.referencia), ''), 'Execução de proposta aceita')),
       coalesce(nullif(trim(p_descricao), ''), 'Gerada do Pedido ' || coalesce(ped.numero_pedido, ped.id) || '.'),
       'aberta',
       coalesce(nullif(p_prioridade, ''), 'media'),
       coalesce(p_pendencia_ids, '{}'),
       p_pedido_id)
    returning * into v_os;
  exception when unique_violation then
    -- Rede de segurança do índice parcial: outra transação criou a OS ativa
    -- entre o lock e o insert. Devolve a existente em vez de estourar.
    select * into v_os from public.ordens_servico
     where source_pedido_id = p_pedido_id
       and status in ('aberta', 'agendada', 'em_execucao')
     order by created_at, id
     limit 1;
    return jsonb_build_object('created', false, 'os', to_jsonb(v_os));
  end;

  return jsonb_build_object('created', true, 'os', to_jsonb(v_os));
end;
$$;

grant execute on function public.get_or_create_os_from_pedido(text, text, text, text, text, uuid[]) to authenticated;
