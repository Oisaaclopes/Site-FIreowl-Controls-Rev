-- ETAPA 3 — Contratos estruturados. NÃO transforma contracts numa tabela gigante:
-- adiciona escalares/arrays planos em contracts e cria tabelas filhas só para o
-- que é genuinamente relacional/rastreável (rotinas, execuções por competência,
-- bolsa de horas, anexos). Aditivo e idempotente. Requer 0020/0022/0048 (contracts),
-- 0033 (ordens_servico), 0029 (reports), 0032 (bucket report-media).

-- ===================== A/B/C/E/H..P — colunas no contrato =====================
-- Identificação
alter table public.contracts add column if not exists numero                text;
alter table public.contracts add column if not exists responsavel_comercial  text;
-- Vigência
alter table public.contracts add column if not exists renovacao_automatica   boolean default false;
alter table public.contracts add column if not exists aviso_antecedencia_dias integer;
alter table public.contracts add column if not exists reajuste_periodicidade_meses integer default 12;
-- Financeiro
alter table public.contracts add column if not exists faturamento            text;
alter table public.contracts add column if not exists impostos_obs           text;
alter table public.contracts add column if not exists observacoes_financeiras text;
-- Áreas cobertas / tipo de atendimento (multi-select plano)
alter table public.contracts add column if not exists areas_cobertas         text[] not null default '{}';
alter table public.contracts add column if not exists tipos_atendimento      text[] not null default '{}';
-- Incluso / Não incluso / Responsabilidades / Entregáveis (listas planas)
alter table public.contracts add column if not exists incluso                text[] not null default '{}';
alter table public.contracts add column if not exists nao_incluso            text[] not null default '{}';
alter table public.contracts add column if not exists resp_contratada        text[] not null default '{}';
alter table public.contracts add column if not exists resp_contratante       text[] not null default '{}';
alter table public.contracts add column if not exists entregaveis            text[] not null default '{}';
-- Materiais
alter table public.contracts add column if not exists materiais_politica     text;  -- inclusos/nao_inclusos/limite/so_mao_de_obra/mediante_aprovacao
alter table public.contracts add column if not exists materiais_obs          text;
-- SLA (poucas linhas situação→prazo; jsonb pequeno, não "gigante")
alter table public.contracts add column if not exists sla                    jsonb not null default '[]'::jsonb;
-- Observações / cláusulas operacionais
alter table public.contracts add column if not exists observacoes_operacionais text;

-- ===================== F — Rotinas de atendimento =====================
create table if not exists public.contract_routines (
  id             uuid primary key default gen_random_uuid(),
  contract_id    text not null references public.contracts(id) on delete cascade,
  tipo           text not null default 'preventiva',   -- preventiva/corretiva/inspecao/operacao/suporte
  descricao      text,
  frequencia     text,             -- mensal/bimestral/trimestral/semestral/anual/semanal/sob_demanda
  intervalo_meses integer,         -- passo p/ próxima competência (1=mensal, 3=trimestral, 12=anual)
  dia_regra      text,             -- primeiro_dia_util / ultimo_dia_util / dia_fixo:N / primeira_segunda ...
  dias_semana    text[] not null default '{}',  -- {seg,ter,qua,qui,sex,sab,dom}
  horario_inicio text,
  horario_fim    text,
  qtd_tecnicos   integer default 1,
  horas_mensais  numeric,
  visitas_mes    integer,
  sla            text,
  area           text,
  ativo          boolean not null default true,
  observacoes    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists contract_routines_contract_idx on public.contract_routines (contract_id);

-- ===================== F/Agenda — Execuções por competência =====================
-- Materializa APENAS competências solicitadas (não cria OS antecipadamente).
-- UNIQUE(routine_id, competencia) garante idempotência (mesma competência nunca duplica).
create table if not exists public.contract_routine_executions (
  id               uuid primary key default gen_random_uuid(),
  contract_id      text not null references public.contracts(id) on delete cascade,
  routine_id       uuid not null references public.contract_routines(id) on delete cascade,
  competencia      text not null,       -- '2026-09' (mensal) / '2026-Q3' / '2026' (anual)
  data_programada  date,
  status           text not null default 'previsto'
                   check (status in ('previsto','agendado','os_gerada','executado','relatorio_emitido','cancelado')),
  ordem_servico_id uuid references public.ordens_servico(id) on delete set null,
  report_id        uuid references public.reports(id) on delete set null,
  observacoes      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (routine_id, competencia)
);
create index if not exists contract_exec_contract_idx on public.contract_routine_executions (contract_id);
create index if not exists contract_exec_routine_idx  on public.contract_routine_executions (routine_id);
create index if not exists contract_exec_status_idx   on public.contract_routine_executions (status);

-- ===================== N — Bolsa de horas rastreável =====================
create table if not exists public.contract_hour_ledger (
  id               uuid primary key default gen_random_uuid(),
  contract_id      text not null references public.contracts(id) on delete cascade,
  tipo             text not null check (tipo in ('contratada','consumida','ajuste')),
  horas            numeric not null,       -- contratada/ajuste(+) creditam; consumida debita
  referencia       text,
  ordem_servico_id uuid references public.ordens_servico(id) on delete set null,
  data             date not null default current_date,
  criado_por       uuid default auth.uid(),
  created_at       timestamptz not null default now()
);
create index if not exists contract_hours_contract_idx on public.contract_hour_ledger (contract_id);

-- ===================== O — Documentos/anexos (reutiliza bucket report-media) =====================
create table if not exists public.contract_attachments (
  id           uuid primary key default gen_random_uuid(),
  contract_id  text not null references public.contracts(id) on delete cascade,
  tipo         text not null default 'anexo',   -- proposta/contrato_pdf/art/anexo
  nome         text,
  storage_path text not null,                   -- report-media: contracts/{contract_id}/...
  mime         text,
  tamanho      integer,
  criado_por   uuid default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists contract_attachments_contract_idx on public.contract_attachments (contract_id);

-- ===================== RLS (ADMIN/GESTOR/FINANCEIRO, espelhando contracts) =====================
do $$
declare t text;
begin
  foreach t in array array[
    'contract_routines','contract_routine_executions','contract_hour_ledger','contract_attachments'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
    execute format('drop policy if exists "%s rw" on public.%I;', t, t);
    execute format($p$create policy "%s rw" on public.%I for all to authenticated
      using (public.auth_role() in ('ADMINISTRATIVO','GESTOR','FINANCEIRO'))
      with check (public.auth_role() in ('ADMINISTRATIVO','GESTOR','FINANCEIRO'));$p$, t, t);
  end loop;
end $$;

-- updated_at automático nas tabelas que têm a coluna (reusa set_updated_at de 0033).
drop trigger if exists contract_routines_set_updated_at on public.contract_routines;
create trigger contract_routines_set_updated_at before update on public.contract_routines
  for each row execute function public.set_updated_at();
drop trigger if exists contract_exec_set_updated_at on public.contract_routine_executions;
create trigger contract_exec_set_updated_at before update on public.contract_routine_executions
  for each row execute function public.set_updated_at();

-- ===================== RPC idempotente: materializa uma competência =====================
-- Cria (ou devolve) a execução de UMA competência de uma rotina, sem duplicar e
-- sem criar OS. Retorna jsonb { id, competencia, status, already_exists }.
create or replace function public.ensure_routine_execution(
  p_routine_id uuid, p_competencia text, p_data_programada date
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_contract text;
  v_row public.contract_routine_executions%rowtype;
begin
  if p_competencia is null or length(trim(p_competencia)) = 0 then
    raise exception 'competencia obrigatoria';
  end if;
  select contract_id into v_contract from public.contract_routines where id = p_routine_id;
  if v_contract is null then raise exception 'rotina % nao encontrada', p_routine_id; end if;

  insert into public.contract_routine_executions (contract_id, routine_id, competencia, data_programada)
  values (v_contract, p_routine_id, p_competencia, p_data_programada)
  on conflict (routine_id, competencia) do nothing;

  select * into v_row from public.contract_routine_executions
    where routine_id = p_routine_id and competencia = p_competencia;

  return jsonb_build_object(
    'id', v_row.id, 'competencia', v_row.competencia, 'status', v_row.status,
    'data_programada', v_row.data_programada,
    'already_exists', (v_row.created_at < now() - interval '1 second')
  );
end;
$$;
grant execute on function public.ensure_routine_execution(uuid, text, date) to authenticated;
