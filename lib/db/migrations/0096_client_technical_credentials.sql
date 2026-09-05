-- ETAPA 3D — Credenciais técnicas protegidas da Base Técnica (§63–§68/§100/§110).
--
-- O SEGREDO fica em tabela SEPARADA, para nunca aparecer em SELECT genérico
-- (§65): a metadata (label/usuário/vínculo) é legível por ADMIN/GESTOR/TÉCNICO,
-- mas o segredo só é revelado a ADMIN/GESTOR por RPC explícita. Sem criptografia
-- caseira; a proteção é RLS + isolamento + canal de leitura dedicado. O segredo
-- NUNCA vai para PDF, report_answers, technical_attributes, field_photos ou logs.
--
-- Aditiva, idempotente. Requer 0018 (clients), 0094 (devices), 0005 (auth_role).

-- 1) Metadata da credencial (sem segredo) ---------------------------------------
create table if not exists public.client_technical_credentials (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   text not null references public.clients(id) on delete cascade,
  device_id    uuid references public.devices(id) on delete set null,
  area         text,
  label        text not null,          -- ex.: "Central SDAI 01", "NVR 01"
  username     text,                    -- usuário/login (não é o segredo)
  notes        text,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists cred_cliente_idx on public.client_technical_credentials (cliente_id);

drop trigger if exists cred_set_updated_at on public.client_technical_credentials;
create trigger cred_set_updated_at before update on public.client_technical_credentials
  for each row execute function public.set_updated_at();

-- 2) Segredo isolado ------------------------------------------------------------
create table if not exists public.client_technical_credential_secrets (
  credential_id uuid primary key references public.client_technical_credentials(id) on delete cascade,
  secret        text not null,
  updated_by    uuid default auth.uid(),
  updated_at    timestamptz not null default now()
);

-- 3) RLS ------------------------------------------------------------------------
alter table public.client_technical_credentials         enable row level security;
alter table public.client_technical_credential_secrets  enable row level security;
grant select, insert, update, delete on public.client_technical_credentials to authenticated;
-- Técnico pode gravar segredo (registro em campo), mas NÃO lê segredo de outros.
grant select, insert, update, delete on public.client_technical_credential_secrets to authenticated;

-- Metadata: ADMIN/GESTOR/TÉCNICO leem e escrevem.
drop policy if exists "cred meta select" on public.client_technical_credentials;
create policy "cred meta select" on public.client_technical_credentials for select to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'));
drop policy if exists "cred meta write" on public.client_technical_credentials;
create policy "cred meta write" on public.client_technical_credentials for all to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'))
  with check (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'));

-- Segredo: SELECT só ADMIN/GESTOR (não entra em consulta genérica). Escrita
-- permitida a ADMIN/GESTOR/TÉCNICO (write-only para o técnico); delete gestão.
drop policy if exists "cred secret select" on public.client_technical_credential_secrets;
create policy "cred secret select" on public.client_technical_credential_secrets for select to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR'));
drop policy if exists "cred secret insert" on public.client_technical_credential_secrets;
create policy "cred secret insert" on public.client_technical_credential_secrets for insert to authenticated
  with check (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'));
drop policy if exists "cred secret update" on public.client_technical_credential_secrets;
create policy "cred secret update" on public.client_technical_credential_secrets for update to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'))
  with check (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'));
drop policy if exists "cred secret delete" on public.client_technical_credential_secrets;
create policy "cred secret delete" on public.client_technical_credential_secrets for delete to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR'));

-- 4) Revelação explícita e auditável do segredo (só gestão) ---------------------
create or replace function public.reveal_technical_credential(p_credential_id uuid)
returns text language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_secret text;
begin
  if auth.uid() is null then raise exception 'nao autenticado'; end if;
  if public.auth_role() not in ('ADMINISTRATIVO','GESTOR') then
    raise exception 'sem permissao para revelar credencial';
  end if;
  select secret into v_secret from public.client_technical_credential_secrets where credential_id = p_credential_id;
  return v_secret;
end;
$$;
revoke all on function public.reveal_technical_credential(uuid) from public, anon;
grant execute on function public.reveal_technical_credential(uuid) to authenticated;
