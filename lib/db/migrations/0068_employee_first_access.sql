-- Primeiro acesso por convite administrativo. Usuários existentes continuam concluídos.
alter table public.profiles
  add column if not exists first_access_completed boolean not null default true,
  add column if not exists invitation_sent_at timestamptz,
  add column if not exists first_access_completed_at timestamptz;

update public.profiles set first_access_completed = true where first_access_completed is null;

create or replace function public.complete_employee_first_access(
  p_full_name text default null, p_phone text default null,
  p_cpf text default null, p_birth_date date default null
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select * into v_profile from public.profiles where id = auth.uid() for update;
  if not found or v_profile.status <> 'ATIVO' then raise exception 'profile_not_active'; end if;
  if v_profile.first_access_completed then return true; end if;
  update public.profiles
  set full_name = nullif(trim(p_full_name), ''), phone = nullif(trim(p_phone), ''),
      cpf = nullif(trim(p_cpf), ''), birth_date = p_birth_date,
      first_access_completed = true, first_access_completed_at = now()
  where id = auth.uid();
  insert into public.audit_logs (user_id, user_name, user_role, action, module, details)
  values (auth.uid(), v_profile.name, v_profile.role, 'USER_FIRST_ACCESS_COMPLETED',
          'usuarios', 'target_user_id=' || auth.uid()::text);
  return true;
end;
$$;
revoke all on function public.complete_employee_first_access(text, text, text, date) from public, anon;
grant execute on function public.complete_employee_first_access(text, text, text, date) to authenticated;

create or replace function public.auth_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()
    and status = 'ATIVO' and first_access_completed = true), '');
$$;

create or replace function public.is_active_profile() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select status = 'ATIVO' and first_access_completed = true
    from public.profiles where id = auth.uid()), false);
$$;
