-- §20 — Capa dinâmica por área: imagem de capa padrão por área de atuação
-- (SDAI, CFTV, etc.). Guardamos o storage_path (bucket report-media, prefixo
-- propostas/) por id de área. Quando a proposta não tem capa própria, o PDF usa
-- a capa da área. Requer 0037 (company_profile). Idempotente.

alter table public.company_profile
  add column if not exists capa_areas jsonb not null default '{}'::jsonb;
