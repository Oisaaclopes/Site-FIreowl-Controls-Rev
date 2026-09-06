-- BLOCO 6 (QA) — Agenda corporativa: EVENTOS LIVRES editáveis.
-- Por que uma entidade nova: OS (ordens_servico) e execuções de rotina
-- (scheduled_executions) são estritamente operacionais e derivadas de contrato/
-- pedido; não comportam compromissos livres (reunião, treinamento, viagem,
-- bloqueio de horário, compromisso pessoal). Nenhuma tabela atual representa um
-- evento de calendário sem OS/cliente. calendar_events cobre EXATAMENTE isso,
-- sem tocar no fluxo de OS. Idempotente. NÃO editar migrations já aplicadas.
-- ATENÇÃO: esta migration ainda NÃO deve ser assumida como aplicada em produção
-- — o app degrada com segurança (lista vazia) enquanto a tabela não existir.

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  -- categoria/tipo do compromisso (apresentação/filtro; texto controlado no app)
  category text not null default 'outro',
  event_date date not null,
  end_date date,                 -- fim (multi-dia); null = mesmo dia de event_date
  start_time time,               -- null quando all_day
  end_time time,                 -- null quando all_day
  all_day boolean not null default false,
  client_id text references public.clients(id) on delete set null,  -- opcional
  location text,
  notes text,
  is_private boolean not null default false,   -- compromisso pessoal/consulta
  responsibles uuid[] not null default '{}',   -- responsável(is) (profiles.id)
  owner_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calendar_events_date_idx on public.calendar_events (event_date);
create index if not exists calendar_events_owner_idx on public.calendar_events (owner_id);

alter table public.calendar_events enable row level security;
grant select, insert, update, delete on public.calendar_events to authenticated;

-- Leitura: eventos corporativos (não privados) são visíveis a todos; eventos
-- PRIVADOS só ao dono e aos responsáveis (preserva privacidade de compromissos
-- pessoais/médicos — sem expor diagnóstico/detalhe a terceiros).
drop policy if exists "calendar events read" on public.calendar_events;
create policy "calendar events read" on public.calendar_events for select to authenticated
  using (
    is_private = false
    or owner_id = auth.uid()
    or auth.uid() = any(responsibles)
  );

-- Criação: o dono é sempre o usuário autenticado.
drop policy if exists "calendar events insert" on public.calendar_events;
create policy "calendar events insert" on public.calendar_events for insert to authenticated
  with check (owner_id = auth.uid());

-- Edição/remoção: o dono sempre; gestão pode gerir os eventos NÃO privados.
drop policy if exists "calendar events update" on public.calendar_events;
create policy "calendar events update" on public.calendar_events for update to authenticated
  using (owner_id = auth.uid() or (is_private = false and public.auth_role() in ('ADMINISTRATIVO','GESTOR')))
  with check (owner_id = auth.uid() or (is_private = false and public.auth_role() in ('ADMINISTRATIVO','GESTOR')));

drop policy if exists "calendar events delete" on public.calendar_events;
create policy "calendar events delete" on public.calendar_events for delete to authenticated
  using (owner_id = auth.uid() or (is_private = false and public.auth_role() in ('ADMINISTRATIVO','GESTOR')));
