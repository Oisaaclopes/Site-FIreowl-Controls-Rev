-- Logo do cliente (SVG/PNG rasterizado p/ PNG): usada nos relatórios técnicos e,
-- futuramente, onde a marca do cliente fizer sentido. Guardamos o storage_path
-- (bucket report-media, prefixo clientes/). Distinta da fachada (foto do prédio).
-- Requer 0028 (clients). Idempotente.

alter table public.clients
  add column if not exists logo_path text;
