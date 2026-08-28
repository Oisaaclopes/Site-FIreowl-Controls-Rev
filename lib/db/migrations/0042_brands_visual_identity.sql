-- Identidade comercial das marcas homologadas. Idempotente para instalações
-- existentes: logo_url pode ser URL externa ou storage_path privado.
alter table public.brands add column if not exists logo_url text;
alter table public.brands add column if not exists segment text;
