-- Marcas/fabricantes como entidade persistida + vínculo com fornecedor
-- (qual fornecedor trabalha com qual marca). A chave de ligação é o NOME da
-- marca, consistente com devices.fabricante e inventory_items.brand (ambos
-- texto) — assim dispositivo, fornecedor e estoque se cruzam pela mesma chave.
-- Editado no cadastro do fornecedor. Requer 0013 (suppliers). Idempotente.

create table if not exists public.brands (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  category   text,
  created_at timestamptz not null default now()
);

-- Marcas que cada fornecedor trabalha (multiselect no cadastro do fornecedor).
alter table public.suppliers add column if not exists brands text[] not null default '{}';

alter table public.brands enable row level security;
grant select, insert, update, delete on public.brands to authenticated;

-- Todos os perfis leem (seletor de fabricante em dispositivos, propostas, etc.).
drop policy if exists "brands select" on public.brands;
create policy "brands select" on public.brands for select to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO', 'TECNICO'));

-- Cadastro de marca acompanha quem cadastra dispositivo/estoque em campo.
drop policy if exists "brands insert" on public.brands;
create policy "brands insert" on public.brands for insert to authenticated
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO', 'TECNICO'));

drop policy if exists "brands update" on public.brands;
create policy "brands update" on public.brands for update to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));

drop policy if exists "brands delete" on public.brands;
create policy "brands delete" on public.brands for delete to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));
