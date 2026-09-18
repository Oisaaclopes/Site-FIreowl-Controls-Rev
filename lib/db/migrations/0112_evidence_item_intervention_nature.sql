-- NATUREZA DA INTERVENÇÃO por Item de Evidência (MANUTENÇÃO × INSTALAÇÃO ×
-- SUBSTITUIÇÃO).
--
-- CONTEXTO: o modelo de evidência ANTES → DURANTE → DEPOIS faz sentido para
-- manutenção/intervenção em equipamento existente. Em INSTALAÇÃO nova não existe
-- "antes" do equipamento; em SUBSTITUIÇÃO há dois ativos (anterior → novo). A
-- SUBSTITUIÇÃO já era representável por `equipment_replaced=true` (0093/0098),
-- mas MANUTENÇÃO e INSTALAÇÃO ficavam ambas com `equipment_replaced=false` —
-- indistinguíveis. Auditoria confirmou que NÃO há coluna livre nem JSONB em
-- service_attendance_evidence_items ou service_attendances para guardar a
-- escolha explícita do técnico. Persistimos a natureza como coluna própria do
-- ITEM (a natureza pertence à intervenção, não ao Atendimento: um mesmo
-- Atendimento pode conter MANUTENCAO, INSTALACAO e SUBSTITUICAO ao mesmo tempo).
--
-- COMPATIBILIDADE: NULLABLE. NULL = registros históricos = comportamento legado
-- (renderiza como manutenção Antes/Durante/Depois). Novos itens gravam a escolha
-- explícita. Nenhum backfill, nenhuma reescrita de histórico; relatórios
-- finalizados continuam imutáveis (usam snapshot próprio).
--
-- RLS: nenhuma policy nova. A coluna herda as policies de
-- service_attendance_evidence_items (0088, via owns_attendance_item). Sem service
-- role. Sem trigger. Sem enum de resultado paralelo (o resultado do item/
-- atendimento continua no `status`/`result` existentes).
--
-- Aditiva, idempotente, não-destrutiva. Requer 0088
-- (service_attendance_evidence_items). NÃO edita 0088/0089/0093/0098. Não toca
-- lifecycle do Atendimento, technical_catalog, devices/Base canônica nem deploy.

alter table public.service_attendance_evidence_items
  add column if not exists natureza_intervencao text;

-- Constraint com nome EXPLÍCITO (facilita manutenção futura). Idempotente:
-- só adiciona se ainda não existir.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'service_attendance_evidence_items_natureza_intervencao_check'
      and conrelid = 'public.service_attendance_evidence_items'::regclass
  ) then
    alter table public.service_attendance_evidence_items
      add constraint service_attendance_evidence_items_natureza_intervencao_check
      check (natureza_intervencao is null or natureza_intervencao in
        ('MANUTENCAO','INSTALACAO','SUBSTITUICAO'));
  end if;
end $$;

comment on column public.service_attendance_evidence_items.natureza_intervencao is
  'Natureza da intervenção DESTE item (escolha explícita do técnico): '
  'MANUTENCAO (equipamento existente, Antes/Durante/Depois), INSTALACAO '
  '(equipamento novo — sem "antes" obrigatório; evidência principal = instalado + '
  'teste), SUBSTITUICAO (anterior → novo, usa equipment_replaced/device_id/'
  'replacement_device_id). NULL = item histórico anterior à 0112 = tratar como '
  'MANUTENCAO na renderização, sem reescrever o registro.';
