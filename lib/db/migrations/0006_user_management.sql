-- Gestão de usuários pelo admin (painel em Configurações).
-- Requer 0004 e 0005 aplicadas. Rode no SQL Editor do Supabase. Idempotente.

-- Guarda o e-mail no perfil (para listar usuários sem acessar auth.users)
alter table public.profiles add column if not exists email text;

-- Atualiza o trigger para gravar também o e-mail
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'TECNICO'),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Preenche o e-mail dos perfis já existentes
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and (p.email is null or p.email = '');

grant update, delete on public.profiles to authenticated;

-- Admin pode ver, alterar e remover qualquer perfil (além do self-select já existente)
drop policy if exists "profiles admin select" on public.profiles;
create policy "profiles admin select"
  on public.profiles for select
  to authenticated
  using (public.auth_role() = 'ADMINISTRATIVO');

drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update"
  on public.profiles for update
  to authenticated
  using (public.auth_role() = 'ADMINISTRATIVO')
  with check (public.auth_role() = 'ADMINISTRATIVO');

drop policy if exists "profiles admin delete" on public.profiles;
create policy "profiles admin delete"
  on public.profiles for delete
  to authenticated
  using (public.auth_role() = 'ADMINISTRATIVO');
