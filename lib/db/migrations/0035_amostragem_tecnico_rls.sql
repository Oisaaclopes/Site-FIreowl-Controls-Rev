-- Amostragem rotativa (Fase 3c): o TÉCNICO executa a preventiva em campo, então
-- precisa criar/atualizar o ciclo de amostragem e registrar o teste funcional
-- dos dispositivos. As policies originais (0029) davam escrita só a ADMIN/GESTOR.
-- Requer 0029. Idempotente.

-- ----- ciclos_amostragem: TÉCNICO passa a poder escrever -----
drop policy if exists "ciclos write" on public.ciclos_amostragem;
create policy "ciclos write" on public.ciclos_amostragem for all to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'TECNICO'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'TECNICO'));

-- ----- devices: TÉCNICO passa a poder atualizar (ex.: ultimo_teste_funcional) -----
drop policy if exists "devices update" on public.devices;
create policy "devices update" on public.devices for update to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'TECNICO'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'TECNICO'));
