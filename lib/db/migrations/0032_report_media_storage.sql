-- Storage PRIVADO para fotos dos relatórios técnicos (Parte 4.2).
-- Caminho: reports/{cliente_id}/{ano}/{report_id}/{tipo}_{seq}.jpg
-- Acesso via URL assinada de curta duração (bucket não público).
-- Requer 0004/0005 (auth_role). Rode no SQL Editor. Idempotente.

insert into storage.buckets (id, name, public)
values ('report-media', 'report-media', false)
on conflict (id) do update set public = false;

-- Upload/leitura/exclusão liberados a quem tem acesso ao módulo. O controle
-- fino por relatório é feito na tabela report_media (RLS via owns_report);
-- os binários ficam num bucket privado, servidos só por URL assinada.
drop policy if exists "report media select" on storage.objects;
create policy "report media select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'report-media'
    and public.auth_role() in ('ADMINISTRATIVO','GESTOR','FINANCEIRO','TECNICO')
  );

drop policy if exists "report media insert" on storage.objects;
create policy "report media insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'report-media'
    and public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO')
  );

drop policy if exists "report media delete" on storage.objects;
create policy "report media delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'report-media'
    and public.auth_role() in ('ADMINISTRATIVO','GESTOR')
  );
