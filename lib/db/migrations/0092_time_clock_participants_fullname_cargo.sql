-- ACABAMENTO DOCUMENTAL — nome completo e cargo do técnico nos PDFs.
--
-- Os documentos mostravam "Isaac" (name curto) na assinatura do técnico. Para o
-- documento formal precisamos do NOME COMPLETO (profiles.full_name) e do CARGO
-- (profiles.cargo). A fonte canônica já usada pela tela de Ponto/documentos é a
-- RPC get_time_clock_participants (0082/0090, SECURITY DEFINER, com escopo por
-- papel: técnico só vê a si mesmo). Acrescentamos full_name e cargo ao retorno.
--
-- Mudar o RETURNS TABLE exige DROP antes do CREATE (como na 0090). Idempotente.
-- Aditiva; NÃO edita 0082/0090. Requer 0011 (full_name), 0061 (cargo).

drop function if exists public.get_time_clock_participants();

create function public.get_time_clock_participants()
returns table (id uuid, name text, uses_time_clock boolean, schedule jsonb, full_name text, cargo text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if public.auth_role() not in ('ADMINISTRATIVO', 'GESTOR', 'TECNICO') then return; end if;
  return query
    select p.id, coalesce(p.name, p.full_name, ''), p.uses_time_clock, p.schedule, p.full_name, p.cargo
    from public.profiles p
    where p.status = 'ATIVO'
      and (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR') or p.id = auth.uid())
    order by coalesce(p.name, p.full_name, '');
end;
$$;

revoke all on function public.get_time_clock_participants() from public, anon;
grant execute on function public.get_time_clock_participants() to authenticated;
