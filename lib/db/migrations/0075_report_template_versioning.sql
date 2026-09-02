-- CAMPO 2B — Versionamento de templates e SNAPSHOT IMUTÁVEL do formulário usado
-- pelo relatório (integridade histórica). ADITIVA, idempotente, SEM backfill
-- especulativo e SEM perda de dados. Requer 0024 (report_templates), 0025/0029
-- (reports). REVISAR e rodar no SQL Editor do Supabase — o agente não aplica
-- migrations. NÃO editar/reaplicar migrations anteriores (0074 já em produção).
--
-- Modelo (Opção B): report_templates guarda a versão VIGENTE por código; o
-- HISTÓRICO FIEL vive no snapshot de cada relatório. Evoluir um template NUNCA
-- reinterpreta relatórios antigos. Ver docs/TEMPLATE_VERSIONING.md.

-- =====================================================================
-- 1) reports: versão + snapshot imutável da definição usada.
-- =====================================================================
alter table public.reports
  add column if not exists template_version integer,
  add column if not exists template_snapshot jsonb;

comment on column public.reports.template_snapshot is
  'DEFINIÇÃO congelada (TemplateSchema JSON) usada neste relatório. Imutável após preenchida. NÃO contém answers/fotos/assinatura.';

-- =====================================================================
-- 2) report_templates: hash do schema para detecção de mudança no seed
--    (publicação versionada e não-destrutiva). NÃO altera a unicidade por
--    código (a tabela segue representando a versão vigente).
-- =====================================================================
alter table public.report_templates
  add column if not exists schema_hash text;

-- =====================================================================
-- 3) IMUTABILIDADE no banco (FASE 17): permite PREENCHER o snapshot/versão
--    quando NULL (primeira gravação), mas IMPEDE alteração posterior — sem
--    quebrar sync/offline (reenvio idêntico é no-op; tentativa de troca é
--    silenciosamente revertida ao valor original, não lança erro).
-- =====================================================================
create or replace function public.reports_freeze_template_snapshot()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Snapshot já definido: nunca muda. Reverte qualquer tentativa de alteração.
  if old.template_snapshot is not null then
    new.template_snapshot := old.template_snapshot;
    new.template_version  := old.template_version;
  end if;
  return new;
end;
$$;

drop trigger if exists reports_freeze_template_snapshot on public.reports;
create trigger reports_freeze_template_snapshot
  before update on public.reports
  for each row execute function public.reports_freeze_template_snapshot();

-- =====================================================================
-- 4) SEM backfill (FASE 6/27): relatórios legados permanecem com
--    template_snapshot NULL e são resolvidos por fallback controlado ao
--    template vigente em runtime. Não inventamos proveniência histórica.
-- =====================================================================
