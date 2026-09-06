-- ETAPA MANUTENÇÃO CONTRATUAL — motor genérico de manutenção sobre o que já existe.
--
-- Auditoria (docs/AUDITORIA_MANUTENCAO_CONTRATUAL.md, DESENHO_FINAL_0106.md): a
-- base já orquestra Contrato → Rotina → Execução(competência) → OS → Atendimento
-- → Testes/Fotos/Pendências → Base Técnica canônica (devices). Esta migration NÃO
-- cria módulo paralelo e NÃO cria maintenance_cycles: adiciona só o mínimo real —
--   1) asset_maintenance_policies  = periodicidade de manutenção configurável e
--      MULTIDISCIPLINAR (escopo PADRAO/CLIENTE/CONTRATO/ATIVO + filtros de
--      classificação canônica área/grupo/tipo_ativo). Precedência: ATIVO >
--      CONTRATO > CLIENTE > PADRAO; no mesmo escopo, maior especificidade vence.
--      A resolução da "effective policy" é PURA/OFFLINE em lib/maintenancePolicies.ts
--      (a criar na fase de código) — SEM RPC obrigatória, para não travar o campo.
--   2) contract_routines.template_codigo = qual template a rotina usa (a VERSÃO
--      executada continua congelada em reports.template_snapshot/template_version).
--   3) reports.service_attendance_id = documento técnico ↔ atendimento (0..N por
--      atendimento; consolidado MANUTENCAO fica NULL, pois agrega N atendimentos).
--   4) reports período documental (period_start/period_end/competencia) —
--      contrato_id/cliente_id JÁ existem (0029) e são reutilizados.
--   5) reports snapshot documental + revisão R00/R01/R02 (nova linha supersede;
--      finalizado permanece imutável — RLS 0029 + trigger 0075 estendido aqui).
--   6) reports.tipo/report_templates.tipo += 'MANUTENCAO' (sem alterar os tipos
--      existentes LEVANTAMENTO/CORRETIVA/PREVENTIVA).
--
-- ADITIVA, idempotente, não-destrutiva. Requer 0018 (clients), 0020/0056
-- (contracts/contract_routines), 0024 (report_templates), 0029 (reports),
-- 0075 (reports_freeze_template_snapshot), 0083 (service_attendances),
-- 0094 (devices + grupo/tipo_ativo). NÃO edita/reaplica 0001–0105 (já em produção).
-- REVISAR e rodar no SQL Editor do Supabase — o agente não aplica migrations.

-- =====================================================================
-- 0) set_updated_at (reaproveita o de 0033/0083; cria se ausente — idempotente).
-- =====================================================================
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

-- =====================================================================
-- 1) asset_maintenance_policies — periodicidade configurável multidisciplinar.
--    escopo (PADRAO/CLIENTE/CONTRATO/ATIVO) + filtros de classificação canônica
--    (area/grupo/tipo_ativo). NÃO duplica a taxonomia da Base: usa os mesmos
--    valores de devices.sistema (area), devices.grupo e devices.tipo_ativo.
-- =====================================================================
create table if not exists public.asset_maintenance_policies (
  id                     uuid primary key default gen_random_uuid(),
  escopo                 text not null
                         check (escopo in ('PADRAO','CLIENTE','CONTRATO','ATIVO')),
  -- filtros de classificação (curinga quando null). Mesmos domínios da Base.
  area                   text
                         check (area is null or area in ('SDAI','CFTV','CONTROLE_ACESSO','BMS','ALARME')),
  grupo                  text,                                   -- devices.grupo (família)
  tipo_ativo             text,                                   -- devices.tipo_ativo (tipo canônico)
  -- âncoras do escopo
  cliente_id             text references public.clients(id)   on delete cascade,
  contract_id            text references public.contracts(id) on delete cascade,
  device_id              uuid references public.devices(id)   on delete cascade,
  -- payload da política
  periodicidade_meses    numeric not null check (periodicidade_meses > 0),
  obrigatorio_no_ciclo   boolean not null default false,
  janela_tolerancia_dias integer check (janela_tolerancia_dias is null or janela_tolerancia_dias >= 0),
  ativa                  boolean not null default true,
  observacao             text,
  created_by             uuid default auth.uid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  -- coerência âncora × escopo
  constraint amp_escopo_ativo    check (escopo <> 'ATIVO'    or device_id  is not null),
  constraint amp_escopo_contrato check (escopo <> 'CONTRATO' or contract_id is not null),
  constraint amp_escopo_cliente  check (escopo <> 'CLIENTE'  or cliente_id  is not null),
  -- PADRAO é Fireowl: sem âncora de cliente/contrato/ativo (só classificação)
  constraint amp_escopo_padrao   check (escopo <> 'PADRAO'
                                        or (cliente_id is null and contract_id is null and device_id is null))
);

create index if not exists amp_contract_idx  on public.asset_maintenance_policies (contract_id) where contract_id is not null;
create index if not exists amp_device_idx    on public.asset_maintenance_policies (device_id)   where device_id  is not null;
create index if not exists amp_cliente_idx   on public.asset_maintenance_policies (cliente_id)  where cliente_id is not null;
create index if not exists amp_area_tipo_idx on public.asset_maintenance_policies (area, tipo_ativo);

-- Antiduplicação por escopo + classificação (só ativas): impede duas políticas
-- conflitantes na MESMA especificidade (permite políticas em escopos diferentes).
create unique index if not exists amp_uq_ativo
  on public.asset_maintenance_policies (device_id)
  where escopo = 'ATIVO' and ativa;
create unique index if not exists amp_uq_contrato
  on public.asset_maintenance_policies (contract_id, coalesce(area,''), coalesce(grupo,''), coalesce(tipo_ativo,''))
  where escopo = 'CONTRATO' and ativa;
create unique index if not exists amp_uq_cliente
  on public.asset_maintenance_policies (cliente_id, coalesce(area,''), coalesce(grupo,''), coalesce(tipo_ativo,''))
  where escopo = 'CLIENTE' and ativa;
create unique index if not exists amp_uq_padrao
  on public.asset_maintenance_policies (coalesce(area,''), coalesce(grupo,''), coalesce(tipo_ativo,''))
  where escopo = 'PADRAO' and ativa;

drop trigger if exists amp_set_updated_at on public.asset_maintenance_policies;
create trigger amp_set_updated_at
  before update on public.asset_maintenance_policies
  for each row execute function public.set_updated_at();

comment on table public.asset_maintenance_policies is
  'Periodicidade de manutenção configurável (§14). Precedência ATIVO>CONTRATO>'
  'CLIENTE>PADRAO; no mesmo escopo, maior especificidade de classificação vence. '
  'Resolução da effective policy é PURA/OFFLINE (lib/maintenancePolicies.ts), sem RPC.';

alter table public.asset_maintenance_policies enable row level security;
grant select, insert, update, delete on public.asset_maintenance_policies to authenticated;

-- Técnico LÊ (periodicidade em campo/offline); gestão CONFIGURA. Sem USING(true).
drop policy if exists "amp select" on public.asset_maintenance_policies;
create policy "amp select" on public.asset_maintenance_policies for select to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'));

drop policy if exists "amp write" on public.asset_maintenance_policies;
create policy "amp write" on public.asset_maintenance_policies for all to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR'))
  with check (public.auth_role() in ('ADMINISTRATIVO','GESTOR'));

-- =====================================================================
-- 2) contract_routines.template_codigo — qual template a rotina usa (soft; a
--    versão executada continua congelada em reports.template_snapshot/version).
-- =====================================================================
alter table public.contract_routines
  add column if not exists template_codigo text;   -- report_templates.codigo (unique); sem FK (rename/seed/legado)

comment on column public.contract_routines.template_codigo is
  'Código do template (report_templates.codigo) que a rotina normalmente usa. '
  'Sem FK (convenção catalog_item_id). NÃO versiona: a versão executada é '
  'congelada em reports.template_snapshot/template_version (0075).';

-- =====================================================================
-- 3/4/5) reports — vínculo a atendimento, período documental, snapshot e revisão.
--    contrato_id/cliente_id JÁ existem (0029) e são reutilizados.
-- =====================================================================
alter table public.reports
  -- 3) documento técnico ↔ atendimento (0..N por atendimento; consolidado = NULL)
  add column if not exists service_attendance_id uuid
      references public.service_attendances(id) on delete set null,
  -- 4) período documental explícito (fonte da verdade do consolidado; competencia = label)
  add column if not exists period_start date,
  add column if not exists period_end   date,
  add column if not exists competencia  text,
  -- 5) snapshot documental congelado + revisão (R00→R01→R02, nova linha supersede)
  add column if not exists snapshot             jsonb,
  add column if not exists revisao              text not null default 'R00',
  add column if not exists fechado_em           timestamptz,
  add column if not exists supersedes_report_id uuid
      references public.reports(id) on delete set null;

comment on column public.reports.service_attendance_id is
  'Atendimento (service_attendances) que originou este documento técnico. 0..N '
  'documentos por atendimento (SEM unique). NULL no consolidado MANUTENCAO (agrega N).';
comment on column public.reports.snapshot is
  'Estado documental CONGELADO na emissão (§22/§23). Reproduz o documento sem '
  'depender de tabelas operacionais futuras. Guarda REFERÊNCIAS (ids/paths), nunca '
  'arquivos físicos. Distinto de resumo_execucao (contadores). Imutável após set.';
comment on column public.reports.revisao is
  'Revisão documental R00/R01/R02… R00 finalizado é imutável; correção = NOVA '
  'linha com supersedes_report_id apontando a anterior.';

-- Índices
create index if not exists reports_attendance_idx
  on public.reports (service_attendance_id) where service_attendance_id is not null;
create index if not exists reports_contract_period_idx
  on public.reports (contrato_id, period_start, period_end)
  where contrato_id is not null and period_start is not null;
create index if not exists reports_supersedes_idx
  on public.reports (supersedes_report_id) where supersedes_report_id is not null;

-- CHECKs (guardados/idempotentes; validam também as linhas existentes — como os
-- registros atuais NÃO são MANUTENCAO e têm período NULL, todos passam).
do $$
begin
  -- ordenação do período (null-safe)
  if not exists (select 1 from pg_constraint where conrelid='public.reports'::regclass and conname='reports_period_order_check') then
    alter table public.reports add constraint reports_period_order_check
      check (period_start is null or period_end is null or period_end >= period_start);
  end if;
  -- formato da revisão (R + >=2 dígitos)
  if not exists (select 1 from pg_constraint where conrelid='public.reports'::regclass and conname='reports_revisao_format_check') then
    alter table public.reports add constraint reports_revisao_format_check
      check (revisao ~ '^R[0-9]{2,}$');
  end if;
  -- sem auto-supersessão óbvia
  if not exists (select 1 from pg_constraint where conrelid='public.reports'::regclass and conname='reports_supersedes_self_check') then
    alter table public.reports add constraint reports_supersedes_self_check
      check (supersedes_report_id is null or supersedes_report_id <> id);
  end if;
  -- MANUTENCAO exige contrato + período (NÃO retroativo aos outros tipos)
  if not exists (select 1 from pg_constraint where conrelid='public.reports'::regclass and conname='reports_manutencao_requires_check') then
    alter table public.reports add constraint reports_manutencao_requires_check
      check (tipo <> 'MANUTENCAO' or (contrato_id is not null and period_start is not null and period_end is not null));
  end if;
end $$;

-- Um único documento MANUTENCAO por (contrato, período, revisão) não-cancelado.
-- Permite R00 + R01 (revisao difere); bloqueia dois R00 do mesmo período.
create unique index if not exists reports_manutencao_periodo_revisao_uq
  on public.reports (contrato_id, period_start, period_end, revisao)
  where tipo = 'MANUTENCAO' and status <> 'cancelado';

-- =====================================================================
-- 5b) Imutabilidade do snapshot documental — ESTENDE o trigger da 0075 (NÃO
--     edita a 0075: create or replace da MESMA função; o trigger já existe).
--     Mantém o congelamento de template_snapshot e adiciona snapshot/revisao/
--     fechado_em: uma vez que o snapshot documental é gravado, nunca muda
--     (reenvio idêntico é no-op; tentativa de troca é revertida sem erro).
-- =====================================================================
create or replace function public.reports_freeze_template_snapshot()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- (0075) definição do template: imutável após set.
  if old.template_snapshot is not null then
    new.template_snapshot := old.template_snapshot;
    new.template_version  := old.template_version;
  end if;
  -- (0106) snapshot documental do fechamento: imutável após set.
  if old.snapshot is not null then
    new.snapshot    := old.snapshot;
    new.revisao     := old.revisao;
    new.fechado_em  := old.fechado_em;
  end if;
  return new;
end;
$$;
-- trigger reports_freeze_template_snapshot já criado na 0075 sobre reports.

-- =====================================================================
-- 6) reports.tipo / report_templates.tipo += 'MANUTENCAO'. NÃO assume o nome do
--    constraint: dropa dinamicamente o CHECK do domínio (contém 'LEVANTAMENTO' e
--    ainda NÃO contém 'MANUTENCAO') e recria nomeado. Idempotente (o novo CHECK
--    contém 'MANUTENCAO' e não é redropado numa reexecução).
-- =====================================================================
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
     where conrelid = 'public.reports'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) like '%LEVANTAMENTO%'
       and pg_get_constraintdef(oid) not like '%MANUTENCAO%'
  loop
    execute format('alter table public.reports drop constraint %I', r.conname);
  end loop;
  if not exists (select 1 from pg_constraint where conrelid='public.reports'::regclass and conname='reports_tipo_check') then
    alter table public.reports add constraint reports_tipo_check
      check (tipo in ('LEVANTAMENTO','CORRETIVA','PREVENTIVA','MANUTENCAO'));
  end if;
end $$;

do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
     where conrelid = 'public.report_templates'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) like '%LEVANTAMENTO%'
       and pg_get_constraintdef(oid) not like '%MANUTENCAO%'
  loop
    execute format('alter table public.report_templates drop constraint %I', r.conname);
  end loop;
  if not exists (select 1 from pg_constraint where conrelid='public.report_templates'::regclass and conname='report_templates_tipo_check') then
    alter table public.report_templates add constraint report_templates_tipo_check
      check (tipo in ('LEVANTAMENTO','CORRETIVA','PREVENTIVA','MANUTENCAO'));
  end if;
end $$;

-- =====================================================================
-- 7) Realtime — adiciona a nova tabela à publicação existente (RLS continua
--    valendo). Idempotente. Não cria canal novo (§27/§44).
-- =====================================================================
do $$
begin
  if to_regclass('public.asset_maintenance_policies') is not null
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public'
         and tablename = 'asset_maintenance_policies'
     ) then
    execute 'alter publication supabase_realtime add table public.asset_maintenance_policies';
  end if;
end $$;
