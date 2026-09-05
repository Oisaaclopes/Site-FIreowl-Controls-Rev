-- ETAPA 3D.EXTRA — Backups técnicos de equipamentos (armazenamento + histórico).
--
-- Guarda o ARQUIVO ORIGINAL de configuração/programação/base de centrais, NVRs,
-- controladores, etc., para download futuro. O sistema NÃO interpreta, executa,
-- converte nem importa automaticamente (só armazena + histórico + download).
-- Bucket PRIVADO; download por signed URL. Versionamento: cada upload é uma nova
-- linha; is_current marca a versão atual sem apagar as anteriores.
--
-- Aditiva, idempotente. Requer 0018 (clients), 0094 (devices), 0005 (auth_role).

-- 1) Bucket privado dedicado ----------------------------------------------------
insert into storage.buckets (id, name, public)
values ('technical-backups', 'technical-backups', false)
on conflict (id) do nothing;

-- 2) Tabela de backups ----------------------------------------------------------
create table if not exists public.technical_backups (
  id                 uuid primary key default gen_random_uuid(),
  cliente_id         text not null references public.clients(id) on delete cascade,
  area               text,
  device_id          uuid references public.devices(id) on delete set null,   -- central/NVR/controlador
  manufacturer       text,
  model              text,
  backup_type        text,          -- BACKUP_COMPLETO/PROGRAMACAO/BASE_DISPOSITIVOS/CONFIGURACAO/EXPORTACAO/OUTRO (texto livre-controlado)
  original_filename  text not null,
  file_extension     text,
  mime_type          text,
  file_size          bigint,
  storage_path       text not null,  -- caminho no bucket privado (nunca URL pública)
  file_hash          text,           -- sha-256 opcional (integridade)
  notes              text,
  backup_date        date,           -- data do backup (informada); create = data do upload
  is_current         boolean not null default true,
  uploaded_by        uuid default auth.uid(),
  created_at         timestamptz not null default now()
);
create index if not exists tbk_cliente_idx on public.technical_backups (cliente_id, area);
create index if not exists tbk_device_idx   on public.technical_backups (device_id) where device_id is not null;

-- 3) RLS — técnico envia/baixa; gestão administra. ------------------------------
alter table public.technical_backups enable row level security;
grant select, insert, update, delete on public.technical_backups to authenticated;

drop policy if exists "backups select" on public.technical_backups;
create policy "backups select" on public.technical_backups for select to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'));
drop policy if exists "backups insert" on public.technical_backups;
create policy "backups insert" on public.technical_backups for insert to authenticated
  with check (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'));
-- Alterar (ex.: marcar is_current) e excluir: gestão.
drop policy if exists "backups update" on public.technical_backups;
create policy "backups update" on public.technical_backups for update to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR'))
  with check (public.auth_role() in ('ADMINISTRATIVO','GESTOR'));
drop policy if exists "backups delete" on public.technical_backups;
create policy "backups delete" on public.technical_backups for delete to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR'));

-- 4) Storage policies do bucket privado (mesmo escopo por papel) ----------------
drop policy if exists "technical-backups read" on storage.objects;
create policy "technical-backups read" on storage.objects for select to authenticated
  using (bucket_id = 'technical-backups' and public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'));
drop policy if exists "technical-backups insert" on storage.objects;
create policy "technical-backups insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'technical-backups' and public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'));
drop policy if exists "technical-backups delete" on storage.objects;
create policy "technical-backups delete" on storage.objects for delete to authenticated
  using (bucket_id = 'technical-backups' and public.auth_role() in ('ADMINISTRATIVO','GESTOR'));
