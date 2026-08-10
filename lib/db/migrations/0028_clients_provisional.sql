-- Cliente provisório criado em campo pelo Técnico (decisão da seção 8).
-- Nasce com pendente_validacao = true; o Administrativo consolida antes de
-- qualquer proposta. A checagem de CNPJ duplicado é feita na aplicação (não
-- há unique no CNPJ para não travar o cadastro em campo). Requer 0018.
-- Idempotente.

alter table public.clients add column if not exists pendente_validacao boolean not null default false;
alter table public.clients add column if not exists created_by_role     text;

create index if not exists clients_pendente_idx on public.clients (pendente_validacao) where pendente_validacao;

-- Leitura passa a incluir o TÉCNICO (precisa selecionar o cliente do relatório).
drop policy if exists "clients select" on public.clients;
create policy "clients select"
  on public.clients for select
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO', 'TECNICO'));

-- Inserção do TÉCNICO: somente cliente provisório (pendente_validacao = true).
-- (Convive com a policy "clients insert" de ADMIN/GESTOR/FINANCEIRO — políticas
-- permissivas são combinadas por OR.)
drop policy if exists "clients insert tecnico provisorio" on public.clients;
create policy "clients insert tecnico provisorio"
  on public.clients for insert
  to authenticated
  with check (public.auth_role() = 'TECNICO' and pendente_validacao = true);
