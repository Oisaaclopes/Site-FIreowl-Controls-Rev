-- Inventário de dispositivos do cliente (parque instalado SDAI/CFTV/etc.).
-- Base para a Preventiva gerar 1 linha por dispositivo e para vincular
-- apontamentos/pendências a um dispositivo específico. Requer 0018_clients.
-- Idempotente.

create table if not exists public.devices (
  id               uuid primary key default gen_random_uuid(),
  cliente_id       text not null references public.clients(id) on delete cascade,
  grupo            text,          -- taxonomia Categoria > Subcategoria
  tipo             text,          -- Detector óptico, Acionador manual, Sirene...
  fabricante       text,
  modelo           text,
  endereco_central text,          -- laço/zona/ponto na central
  local            text,          -- localização física
  serial           text,
  item_catalogo_id text,          -- vínculo opcional a Estoque/Serviços
  status           text not null default 'OPERACIONAL'
                   check (status in ('OPERACIONAL', 'ALERTA', 'DEFEITO', 'INATIVO')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists devices_cliente_idx on public.devices (cliente_id);

alter table public.devices enable row level security;
grant select, insert, update, delete on public.devices to authenticated;

-- Leitura: ADMIN, GESTOR e TÉCNICO (o técnico precisa do parque em campo).
drop policy if exists "devices select" on public.devices;
create policy "devices select"
  on public.devices for select
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'TECNICO'));

-- Inserir: ADMIN/GESTOR e também TÉCNICO (adiciona manualmente na preventiva
-- quando o inventário ainda não existe).
drop policy if exists "devices insert" on public.devices;
create policy "devices insert"
  on public.devices for insert
  to authenticated
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'TECNICO'));

-- Alterar/excluir: gestão fica com ADMIN/GESTOR.
drop policy if exists "devices update" on public.devices;
create policy "devices update"
  on public.devices for update
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));

drop policy if exists "devices delete" on public.devices;
create policy "devices delete"
  on public.devices for delete
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));
