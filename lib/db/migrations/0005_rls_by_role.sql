-- Blindagem de acesso por PAPEL (RBAC no banco), ligada ao Supabase Auth.
--
-- PRÉ-REQUISITOS (rode ANTES desta migração):
--   1) 0004_auth_profiles.sql aplicada (tabela profiles + trigger).
--   2) Pelo menos UM usuário ADMINISTRATIVO criado no Auth, com a linha
--      correspondente em public.profiles (role = 'ADMINISTRATIVO').
--   Caso contrário, ninguém terá acesso ao estoque (inclusive o admin).
--
-- Rode no SQL Editor do Supabase. Idempotente.

-- Função auxiliar: papel do usuário autenticado (lido de profiles).
create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), '');
$$;

grant execute on function public.auth_role() to authenticated;

-- ==================== inventory_items (Estoque) ====================
-- Acesso: ADMINISTRATIVO e GESTOR (que gerenciam peças). Bloqueia anon.

revoke all on public.inventory_items from anon;
grant select, insert, update, delete on public.inventory_items to authenticated;

drop policy if exists "inventory public select" on public.inventory_items;
drop policy if exists "inventory public insert" on public.inventory_items;
drop policy if exists "inventory public update" on public.inventory_items;
drop policy if exists "inventory public delete" on public.inventory_items;

drop policy if exists "inventory role select" on public.inventory_items;
create policy "inventory role select"
  on public.inventory_items for select
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));

drop policy if exists "inventory role insert" on public.inventory_items;
create policy "inventory role insert"
  on public.inventory_items for insert
  to authenticated
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));

drop policy if exists "inventory role update" on public.inventory_items;
create policy "inventory role update"
  on public.inventory_items for update
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));

drop policy if exists "inventory role delete" on public.inventory_items;
create policy "inventory role delete"
  on public.inventory_items for delete
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));

-- ==================== stock_movements (Histórico) ====================
-- Acesso: ADMINISTRATIVO e GESTOR. Append-only (sem update/delete). Bloqueia anon.

revoke all on public.stock_movements from anon;
grant select, insert on public.stock_movements to authenticated;

drop policy if exists "movements public select" on public.stock_movements;
drop policy if exists "movements public insert" on public.stock_movements;

drop policy if exists "movements role select" on public.stock_movements;
create policy "movements role select"
  on public.stock_movements for select
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));

drop policy if exists "movements role insert" on public.stock_movements;
create policy "movements role insert"
  on public.stock_movements for insert
  to authenticated
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));
