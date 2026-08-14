-- Ordens de Serviço (ponto 4 do módulo de relatórios).
-- Fecha o ciclo pendência -> OS -> corretiva: uma OS agrega pendências
-- aprovadas de um cliente e é vinculada ao relatório de execução (Corretiva).
-- Convenção text x uuid: cliente_id/contrato_id são TEXT (tabelas legadas),
-- id é uuid. reports.os_id (text, 0029) passa a apontar para esta tabela.
-- Requer 0018 (clients), 0020 (contracts), 0027/0029 (pendencias), 0029 (reports).
-- Idempotente.

create table if not exists public.ordens_servico (
  id             uuid primary key default gen_random_uuid(),
  numero         text,                                  -- OS-2026-0091
  cliente_id     text references public.clients(id)   on delete set null,
  contrato_id    text references public.contracts(id) on delete set null,
  tipo           text not null default 'corretiva'
                 check (tipo in ('corretiva','preventiva','instalacao','outro')),
  titulo         text,
  descricao      text,
  status         text not null default 'aberta'
                 check (status in ('aberta','agendada','em_execucao','concluida','cancelada')),
  prioridade     text not null default 'media'
                 check (prioridade in ('baixa','media','alta','critica')),
  pendencia_ids  uuid[] not null default '{}',          -- pendências que originaram a OS
  report_id      uuid references public.reports(id) on delete set null,  -- relatório de execução
  data_abertura  date not null default current_date,
  data_prevista  date,
  data_conclusao date,
  criado_por     uuid default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists ordens_servico_cliente_idx  on public.ordens_servico (cliente_id);
create index if not exists ordens_servico_status_idx   on public.ordens_servico (status);
create index if not exists ordens_servico_report_idx   on public.ordens_servico (report_id);

-- updated_at automático (reaproveita o trigger genérico se existir; senão cria).
do $$
begin
  if not exists (
    select 1 from pg_proc where proname = 'set_updated_at' and pronamespace = 'public'::regnamespace
  ) then
    create function public.set_updated_at() returns trigger language plpgsql as $fn$
    begin
      new.updated_at = now();
      return new;
    end;
    $fn$;
  end if;
end $$;

drop trigger if exists ordens_servico_set_updated_at on public.ordens_servico;
create trigger ordens_servico_set_updated_at
  before update on public.ordens_servico
  for each row execute function public.set_updated_at();

alter table public.ordens_servico enable row level security;
grant select, insert, update, delete on public.ordens_servico to authenticated;

-- Técnico enxerga as OS (precisa selecionar a OS ao abrir uma corretiva) e pode
-- atualizar (vincular o relatório de execução / mover o status na execução).
-- Abertura/cancelamento e curadoria ficam com o Administrativo/Gestor.
drop policy if exists "os select" on public.ordens_servico;
create policy "os select" on public.ordens_servico for select to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR','FINANCEIRO','TECNICO'));

drop policy if exists "os insert" on public.ordens_servico;
create policy "os insert" on public.ordens_servico for insert to authenticated
  with check (public.auth_role() in ('ADMINISTRATIVO','GESTOR'));

drop policy if exists "os update" on public.ordens_servico;
create policy "os update" on public.ordens_servico for update to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'))
  with check (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'));

drop policy if exists "os delete" on public.ordens_servico;
create policy "os delete" on public.ordens_servico for delete to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR'));
