-- Participação explícita no controle de ponto + endereço persistido da batida.
-- Default TRUE preserva o comportamento de todos os usuários existentes.
alter table public.profiles
  add column if not exists uses_time_clock boolean not null default true;

update public.profiles set uses_time_clock = true where uses_time_clock is null;

alter table public.time_punches
  add column if not exists location_address text;

-- Diretório mínimo para telas de ponto. Não expõe CPF, telefone ou demais PII.
create or replace function public.get_time_clock_participants()
returns table (id uuid, name text, uses_time_clock boolean)
language plpgsql stable security definer set search_path = public
as $$
begin
  if public.auth_role() not in ('ADMINISTRATIVO', 'GESTOR', 'TECNICO') then return; end if;
  return query
    select p.id, coalesce(p.name, p.full_name, ''), p.uses_time_clock
    from public.profiles p
    where p.status = 'ATIVO'
      and (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR') or p.id = auth.uid())
    order by coalesce(p.name, p.full_name, '');
end;
$$;

revoke all on function public.get_time_clock_participants() from public, anon;
grant execute on function public.get_time_clock_participants() to authenticated;
