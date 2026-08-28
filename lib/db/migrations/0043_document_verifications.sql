-- Registro público mínimo para QR de autenticidade. Não contém conteúdo,
-- valores, e-mails, assinaturas ou qualquer dado sensível do documento.
create table if not exists public.document_verifications (
  code text primary key,
  document_type text not null,
  source_id text not null,
  document_number text not null,
  client_name text not null,
  issued_at text,
  status text,
  version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.document_verifications enable row level security;
grant select on public.document_verifications to anon, authenticated;
grant insert, update on public.document_verifications to authenticated;

drop policy if exists "document verifications public select" on public.document_verifications;
create policy "document verifications public select" on public.document_verifications
  for select to anon, authenticated using (true);

drop policy if exists "document verifications authenticated write" on public.document_verifications;
create policy "document verifications authenticated write" on public.document_verifications
  for all to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'TECNICO'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'TECNICO'));
