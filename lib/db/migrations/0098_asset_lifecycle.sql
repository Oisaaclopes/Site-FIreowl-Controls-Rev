-- ETAPA 3D.4 — Ciclo de vida do ativo: Atendimento ↔ Base Técnica.
--
-- Hoje o service_attendance_evidence_item liga ao ativo só por TEXTO
-- (device_address/manufacturer/model). Esta migration adiciona o VÍNCULO
-- CANÔNICO ao `devices` (§4/§8) e o registro da decisão de ciclo de vida
-- (MESMO/SUBSTITUIDO/REMOVIDO/NAO_ALTERAR) — a Base só muda por ação explícita
-- e confirmada (§2/§10), de forma idempotente (§23). As device_verifications
-- ganham o contexto do Atendimento/OS para o histórico (§26/§29).
--
-- Aditiva, idempotente, não-destrutiva. Requer 0088 (evidence_items),
-- 0094 (devices), 0095 (device_verifications), 0033 (ordens_servico),
-- 0083 (service_attendances). NÃO edita migrações aplicadas. Próximo número real.

-- 1) Item de evidência → ativo canônico + resultado do ciclo de vida ------------
alter table public.service_attendance_evidence_items
  add column if not exists device_id              uuid references public.devices(id) on delete set null,
  add column if not exists replacement_device_id  uuid references public.devices(id) on delete set null,
  add column if not exists base_update_decision   text
        check (base_update_decision is null or base_update_decision in
          ('MESMO','SUBSTITUIDO','REMOVIDO','NAO_ALTERAR')),
  add column if not exists base_update_applied_at  timestamptz;  -- idempotência (§23): aplicado uma vez

create index if not exists saei_device_idx      on public.service_attendance_evidence_items (device_id) where device_id is not null;
create index if not exists saei_replacement_idx on public.service_attendance_evidence_items (replacement_device_id) where replacement_device_id is not null;

-- 2) Verificação com contexto de Atendimento/OS (histórico, §26/§29) ------------
alter table public.device_verifications
  add column if not exists service_attendance_id uuid references public.service_attendances(id) on delete set null,
  add column if not exists work_order_id         uuid references public.ordens_servico(id) on delete set null,
  add column if not exists evidence_item_id      uuid references public.service_attendance_evidence_items(id) on delete set null,
  add column if not exists source                text
        check (source is null or source in ('LEVANTAMENTO','ATENDIMENTO','MANUAL','IMPORTACAO'));

create index if not exists dv_attendance_idx on public.device_verifications (service_attendance_id) where service_attendance_id is not null;
create index if not exists dv_os_idx         on public.device_verifications (work_order_id) where work_order_id is not null;

-- 3) Navegação reversa da substituição (novo → anterior) -----------------------
-- devices.replaced_by_device_id existe desde a 0094; indexamos p/ achar o novo a
-- partir do antigo e o antigo a partir do novo sem varredura.
create index if not exists devices_replaced_by_idx on public.devices (replaced_by_device_id) where replaced_by_device_id is not null;

-- Sem novas policies: RLS de service_attendance_evidence_items (0088) e
-- device_verifications (0095) já cobre ADMIN/GESTOR/TECNICO; as novas colunas
-- herdam essas policies. Realtime das tabelas já está na publicação (0095).
