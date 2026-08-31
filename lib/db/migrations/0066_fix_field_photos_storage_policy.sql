-- Correção da 0065: fecha a expressão USING da policy UPDATE antes do WITH CHECK.
-- Segura para rodar tanto após falha parcial quanto após rollback integral da 0065.

insert into storage.buckets (id, name, public)
values ('field-photos', 'field-photos', false)
on conflict (id) do update set public = false;

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

drop policy if exists "field photos update" on storage.objects;
create policy "field photos update" on storage.objects for update to authenticated
using (
  bucket_id = 'field-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.auth_role() in ('ADMINISTRATIVO', 'GESTOR')
  )
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
