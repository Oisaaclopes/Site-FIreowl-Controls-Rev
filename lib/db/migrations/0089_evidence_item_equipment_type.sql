-- CORREÇÃO pós-3B.4 — tipo técnico (taxonomia) do Item de Evidência.
--
-- A categoria "coarse" do item (0088: EQUIPAMENTO/INFRAESTRUTURA/CABEAMENTO/
-- CENTRAL/OUTRO) é grossa demais para SDAI. O tipo FINO (Acionador Manual,
-- Detector de Fumaça, Sirene, Módulo…) vem da taxonomia REAL do catálogo
-- (technical_catalog.subcategory) e é escolhido pelo técnico ao criar o item.
-- Persistimos esse tipo para reuso futuro (pendência/orçamento/Base Técnica e a
-- 3D multidisciplinar), sem criar segunda taxonomia fixa.
--
-- Aditiva, idempotente, não-destrutiva. Independe da 0086. NÃO edita 0083/0084/
-- 0085/0087/0088. Requer 0088.

alter table public.service_attendance_evidence_items
  add column if not exists equipment_type text;

comment on column public.service_attendance_evidence_items.equipment_type is
  'Tipo/família técnica (taxonomia = technical_catalog.subcategory), ex.: '
  '"Acionador Manual", "Detector de Fumaça". Texto livre alinhado à taxonomia '
  'existente; complementa a categoria coarse. NULL quando não classificado.';
