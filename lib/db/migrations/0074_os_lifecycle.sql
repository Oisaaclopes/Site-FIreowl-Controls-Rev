-- OPERACIONAL 2B — Lifecycle real da Ordem de Serviço: cancelamento formal e
-- hard delete seguro (só para OS criada por engano, completamente virgem).
-- ADITIVA e idempotente. Requer 0033 (ordens_servico), 0005/0061/0068 (auth_role),
-- 0025/0029 (reports), 0021 (transactions.os_id), 0056 (contract_routine_executions,
-- contract_hour_ledger), 0064 (field_photos), 0067 (field_photo_comparisons) e
-- 0073 (source_pedido_id). REVISAR e rodar no SQL Editor do Supabase — o agente
-- não aplica migrations em produção. NÃO editar/reaplicar migrations anteriores.

-- =====================================================================
-- 1) Campos de cancelamento formal (fonte da verdade do servidor).
-- =====================================================================
alter table public.ordens_servico
  add column if not exists cancelada_em timestamptz,
  add column if not exists cancelada_por uuid references public.profiles(id) on delete set null,
  add column if not exists motivo_cancelamento text;

-- =====================================================================
-- 2) RPC cancel_os — encerra formalmente uma OS ativa, preservando histórico.
-- SECURITY INVOKER: respeita a RLS de update (0033). Checagem de papel EXPLÍCITA
-- restringe a ADMINISTRATIVO/GESTOR (TÉCNICO não cancela administrativamente).
-- =====================================================================
create or replace function public.cancel_os(
  p_os_id  uuid,
  p_motivo text
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_os     public.ordens_servico%rowtype;
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
begin
  if auth.uid() is null then
    raise exception 'nao autenticado';
  end if;
  if public.auth_role() not in ('ADMINISTRATIVO', 'GESTOR') then
    raise exception 'sem permissao para cancelar OS';
  end if;
  if v_motivo is null then
    raise exception 'motivo do cancelamento obrigatorio';
  end if;

  select * into v_os from public.ordens_servico where id = p_os_id for update;
  if not found then
    raise exception 'OS % nao encontrada ou sem acesso', p_os_id;
  end if;
  if v_os.status = 'cancelada' then
    raise exception 'OS ja esta cancelada';
  end if;
  if v_os.status = 'concluida' then
    raise exception 'nao e possivel cancelar uma OS concluida';
  end if;
  -- Ativos canceláveis: aberta, agendada, em_execucao.
  if v_os.status not in ('aberta', 'agendada', 'em_execucao') then
    raise exception 'status % nao permite cancelamento', v_os.status;
  end if;

  update public.ordens_servico
     set status = 'cancelada',
         cancelada_em = now(),            -- timestamp do SERVIDOR
         cancelada_por = auth.uid(),
         motivo_cancelamento = v_motivo
   where id = p_os_id
   returning * into v_os;

  return jsonb_build_object('os', to_jsonb(v_os));
end;
$$;
grant execute on function public.cancel_os(uuid, text) to authenticated;

-- =====================================================================
-- 3) RPC delete_os_if_unused — HARD DELETE de EXCEÇÃO (OS virgem).
-- SECURITY DEFINER porque o guard PRECISA enxergar TODAS as evidências,
-- inclusive as escondidas por RLS restritiva (ex.: transactions só ADMIN/
-- FINANCEIRO; field_photos só o dono da sessão). Com INVOKER o guard contaria
-- zero e liberaria delete erroneamente. Segurança: search_path fixo, auth.uid()
-- e papel validados explicitamente, menor escopo possível.
-- NÃO usa CASCADE: o delete só é permitido porque NÃO existem dependências —
-- nunca porque elas seriam apagadas junto.
-- =====================================================================
create or replace function public.delete_os_if_unused(
  p_os_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_os     public.ordens_servico%rowtype;
  v_numero text;
begin
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

  -- Só OS recém-aberta é "virgem". agendada/em_execucao/concluida/cancelada já
  -- representam ato operacional e nunca podem ser hard deleted (na dúvida, bloquear).
  if v_os.status <> 'aberta' then
    raise exception 'OS em status % nao pode ser excluida; use o cancelamento', v_os.status
      using errcode = 'P0001';
  end if;

  -- Relatório de execução vinculado (FK direta).
  if v_os.report_id is not null then
    raise exception 'OS possui relatorio vinculado; nao pode ser excluida' using errcode = 'P0001';
  end if;
  -- Relatório pelo caminho textual reverso (reports.os_id — 0025/0029). Verifica
  -- id e numero (FASE 14: checar os DOIS caminhos report <-> OS).
  if exists (select 1 from public.reports r
              where r.os_id = p_os_id::text or (v_numero is not null and r.os_id = v_numero)) then
    raise exception 'OS referenciada por relatorio (reports.os_id); nao pode ser excluida' using errcode = 'P0001';
  end if;
  -- Fotos / evidências de campo.
  if exists (select 1 from public.field_photos f where f.os_id = p_os_id) then
    raise exception 'OS possui fotos/evidencias de campo; nao pode ser excluida' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.field_photo_comparisons c where c.os_id = p_os_id) then
    raise exception 'OS possui comparacoes de evidencia; nao pode ser excluida' using errcode = 'P0001';
  end if;
  -- Execução de rotina / atendimento (competência gerada em OS).
  if exists (select 1 from public.contract_routine_executions e where e.ordem_servico_id = p_os_id) then
    raise exception 'OS vinculada a execucao de rotina; nao pode ser excluida' using errcode = 'P0001';
  end if;
  -- Horas apontadas.
  if exists (select 1 from public.contract_hour_ledger h where h.ordem_servico_id = p_os_id) then
    raise exception 'OS possui horas apontadas; nao pode ser excluida' using errcode = 'P0001';
  end if;
  -- Movimentação financeira (transactions.os_id — texto; checa id e numero).
  if exists (select 1 from public.transactions t
              where t.os_id = p_os_id::text or (v_numero is not null and t.os_id = v_numero)) then
    raise exception 'OS vinculada a movimentacao financeira; nao pode ser excluida' using errcode = 'P0001';
  end if;

  delete from public.ordens_servico where id = p_os_id;
  return jsonb_build_object('deleted', true, 'os_id', p_os_id, 'numero', v_numero);
end;
$$;
revoke all on function public.delete_os_if_unused(uuid) from public;
grant execute on function public.delete_os_if_unused(uuid) to authenticated;
