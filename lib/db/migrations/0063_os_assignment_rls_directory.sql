-- RLS de atribuição de OS por técnico responsável + diretório operacional mínimo.
-- Requer 0033 (ordens_servico), 0005 (auth_role), 0061 (status/auth_role ativo),
-- 0062 (tecnico_responsavel_id). NÃO altera 0062. Idempotente.
-- REVISAR e rodar no SQL Editor do Supabase (o agente não aplica migrations).

-- =====================================================================
-- 1) DIRETÓRIO OPERACIONAL MÍNIMO (RPC) — evita abrir profiles via SELECT.
-- =====================================================================
-- Por que RPC e não policy de SELECT em profiles: RLS controla LINHAS, não
-- colunas. Uma policy "authenticated lê profiles ATIVOS" exporia CPF, nascimento,
-- telefone, escala, cursos etc. A função abaixo (SECURITY DEFINER) devolve APENAS
-- os campos mínimos necessários para o seletor/diretório, sem dados pessoais.
create or replace function public.get_assignable_technicians()
returns table (id uuid, name text, full_name text, cargo text, role text, status text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Só quem opera OS consulta o diretório (INATIVO/DESLIGADO → auth_role()='' →
  -- não passa; FINANCEIRO não atribui OS → fora). Não confia em nada do cliente.
  if public.auth_role() not in ('ADMINISTRATIVO', 'GESTOR', 'TECNICO') then
    return;
  end if;
  return query
    select p.id, p.name, p.full_name, p.cargo, p.role, p.status
    from public.profiles p
    where p.status = 'ATIVO'
      and p.role in ('TECNICO', 'GESTOR', 'ADMINISTRATIVO')
    order by coalesce(p.name, p.full_name, '');
end;
$$;

revoke all on function public.get_assignable_technicians() from public, anon;
grant execute on function public.get_assignable_technicians() to authenticated;


-- =====================================================================
-- 2) RESOLUÇÃO DE 1 RESPONSÁVEL (para exibir nome em OS histórica, inclusive
--    se o técnico ficou INATIVO). Retorna só id/name/cargo/role — sem PII — e
--    NÃO torna inativos "selecionáveis" (isto é só leitura pontual por id).
-- =====================================================================
create or replace function public.resolve_profile_min(pid uuid)
returns table (id uuid, name text, cargo text, role text, status text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.auth_role() = '' then
    return; -- caller precisa estar ATIVO
  end if;
  return query
    select p.id, p.name, p.cargo, p.role, p.status
    from public.profiles p
    where p.id = pid;
end;
$$;

revoke all on function public.resolve_profile_min(uuid) from public, anon;
grant execute on function public.resolve_profile_min(uuid) to authenticated;


-- =====================================================================
-- 3) RLS de ordens_servico — SUBSTITUI as policies de 0033.
--    ADMINISTRATIVO/GESTOR: tudo (inclui atribuir/reatribuir responsável).
--    FINANCEIRO: mantém somente a LEITURA (sem escrita), como em 0033.
--    TECNICO: vê/edita SOMENTE as OS onde é o responsável; with check impede
--             reatribuir/remover/assumir OS de terceiro. Não vê OS não atribuída.
--    INATIVO/DESLIGADO: auth_role()='' → nega tudo.
-- =====================================================================

drop policy if exists "os select" on public.ordens_servico;
create policy "os select" on public.ordens_servico for select to authenticated
  using (
    public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO')
    or (public.auth_role() = 'TECNICO' and tecnico_responsavel_id = auth.uid())
  );

drop policy if exists "os insert" on public.ordens_servico;
create policy "os insert" on public.ordens_servico for insert to authenticated
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));

drop policy if exists "os update" on public.ordens_servico;
create policy "os update" on public.ordens_servico for update to authenticated
  using (
    public.auth_role() in ('ADMINISTRATIVO', 'GESTOR')
    or (public.auth_role() = 'TECNICO' and tecnico_responsavel_id = auth.uid())
  )
  with check (
    public.auth_role() in ('ADMINISTRATIVO', 'GESTOR')
    -- TECNICO só grava mantendo-se como responsável: não reatribui a outro,
    -- não remove (NULL falha o check) e não assume OS de terceiro (o USING
    -- já barra a linha de origem que não é dele).
    or (public.auth_role() = 'TECNICO' and tecnico_responsavel_id = auth.uid())
  );

drop policy if exists "os delete" on public.ordens_servico;
create policy "os delete" on public.ordens_servico for delete to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));
