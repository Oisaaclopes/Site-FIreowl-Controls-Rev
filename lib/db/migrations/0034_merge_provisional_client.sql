-- Homologação de cliente provisório (ponto 3): "Mesclar" reatribui todas as
-- referências do cliente provisório para um cliente oficial e remove o
-- provisório. Precisa de SECURITY DEFINER para reatribuir inclusive relatórios
-- finalizados (imutáveis pela RLS) e outras tabelas com policies restritas.
-- Requer 0018 (clients), 0021/0022 (client_id em transactions/contracts),
-- 0029 (devices/reports/pendencias/ciclos), 0033 (ordens_servico). Idempotente.

create or replace function public.merge_provisional_client(p_prov text, p_oficial text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_role() not in ('ADMINISTRATIVO', 'GESTOR') then
    raise exception 'Sem permissão para mesclar clientes.';
  end if;
  if p_prov is null or p_oficial is null or p_prov = p_oficial then
    raise exception 'Informe um provisório e um oficial distintos.';
  end if;
  if not exists (select 1 from public.clients where id = p_prov and pendente_validacao) then
    raise exception 'Cliente % não é provisório (ou não existe).', p_prov;
  end if;
  if not exists (select 1 from public.clients where id = p_oficial and coalesce(pendente_validacao, false) = false) then
    raise exception 'Cliente oficial % não existe.', p_oficial;
  end if;

  update public.devices           set cliente_id = p_oficial where cliente_id = p_prov;
  update public.reports           set cliente_id = p_oficial where cliente_id = p_prov;
  update public.pendencias        set cliente_id = p_oficial where cliente_id = p_prov;
  update public.ordens_servico    set cliente_id = p_oficial where cliente_id = p_prov;
  update public.ciclos_amostragem set cliente_id = p_oficial where cliente_id = p_prov;
  update public.contracts         set client_id  = p_oficial where client_id  = p_prov;
  update public.transactions      set client_id  = p_oficial where client_id  = p_prov;

  delete from public.clients where id = p_prov;
end;
$$;

grant execute on function public.merge_provisional_client(text, text) to authenticated;
