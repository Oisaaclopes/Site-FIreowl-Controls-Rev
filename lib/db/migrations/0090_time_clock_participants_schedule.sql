-- CORREÇÃO Folha Ponto — jornada prevista do FUNCIONÁRIO da folha.
--
-- Bug: ao gerar a folha de OUTRO funcionário, as "Horas previstas" saíam 00:00
-- porque a jornada usada era a do USUÁRIO AUTENTICADO (schedule do próprio
-- gerador), não a do funcionário selecionado. Para corrigir na origem, o cliente
-- precisa da escala do funcionário — e o canal seguro/canônico já existe:
-- get_time_clock_participants() (0082, SECURITY DEFINER, com o mesmo escopo por
-- papel: ADMIN/GESTOR veem todos os ATIVOS; TÉCNICO vê só a si mesmo).
--
-- Esta migração apenas ACRESCENTA `schedule` (jsonb) ao retorno da função. O
-- escopo por papel é preservado — um técnico continua recebendo só a própria
-- escala. `create or replace` numa migração nova; NÃO edita a 0082. Aditiva,
-- idempotente, sem tocar dados. Requer 0082 e 0004/0005 (auth_role).

-- Mudar o tipo de retorno (acrescentar a coluna `schedule`) exige DROP antes do
-- CREATE: o Postgres não permite CREATE OR REPLACE que altere a assinatura de
-- saída. Idempotente (IF EXISTS). A assinatura de ENTRADA não muda (sem args),
-- então nenhum objeto depende dela de forma que impeça o drop.
drop function if exists public.get_time_clock_participants();

create function public.get_time_clock_participants()
returns table (id uuid, name text, uses_time_clock boolean, schedule jsonb)
language plpgsql stable security definer set search_path = public
as $$
begin
  if public.auth_role() not in ('ADMINISTRATIVO', 'GESTOR', 'TECNICO') then return; end if;
  return query
    select p.id, coalesce(p.name, p.full_name, ''), p.uses_time_clock, p.schedule
    from public.profiles p
    where p.status = 'ATIVO'
      and (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR') or p.id = auth.uid())
    order by coalesce(p.name, p.full_name, '');
end;
$$;

revoke all on function public.get_time_clock_participants() from public, anon;
grant execute on function public.get_time_clock_participants() to authenticated;
