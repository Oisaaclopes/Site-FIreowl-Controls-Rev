-- ETAPA 3D — BASE TÉCNICA do cliente (ativo instalado), evoluindo `devices`.
--
-- Auditoria (§4/§5/§6D): já existe `public.devices` (0029 v2) = parque instalado
-- por cliente (SDAI/CFTV/CONTROLE_ACESSO/BMS + central/laço/endereço/fabricante/
-- modelo/local/status). É a entidade canônica do ativo instalado — NÃO criamos
-- base paralela. Aqui a ESTENDEMOS para ser multidisciplinar e permanente:
--   - ALARME na lista de sistemas;
--   - grupo/tipo de ativo (taxonomia), identificador técnico genérico +
--     atributos estruturados (technical_attributes) para os campos que variam
--     por área (IP, canal, device instance, zona…), SEM uma coluna por atributo;
--   - condição operacional (distinta do status de ciclo de vida);
--   - relação pai/filho (parent_device_id) e substituição (replaced_by_device_id);
--   - proveniência (LEVANTAMENTO/IMPORTACAO/MANUAL/ATENDIMENTO) + last_verified_at.
--
-- Aditiva, idempotente, não-destrutiva. Preserva RLS (0023/0035: técnico lê/
-- insere/atualiza; gestão administra). Requer 0029 (devices). NÃO edita 0093.

-- 1) ALARME como sistema válido (recria o CHECK) --------------------------------
alter table public.devices drop constraint if exists devices_sistema_check;
alter table public.devices
  add constraint devices_sistema_check
  check (sistema in ('SDAI','CFTV','CONTROLE_ACESSO','BMS','ALARME'));

-- 2) Colunas multidisciplinares -------------------------------------------------
alter table public.devices
  add column if not exists grupo                  text,   -- grupo/família (taxonomia por área)
  add column if not exists tipo_ativo             text,   -- tipo canônico (Fireowl); tipo_dispositivo = rótulo livre
  add column if not exists parent_device_id       uuid references public.devices(id) on delete set null,
  add column if not exists technical_identifier   text,   -- identificador de apresentação (ex.: "192.168.10.31")
  add column if not exists technical_attributes   jsonb not null default '{}'::jsonb, -- atributos estruturados por área
  add column if not exists condicao               text
                          check (condicao is null or condicao in
                            ('NORMAL','COM_AVARIA','INOPERANTE','NAO_TESTADO','NAO_LOCALIZADO','INADEQUADO')),
  add column if not exists serial                 text,
  add column if not exists source                 text
                          check (source is null or source in ('LEVANTAMENTO','IMPORTACAO','MANUAL','ATENDIMENTO')),
  add column if not exists source_survey_id       uuid,
  add column if not exists replaced_by_device_id  uuid references public.devices(id) on delete set null,
  add column if not exists removed_at             timestamptz,
  add column if not exists last_verified_at       timestamptz,
  add column if not exists created_by             uuid default auth.uid();

create index if not exists devices_sistema_idx      on public.devices (cliente_id, sistema);
create index if not exists devices_parent_idx       on public.devices (parent_device_id) where parent_device_id is not null;
create index if not exists devices_survey_idx       on public.devices (source_survey_id) where source_survey_id is not null;
-- Busca por identificador técnico (IP/endereço/etc.) e atributos estruturados.
create index if not exists devices_tech_ident_idx   on public.devices (cliente_id, technical_identifier);
create index if not exists devices_tech_attrs_gin   on public.devices using gin (technical_attributes);

comment on column public.devices.technical_attributes is
  'Atributos estruturados por área/tecnologia (3D): ip, canal, nvr, device_instance, '
  'protocolo, zona, particao, porta, controladora, descricao_programada, etc. '
  'Contrato definido em lib/technicalBase.ts. NUNCA guardar senha aqui (§64).';
comment on column public.devices.condicao is
  'Condição operacional atual (§16), distinta de status (ciclo de vida). A '
  'condição por verificação vive em device_verifications (histórico, 0095).';
