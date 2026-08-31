-- FASE 3.1 Passada 2C — bucket independente de evidências de campo.
-- A 0064 é imutável. Os UNIQUE client_uuid já existem nela; não removemos nem
-- deduplicamos dados existentes nesta migration.

insert into storage.buckets (id, name, public)
values ('field-photos', 'field-photos', false)
on conflict (id) do update set public = false;

-- Formato obrigatório: {auth.uid()}/{session_client_uuid}/{photo_client_uuid}/{asset}.jpg
-- O primeiro segmento é suficiente para isolar técnico sem depender de joins
-- frágeis em storage.objects. A metadata continua protegida pelo RLS das tabelas.
drop policy if exists "field photos select" on storage.objects;
create policy "field photos select" on storage.objects for select to authenticated
using (
  bucket_id = 'field-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.auth_role() in ('ADMINISTRATIVO', 'GESTOR')
  )
);

drop policy if exists "field photos insert" on storage.objects;
create policy "field photos insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'field-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.auth_role() in ('ADMINISTRATIVO', 'GESTOR')
  )
);

-- upload retry usa upsert no mesmo path determinístico; portanto UPDATE é
-- limitado à própria raiz do técnico. Não há DELETE para técnico.
drop policy if exists "field photos update" on storage.objects;
create policy "field photos update" on storage.objects for update to authenticated
using (
  bucket_id = 'field-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.auth_role() in ('ADMINISTRATIVO', 'GESTOR')
  )
with check (
  bucket_id = 'field-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.auth_role() in ('ADMINISTRATIVO', 'GESTOR')
  )
);

drop policy if exists "field photos delete" on storage.objects;
create policy "field photos delete" on storage.objects for delete to authenticated
using (bucket_id = 'field-photos' and public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));
