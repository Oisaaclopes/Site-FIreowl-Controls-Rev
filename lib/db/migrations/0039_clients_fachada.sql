-- Foto da fachada do cliente: usada como capa padrão das propostas/orçamentos
-- daquele cliente (evita subir a foto por documento). Guardamos o storage_path
-- (bucket report-media, prefixo clientes/). Requer 0028 (clients). Idempotente.

alter table public.clients
  add column if not exists fachada_path text;
