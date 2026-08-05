-- Permite que ADMINISTRATIVO/GESTOR criem e editem batidas de qualquer
-- funcionário — necessário para materializar ajustes de ponto aprovados.
-- Requer 0007 (time_punches) e 0005 (auth_role). Idempotente.

grant update on public.time_punches to authenticated;

-- Inserir: o próprio funcionário (para si) OU admin/gestor (para qualquer um)
drop policy if exists "punches insert own" on public.time_punches;
drop policy if exists "punches insert" on public.time_punches;
create policy "punches insert"
  on public.time_punches for insert
  to authenticated
  with check (user_id = auth.uid() or public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));

-- Editar: apenas admin/gestor (correção/auditoria de ponto)
drop policy if exists "punches update" on public.time_punches;
create policy "punches update"
  on public.time_punches for update
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));
