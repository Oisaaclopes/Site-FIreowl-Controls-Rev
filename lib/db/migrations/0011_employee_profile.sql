-- Dados cadastrais do funcionário no perfil. Requer 0004/0005/0006.
-- SEGURANÇA: a tabela profiles JÁ tem RLS — cada usuário lê só o próprio
-- perfil e o ADMINISTRATIVO lê/gerencia todos. Portanto CPF, nascimento,
-- escala etc. NÃO são acessíveis por anônimo nem por outros funcionários.
-- Idempotente.

alter table public.profiles add column if not exists full_name   text;
alter table public.profiles add column if not exists cpf          text;
alter table public.profiles add column if not exists birth_date   date;
alter table public.profiles add column if not exists phone        text;
alter table public.profiles add column if not exists schedule     jsonb;   -- WorkSchedule (7 dias)
alter table public.profiles add column if not exists courses      jsonb;   -- cursos/NRs/diplomas (texto estruturado)

-- Reforço: garante que anônimo não tem nenhum acesso a profiles
revoke all on public.profiles from anon;
