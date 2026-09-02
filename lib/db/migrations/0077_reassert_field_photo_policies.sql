-- FASE 3.1 — Correção de acesso do TÉCNICO às Fotos de Campo.
--
-- Sintoma em produção: ADMINISTRATIVO/GESTOR conseguem registrar foto de campo,
-- mas o TÉCNICO recebe erro e a foto não persiste (fica "Erro" na outbox local).
--
-- Diagnóstico: o único ponto em que técnico e admin divergem em TODAS as policies
-- de field_photos é o desvio `auth_role() in ('ADMINISTRATIVO','GESTOR')`. O admin
-- passa por esse desvio; o técnico depende exclusivamente do ramo de posse
-- (tecnico_id = auth.uid() / (storage.foldername(name))[1] = auth.uid()). O código
-- do app monta o path e o tecnico_id com o próprio auth.uid() (o login já exige
-- profiles.id = auth.users.id), então, com as policies como escritas em
-- 0064/0065/0066, o técnico DEVERIA passar. "Admin OK + técnico falha + código
-- correto" só é consistente com DRIFT do ramo de posse dessas policies em produção
-- (aplicação parcial da 0065, que teve erro de sintaxe corrigido só na 0066, ou
-- edição manual que preservou apenas o desvio de admin).
--
-- Correção: reafirma, de forma IDEMPOTENTE e SEM AFROUXAR segurança, exatamente as
-- policies pretendidas em 0064 (RLS de tabela + função de posse) e 0066 (bucket
-- privado + storage). Não é bucket público, não usa USING(true), não é service
-- role, não é acesso irrestrito a authenticated: o técnico continua restrito ao
-- próprio escopo. Seguro para rodar mesmo se as policies já estiverem corretas
-- (vira no-op). NÃO edita/reaplica a 0076. Rode no SQL Editor do Supabase.

-- 1) Bucket privado (reafirma; nunca torna público).
insert into storage.buckets (id, name, public)
values ('field-photos', 'field-photos', false)
on conflict (id) do update set public = false;

-- 2) RLS habilitada nas tabelas (reafirma).
alter table public.field_photo_sessions enable row level security;
alter table public.field_photos enable row level security;
grant select, insert, update, delete on public.field_photo_sessions, public.field_photos to authenticated;

-- 3) Função de posse da sessão (SECURITY DEFINER, search_path fixo). Recriada
--    idêntica à 0064 para eliminar qualquer versão defasada em produção.
create or replace function public.owns_field_photo_session(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.field_photo_sessions s where s.id = sid
    and (s.tecnico_id = auth.uid() or public.auth_role() in ('ADMINISTRATIVO','GESTOR')));
$$;
grant execute on function public.owns_field_photo_session(uuid) to authenticated;

-- 4) RLS das tabelas (reafirma o ramo de posse do técnico + desvio administrativo).
drop policy if exists "field photo sessions read" on public.field_photo_sessions;
create policy "field photo sessions read" on public.field_photo_sessions for select to authenticated
  using (tecnico_id = auth.uid() or public.auth_role() in ('ADMINISTRATIVO','GESTOR'));

drop policy if exists "field photo sessions write" on public.field_photo_sessions;
create policy "field photo sessions write" on public.field_photo_sessions for all to authenticated
  using (tecnico_id = auth.uid() or public.auth_role() in ('ADMINISTRATIVO','GESTOR'))
  with check (tecnico_id = auth.uid() or public.auth_role() in ('ADMINISTRATIVO','GESTOR'));

drop policy if exists "field photos read" on public.field_photos;
create policy "field photos read" on public.field_photos for select to authenticated
  using (public.owns_field_photo_session(session_id));

drop policy if exists "field photos write" on public.field_photos;
create policy "field photos write" on public.field_photos for all to authenticated
  using (public.owns_field_photo_session(session_id)) with check (public.owns_field_photo_session(session_id));

-- 5) Storage do bucket field-photos (reafirma 0066). Path obrigatório:
--    {auth.uid()}/{session_client_uuid}/{photo_client_uuid}/{asset}.jpg
--    O primeiro segmento isola o técnico sem join frágil em storage.objects.
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

-- upload de retry usa upsert no mesmo path determinístico → exige UPDATE próprio.
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

-- DELETE segue restrito a papel administrativo/gestor (técnico não apaga).
drop policy if exists "field photos delete" on storage.objects;
create policy "field photos delete" on storage.objects for delete to authenticated
using (bucket_id = 'field-photos' and public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));
