-- ANTES × DEPOIS por Item de Evidência — SUBSTITUIÇÃO de equipamento.
--
-- Hoje o Item guarda UMA identificação (manufacturer/model/catalog_item_id/
-- equipment_type/device_address) = o equipamento ENCONTRADO (antes). Isso é
-- insuficiente quando há troca (ex.: Tecnohold IP20 → Tecnohold IP67, ou
-- Detector Tecnohold → Detector Intelbras). Acrescentamos a identificação do
-- equipamento INSTALADO (depois) + um flag de substituição, SEM duplicar o Item.
--
-- O flag é decisão do TÉCNICO (o software registra o que foi executado; NÃO
-- infere compatibilidade — §21W). Aditiva, idempotente. Independe da 0086.
-- NÃO edita 0088/0089. Requer 0088 (service_attendance_evidence_items).

alter table public.service_attendance_evidence_items
  add column if not exists equipment_replaced boolean not null default false,
  add column if not exists equipment_final_catalog_item_id text,
  add column if not exists equipment_final_manufacturer text,
  add column if not exists equipment_final_model text,
  add column if not exists equipment_final_type text,
  add column if not exists device_address_final text;

comment on column public.service_attendance_evidence_items.equipment_replaced is
  'true quando o equipamento foi SUBSTITUÍDO no atendimento: os campos base '
  '(manufacturer/model/…) são o equipamento ENCONTRADO (antes) e os *_final o '
  'INSTALADO (depois). Decisão do técnico; não infere compatibilidade.';
comment on column public.service_attendance_evidence_items.device_address_final is
  'Endereço técnico do dispositivo instalado (depois), quando diferente do '
  'device_address (antes). NULL = mesmo endereço.';
