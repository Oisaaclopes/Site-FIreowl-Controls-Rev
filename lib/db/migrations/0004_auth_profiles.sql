-- Perfis de usuário para o RBAC real (ligado ao Supabase Auth).
-- Rode no SQL Editor do Supabase (uma vez). Idempotente.

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text,
  role       text not null default 'TECNICO'
             check (role in ('ADMINISTRATIVO', 'TECNICO', 'GESTOR', 'FINANCEIRO')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

grant select on public.profiles to authenticated;

-- Cada usuário lê apenas o próprio perfil
drop policy if exists "profiles self select" on public.profiles;
create policy "profiles self select"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

-- Cria o perfil automaticamente quando um usuário é criado no Auth.
-- Usa os metadados name/role, se informados; senão, cai no padrão TECNICO.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'TECNICO')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
