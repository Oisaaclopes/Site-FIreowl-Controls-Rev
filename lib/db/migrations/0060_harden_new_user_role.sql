-- Endurecimento de segurança: o trigger de criação de perfil NÃO deve confiar
-- no role vindo dos metadados do usuário (raw_user_meta_data), pois esses são
-- controláveis pelo cliente. Com o signup público aberto, o comportamento
-- anterior permitia auto-atribuição de role='ADMINISTRATIVO' via
-- auth.signUp({ options: { data: { role: 'ADMINISTRATIVO' } } }) → escalonamento
-- direto para administrador.
--
-- Correção: todo novo usuário nasce com o role default seguro 'TECNICO'. O role
-- autorizado passa a ser definido EXCLUSIVAMENTE server-side pela Edge Function
-- `create-user` (que valida o solicitante ADMINISTRATIVO e faz o UPDATE do
-- profile). O nome continua vindo dos metadados (não é privilégio).
--
-- IMPORTANTE:
--   * Esta migration é DEFESA EM PROFUNDIDADE — a correção primária é fechar o
--     signup público (Authentication → "Allow new users to sign up" = OFF).
--   * Não quebra o fluxo administrativo: a Edge Function define o role via UPDATE
--     após a criação.
--   * REVISAR antes de aplicar (rode no SQL Editor do Supabase). Idempotente.

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
    'TECNICO',                       -- SEMPRE default seguro; nunca confia em metadata do cliente
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
