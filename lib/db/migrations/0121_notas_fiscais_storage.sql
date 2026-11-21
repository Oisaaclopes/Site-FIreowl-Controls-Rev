-- 0121_notas_fiscais_storage
-- Anexos da nota fiscal do pedido (XML e PDF/DANFE) — bucket PRIVADO dedicado.
--
-- Por que um bucket próprio (e não o 'report-media'): documento fiscal só pode
-- ser lido/gravado por ADMINISTRATIVO/FINANCEIRO/GESTOR. O 'report-media'
-- libera SELECT ao TÉCNICO e não libera INSERT ao FINANCEIRO.
--
-- Metadados (caminho, nome, tamanho, chave de acesso) ficam no JSONB do pedido
-- (pedidos.proposal.notaFiscal.anexos) — nenhuma tabela nova.
-- Caminho: <pedido_id>/<timestamp>_<arquivo>. Nunca URL pública (signed URL).
--
-- Aditiva, idempotente. Requer 0005 (auth_role). 0119/0120 reservadas (catálogo).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'notas-fiscais', 'notas-fiscais', false, 10485760,
  array['application/pdf', 'application/xml', 'text/xml']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "notas-fiscais read" on storage.objects;
create policy "notas-fiscais read" on storage.objects for select to authenticated
  using (bucket_id = 'notas-fiscais' and public.auth_role() in ('ADMINISTRATIVO','FINANCEIRO','GESTOR'));

drop policy if exists "notas-fiscais insert" on storage.objects;
create policy "notas-fiscais insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'notas-fiscais' and public.auth_role() in ('ADMINISTRATIVO','FINANCEIRO','GESTOR'));

drop policy if exists "notas-fiscais delete" on storage.objects;
create policy "notas-fiscais delete" on storage.objects for delete to authenticated
  using (bucket_id = 'notas-fiscais' and public.auth_role() in ('ADMINISTRATIVO','FINANCEIRO','GESTOR'));
