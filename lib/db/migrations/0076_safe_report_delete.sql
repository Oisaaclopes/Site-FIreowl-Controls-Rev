-- RELATÓRIOS — hard delete seguro e atômico.
-- Necessário porque a policy atual bloqueia DELETE de finalizados e os vínculos
-- operacionais usam ON DELETE SET NULL. A RPC impede perda silenciosa de
-- rastreabilidade e só remove pendências de origem ainda sem uso comercial.

create or replace function public.delete_report_if_unused(p_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_report public.reports%rowtype;
  v_paths text[];
begin
  if auth.uid() is null or not public.is_active_profile()
     or public.auth_role() not in ('ADMINISTRATIVO', 'GESTOR') then
    raise exception 'Você não tem permissão para excluir relatórios.' using errcode = '42501';
  end if;

  select * into v_report from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'Relatório não encontrado.' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.ordens_servico where report_id = p_report_id)
     or exists (select 1 from public.report_order_links where report_id = p_report_id)
     or exists (select 1 from public.field_photos where report_id = p_report_id)
     or exists (select 1 from public.field_photo_comparisons where report_id = p_report_id)
     or exists (select 1 from public.contract_routine_executions where report_id = p_report_id)
     or exists (select 1 from public.pendencias where report_execucao_id = p_report_id)
     or exists (
       select 1 from public.pendencias
       where report_origem_id = p_report_id
         and (proposta_id is not null or status not in ('aberta', 'cancelada'))
     )
     or exists (
       select 1 from public.catalogo_provisorio
       where report_origem_id = p_report_id and status <> 'pendente'
     ) then
    raise exception 'Este relatório possui vínculos operacionais e precisa ser preservado.' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(path), array[]::text[]) into v_paths
  from (
    select storage_path_original as path from public.report_media where report_id = p_report_id
    union
    select storage_path_marcado from public.report_media where report_id = p_report_id and storage_path_marcado is not null
    union
    select storage_path from public.report_signatures where report_id = p_report_id and storage_path is not null
  ) paths;

  delete from public.pendencias
   where report_origem_id = p_report_id
     and proposta_id is null
     and report_execucao_id is null
     and status in ('aberta', 'cancelada');
  delete from public.catalogo_provisorio
   where report_origem_id = p_report_id and status = 'pendente';
  delete from public.reports where id = p_report_id;

  return jsonb_build_object(
    'id', p_report_id,
    'client_uuid', v_report.client_uuid,
    'storage_paths', to_jsonb(v_paths)
  );
end;
$$;

revoke all on function public.delete_report_if_unused(uuid) from public;
revoke all on function public.delete_report_if_unused(uuid) from anon;
grant execute on function public.delete_report_if_unused(uuid) to authenticated;
