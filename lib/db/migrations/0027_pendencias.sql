-- Objeto central: pendências detectadas (viram linha de orçamento) e seu
-- ciclo de vida até a correção. Requer 0018/0023/0025. Idempotente.
--
-- OBS. de segurança: `criticidade_operacional` é INTERNA. A RLS do Postgres
-- é por linha, não por coluna, então a ocultação para o perfil TÉCNICO e para
-- o PDF do cliente é feita na camada de aplicação (as funções de leitura do
-- técnico NÃO selecionam essa coluna). Não há coluna de preço aqui — o
-- cruzamento com preço acontece só no painel administrativo (regra 70/30).

create table if not exists public.pendencias (
  id                        uuid primary key default gen_random_uuid(),
  cliente_id                text references public.clients(id) on delete set null,
  device_id                 uuid references public.devices(id) on delete set null,
  report_origem_id          uuid references public.reports(id) on delete set null,
  grupo                     text,          -- Categoria > Subcategoria
  descricao                 text,
  acao_recomendada          text
                            check (acao_recomendada in
                              ('substituir','instalar','reposicionar','reparar',
                               'limpar','desobstruir','reprogramar','investigar')),
  norma_referencia          text,
  local                     text,
  quantidade                numeric default 1,
  item_catalogo_id          text,
  item_texto_livre          text,
  precisa_cadastro_catalogo boolean not null default false,
  criticidade_operacional   int check (criticidade_operacional between 1 and 3), -- INTERNO
  status                    text not null default 'aberta'
                            check (status in
                              ('aberta','orcada','aprovada','em_execucao',
                               'corrigida','cancelada','recusada_cliente')),
  proposta_id               text,
  report_execucao_id        uuid references public.reports(id) on delete set null,
  criada_em                 timestamptz not null default now(),
  resolvida_em              timestamptz
);

create index if not exists pendencias_cliente_idx on public.pendencias (cliente_id);
create index if not exists pendencias_status_idx  on public.pendencias (status);
create index if not exists pendencias_origem_idx  on public.pendencias (report_origem_id);

alter table public.pendencias enable row level security;
grant select, insert, update, delete on public.pendencias to authenticated;

-- Leitura: ADMIN, GESTOR e TÉCNICO (checklist na corretiva). A coluna
-- criticidade_operacional é omitida para o técnico na camada de aplicação.
drop policy if exists "pendencias select" on public.pendencias;
create policy "pendencias select"
  on public.pendencias for select
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'TECNICO'));

-- Inserir: ADMIN/GESTOR e TÉCNICO (pendências residuais detectadas em campo).
drop policy if exists "pendencias insert" on public.pendencias;
create policy "pendencias insert"
  on public.pendencias for insert
  to authenticated
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'TECNICO'));

-- Transições de status, orçamento e criticidade: apenas ADMIN/GESTOR.
drop policy if exists "pendencias update" on public.pendencias;
create policy "pendencias update"
  on public.pendencias for update
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));

drop policy if exists "pendencias delete" on public.pendencias;
create policy "pendencias delete"
  on public.pendencias for delete
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));
