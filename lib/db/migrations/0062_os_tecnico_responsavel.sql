-- Técnico responsável na Ordem de Serviço. ADITIVA e sem perda de dados.
-- Requer 0033 (ordens_servico) e 0005 (auth_role). Idempotente.
-- REVISAR e rodar no SQL Editor do Supabase (o agente não aplica migrations).
--
-- Modelo escolhido: UM responsável principal por OS (tecnico_responsavel_id → profiles.id).
-- Não usamos N:N (ordem_servico_tecnicos) porque não há evidência de múltiplos
-- técnicos por OS no fluxo atual — evita superdimensionar. O nome NÃO é gravado
-- (a FK é a fonte da verdade; a UI resolve o nome pelo profile).
--
-- OS históricas ficam com tecnico_responsavel_id NULL = "Não atribuído" (sem
-- backfill inventado). GESTOR/ADMINISTRATIVO podem atribuir depois.

-- 1) Coluna + índice (parte SEGURA para aplicar já).
alter table public.ordens_servico
  add column if not exists tecnico_responsavel_id uuid references public.profiles(id) on delete set null;

create index if not exists ordens_servico_tecnico_idx
  on public.ordens_servico (tecnico_responsavel_id);


-- =====================================================================
-- 2) ENDURECIMENTO DE RLS (PROPOSTA — revisar e validar antes de aplicar)
-- =====================================================================
-- Objetivo (Parte I): TECNICO passa a ver/editar SÓ as OS atribuídas a ele,
-- sem poder reatribuir para outro; ADMINISTRATIVO/GESTOR veem e atribuem tudo;
-- FINANCEIRO mantém a leitura atual. As policies abaixo SUBSTITUEM as de 0033.
--
-- ATENÇÃO: alto impacto — se aplicada errada, técnicos perdem acesso à OS.
-- Validar os testes L1–L6 num ambiente controlado antes de promover.
-- Descomente para aplicar:

-- drop policy if exists "os select" on public.ordens_servico;
-- create policy "os select" on public.ordens_servico for select to authenticated
--   using (
--     public.auth_role() in ('ADMINISTRATIVO','GESTOR','FINANCEIRO')
--     or (public.auth_role() = 'TECNICO' and tecnico_responsavel_id = auth.uid())
--   );

-- drop policy if exists "os update" on public.ordens_servico;
-- create policy "os update" on public.ordens_servico for update to authenticated
--   using (
--     public.auth_role() in ('ADMINISTRATIVO','GESTOR')
--     or (public.auth_role() = 'TECNICO' and tecnico_responsavel_id = auth.uid())
--   )
--   with check (
--     public.auth_role() in ('ADMINISTRATIVO','GESTOR')
--     -- TECNICO só grava mantendo-se como responsável (não reatribui a outro
--     -- nem se remove): with check exige tecnico_responsavel_id = auth.uid().
--     or (public.auth_role() = 'TECNICO' and tecnico_responsavel_id = auth.uid())
--   );

-- insert/delete continuam ADMINISTRATIVO/GESTOR (0033) — sem alteração.
