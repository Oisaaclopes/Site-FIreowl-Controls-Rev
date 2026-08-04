-- Documentos do funcionário (diplomas, NRs, currículo) em Storage PRIVADO.
-- Requer 0004/0005 (auth_role). Rode no SQL Editor. Idempotente.
--
-- SEGURANÇA: bucket NÃO público. Os arquivos ficam sob a pasta do próprio
-- usuário (path = "<user_id>/arquivo"). O acesso é liberado apenas para o
-- DONO do documento e para o ADMINISTRATIVO, e a visualização é feita via
-- URL ASSINADA de curta duração (não há URL pública).

insert into storage.buckets (id, name, public)
values ('employee-docs', 'employee-docs', false)
on conflict (id) do update set public = false;

-- Leitura: dono da pasta OU admin
drop policy if exists "emp docs select" on storage.objects;
create policy "emp docs select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'employee-docs'
    and (public.auth_role() = 'ADMINISTRATIVO' or (storage.foldername(name))[1] = auth.uid()::text)
  );

-- Upload: dono da pasta OU admin
drop policy if exists "emp docs insert" on storage.objects;
create policy "emp docs insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'employee-docs'
    and (public.auth_role() = 'ADMINISTRATIVO' or (storage.foldername(name))[1] = auth.uid()::text)
  );

-- Exclusão: dono da pasta OU admin
drop policy if exists "emp docs delete" on storage.objects;
create policy "emp docs delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'employee-docs'
    and (public.auth_role() = 'ADMINISTRATIVO' or (storage.foldername(name))[1] = auth.uid()::text)
  );
