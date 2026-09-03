-- ETAPA OPERACIONAL 3A — Operação de Campo + Atendimento.
--
-- Separa três mundos que hoje colapsam em "OS":
--   CONTRATO      = relação contínua com o cliente (public.contracts).
--   OPERAÇÃO      = atividade operacional RECORRENTE ligada a um contrato/cliente
--                   (ex.: Rhuan auditando o Catuaí todo dia). NÃO gera OS por dia.
--   ATENDIMENTO   = execução/visita REAL de um técnico referente a UMA OS. Uma OS
--                   pode ter 0..N atendimentos; nunca 1 OS == 1 atendimento.
--
-- Convenção de tipos (espelha o schema existente): clients.id e contracts.id são
-- TEXT (tabelas legadas); ordens_servico.id e profiles.id são UUID.
-- Requer 0018 (clients), 0020 (contracts), 0033 (ordens_servico), 0004 (profiles),
-- 0005 (auth_role). Idempotente; não destrói dados.

-- Trigger genérico de updated_at (reaproveita o de 0033 se já existir).
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

-- ==========================================================================
-- 1. OPERAÇÃO DE CAMPO — atividade operacional recorrente por cliente/contrato.
-- ==========================================================================
create table if not exists public.field_operations (
  id                  uuid primary key default gen_random_uuid(),
  client_id           text references public.clients(id)   on delete set null,
  contract_id         text references public.contracts(id) on delete set null,
  name                text not null,
  description         text,
  operation_type      text not null default 'OUTRO'
                      check (operation_type in
                        ('AUDITORIA','PREVENTIVA','OPERACAO_RESIDENTE','INSPECAO','ACOMPANHAMENTO','OUTRO')),
  status              text not null default 'PLANEJADA'
                      check (status in ('PLANEJADA','ATIVA','PAUSADA','ENCERRADA')),
  start_date          date,
  end_date            date,
  -- Preparação para sistema externo de auditoria (§18/§19). Opcional; a URL NUNCA
  -- é hardcoded no componente — vem daqui. Não implica integração agora.
  external_system_url text,
  external_reference  text,
  created_by          uuid default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists field_operations_client_idx   on public.field_operations (client_id);
create index if not exists field_operations_contract_idx on public.field_operations (contract_id);
create index if not exists field_operations_status_idx    on public.field_operations (status);

drop trigger if exists field_operations_set_updated_at on public.field_operations;
create trigger field_operations_set_updated_at
  before update on public.field_operations
  for each row execute function public.set_updated_at();

-- ==========================================================================
-- 2. ALOCAÇÃO DE TÉCNICOS — N:N (uma operação pode ter 1..N técnicos).
--    Não usamos technician_id direto na operação para não travar múltiplos.
-- ==========================================================================
create table if not exists public.field_operation_assignments (
  id            uuid primary key default gen_random_uuid(),
  operation_id  uuid not null references public.field_operations(id) on delete cascade,
  technician_id uuid not null references public.profiles(id) on delete cascade,
  start_date    date,
  end_date      date,
  status        text not null default 'ATIVO'
                check (status in ('ATIVO','ENCERRADO')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (operation_id, technician_id)
);

create index if not exists foa_operation_idx  on public.field_operation_assignments (operation_id);
create index if not exists foa_technician_idx on public.field_operation_assignments (technician_id);

drop trigger if exists foa_set_updated_at on public.field_operation_assignments;
create trigger foa_set_updated_at
  before update on public.field_operation_assignments
  for each row execute function public.set_updated_at();

-- ==========================================================================
-- 3. ATENDIMENTO — execução/visita real de UMA OS. 0..N por OS.
-- ==========================================================================
create table if not exists public.service_attendances (
  id              uuid primary key default gen_random_uuid(),
  work_order_id   uuid not null references public.ordens_servico(id) on delete cascade,
  technician_id   uuid not null references public.profiles(id) on delete set null,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  status          text not null default 'EM_EXECUCAO'
                  check (status in ('EM_EXECUCAO','FINALIZADO')),
  -- Resultado é do ATENDIMENTO, NÃO da OS: um atendimento PARCIALMENTE_RESOLVIDO
  -- pode conviver com uma OS ainda aberta.
  result          text
                  check (result is null or result in
                    ('RESOLVIDO','PARCIALMENTE_RESOLVIDO','NAO_RESOLVIDO')),
  diagnosis       text,
  execution_notes text,
  -- GPS pontual de início/fim (§16): sem rastreamento contínuo, sem background.
  latitude_start  double precision,
  longitude_start double precision,
  latitude_end    double precision,
  longitude_end   double precision,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists service_attendances_os_idx    on public.service_attendances (work_order_id);
create index if not exists service_attendances_tech_idx  on public.service_attendances (technician_id);
create index if not exists service_attendances_status_idx on public.service_attendances (status);
-- Um técnico não deve ter dois atendimentos EM_EXECUCAO simultâneos.
create unique index if not exists service_attendances_one_active_per_tech
  on public.service_attendances (technician_id)
  where status = 'EM_EXECUCAO';

drop trigger if exists service_attendances_set_updated_at on public.service_attendances;
create trigger service_attendances_set_updated_at
  before update on public.service_attendances
  for each row execute function public.set_updated_at();

-- ==========================================================================
-- 4. RLS — sem USING(true), sem policy genérica p/ authenticated, sem service role.
-- ==========================================================================
alter table public.field_operations             enable row level security;
alter table public.field_operation_assignments  enable row level security;
alter table public.service_attendances          enable row level security;

grant select, insert, update, delete on public.field_operations            to authenticated;
grant select, insert, update, delete on public.field_operation_assignments to authenticated;
grant select, insert, update, delete on public.service_attendances         to authenticated;

-- ----- field_operations -----
-- Gestão administra; TÉCNICO enxerga apenas operações às quais está alocado.
drop policy if exists "field_operations select" on public.field_operations;
create policy "field_operations select" on public.field_operations for select to authenticated
  using (
    public.auth_role() in ('ADMINISTRATIVO','GESTOR','FINANCEIRO')
    or exists (
      select 1 from public.field_operation_assignments a
      where a.operation_id = field_operations.id and a.technician_id = auth.uid()
    )
  );

drop policy if exists "field_operations insert" on public.field_operations;
create policy "field_operations insert" on public.field_operations for insert to authenticated
  with check (public.auth_role() in ('ADMINISTRATIVO','GESTOR'));

drop policy if exists "field_operations update" on public.field_operations;
create policy "field_operations update" on public.field_operations for update to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR'))
  with check (public.auth_role() in ('ADMINISTRATIVO','GESTOR'));

drop policy if exists "field_operations delete" on public.field_operations;
create policy "field_operations delete" on public.field_operations for delete to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR'));

-- ----- field_operation_assignments -----
-- TÉCNICO vê a própria alocação; gestão administra todas.
drop policy if exists "foa select" on public.field_operation_assignments;
create policy "foa select" on public.field_operation_assignments for select to authenticated
  using (
    public.auth_role() in ('ADMINISTRATIVO','GESTOR','FINANCEIRO')
    or technician_id = auth.uid()
  );

drop policy if exists "foa insert" on public.field_operation_assignments;
create policy "foa insert" on public.field_operation_assignments for insert to authenticated
  with check (public.auth_role() in ('ADMINISTRATIVO','GESTOR'));

drop policy if exists "foa update" on public.field_operation_assignments;
create policy "foa update" on public.field_operation_assignments for update to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR'))
  with check (public.auth_role() in ('ADMINISTRATIVO','GESTOR'));

drop policy if exists "foa delete" on public.field_operation_assignments;
create policy "foa delete" on public.field_operation_assignments for delete to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR'));

-- ----- service_attendances -----
-- TÉCNICO gerencia os PRÓPRIOS atendimentos (iniciar/finalizar); gestão vê tudo.
drop policy if exists "service_attendances select" on public.service_attendances;
create policy "service_attendances select" on public.service_attendances for select to authenticated
  using (
    public.auth_role() in ('ADMINISTRATIVO','GESTOR','FINANCEIRO')
    or technician_id = auth.uid()
  );

drop policy if exists "service_attendances insert" on public.service_attendances;
create policy "service_attendances insert" on public.service_attendances for insert to authenticated
  with check (
    public.auth_role() in ('ADMINISTRATIVO','GESTOR')
    or technician_id = auth.uid()
  );

drop policy if exists "service_attendances update" on public.service_attendances;
create policy "service_attendances update" on public.service_attendances for update to authenticated
  using (
    public.auth_role() in ('ADMINISTRATIVO','GESTOR')
    or technician_id = auth.uid()
  )
  with check (
    public.auth_role() in ('ADMINISTRATIVO','GESTOR')
    or technician_id = auth.uid()
  );

drop policy if exists "service_attendances delete" on public.service_attendances;
create policy "service_attendances delete" on public.service_attendances for delete to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR'));

-- ==========================================================================
-- 5. Realtime — adiciona as novas tabelas à publicação existente (RLS continua
--    valendo). Idempotente para ambientes parcialmente ativados.
-- ==========================================================================
do $$
declare
  t text;
  tables text[] := array['field_operations','field_operation_assignments','service_attendances'];
begin
  foreach t in array tables loop
    if to_regclass(format('public.%I', t)) is not null
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
       ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
