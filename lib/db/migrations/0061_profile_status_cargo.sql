-- Lifecycle do funcionário + separação Cargo × Perfil de acesso.
-- ADITIVA e sem perda de dados. Requer 0004/0005/0006. Idempotente.
-- REVISAR e rodar no SQL Editor do Supabase (o agente não aplica migrations).
--
-- Conceitos:
--   role   = PERFIL DE ACESSO (ADMINISTRATIVO/GESTOR/FINANCEIRO/TECNICO) — controla RLS.
--   cargo  = FUNÇÃO PROFISSIONAL (texto livre) — NÃO controla permissão.
--   status = ATIVO | INATIVO | DESLIGADO — só ATIVO opera o sistema.
-- Desativar NÃO é DELETE: preserva auth.users, profile e todo o histórico.

-- 1) Colunas novas (status NOT NULL default ATIVO; cargo texto opcional).
alter table public.profiles add column if not exists status text not null default 'ATIVO';
alter table public.profiles add column if not exists cargo  text;

-- Backfill defensivo dos registros existentes.
update public.profiles set status = 'ATIVO' where status is null or status = '';

-- Constraint de domínio do status (idempotente).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_status_check check (status in ('ATIVO', 'INATIVO', 'DESLIGADO'));
  end if;
end $$;

-- 2) auth_role() passa a exigir status = 'ATIVO'. Assim, TODA policy baseada em
--    auth_role() nega automaticamente usuários INATIVO/DESLIGADO. (A correção
--    primária de acesso acontece aqui, num único ponto.)
create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid() and status = 'ATIVO'),
    ''
  );
$$;
grant execute on function public.auth_role() to authenticated;

-- 3) Helper explícito de "perfil ativo" (para as policies self-branch).
create or replace function public.is_active_profile()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select status = 'ATIVO' from public.profiles where id = auth.uid()),
    false
  );
$$;
grant execute on function public.is_active_profile() to authenticated;

-- 4) Policies RESTRITIVAS de "somente ativo" nas tabelas cujo acesso próprio usa
--    auth.uid() diretamente (não passam por auth_role()). Restritiva = ANDed com
--    as permissivas existentes → bloqueia inativo em select/insert/update/delete
--    SEM reescrever as policies atuais. service_role (Edge Function) faz BYPASSRLS,
--    então a criação administrativa não é afetada.
--    OBS: profiles NÃO recebe restrição — o gate precisa ler o próprio status para
--    exibir a mensagem de bloqueio. document_verifications (público) também não.
do $$
declare t text;
begin
  foreach t in array array[
    'time_punches', 'punch_adjustments', 'day_entries',
    'reports', 'report_answers', 'report_media', 'report_signatures'
  ]
  loop
    execute format('drop policy if exists "active only" on public.%I', t);
    execute format(
      'create policy "active only" on public.%I as restrictive for all to authenticated '
      || 'using (public.is_active_profile()) with check (public.is_active_profile())', t
    );
  end loop;
end $$;
