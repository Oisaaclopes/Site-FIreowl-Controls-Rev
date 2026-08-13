-- =====================================================================
-- Módulo de Relatórios Técnicos — RECONCILIAÇÃO v2.0 (destrutivo aprovado)
-- Recria as tabelas do módulo (que estão vazias) no padrão da spec v2.0 e
-- cria as tabelas que faltavam. Requer 0004/0005 (auth_role), 0018 (clients),
-- 0020 (contracts), 0024 (report_templates). Idempotente.
--
-- ATENÇÃO: só rode este arquivo JUNTO com a fatia de código que casa com ele
-- (tipos/persistência atualizados). Rodar antes quebra o app atual.
--
-- CONVENÇÃO text × uuid (ponto 2): as PKs do legado são TEXT
-- (clients.id, contracts.id). Portanto as FKs de LIGAÇÃO AO LEGADO são text:
--   reports.cliente_id  -> clients(id)   [text, FK]
--   reports.contrato_id -> contracts(id) [text, FK]
--   reports.os_id       -> text SOLTO (não há tabela de OS ainda; ver ponto 4)
--   pendencias.cliente_id, devices.cliente_id, catalogo_provisorio: text p/ clients
-- As PKs e FKs INTERNAS do módulo (reports, answers, media, devices, pendencias,
-- signatures, ciclos) são todas UUID. tecnico_id/criado_por -> auth.users(id) [uuid].
-- =====================================================================

-- GUARDA DE SEGURANÇA (ponto 1): aborta se qualquer tabela do módulo tiver
-- linhas. Assim o destrutivo nunca apaga dados por engano — se não estiver
-- vazio, a migration falha e nada é derrubado.
do $$
declare n bigint;
begin
  if to_regclass('public.reports') is null then
    return; -- primeira instalação: nada a proteger
  end if;
  select
    (select count(*) from public.reports)        +
    (select count(*) from public.report_answers) +
    (select count(*) from public.report_media)   +
    (select count(*) from public.pendencias)      +
    (select count(*) from public.devices)
  into n;
  if n > 0 then
    raise exception
      'ABORTADO: tabelas do modulo de relatorios nao estao vazias (% linhas no total). Reveja antes de recriar (destrutivo).', n;
  end if;
end $$;

-- 0) Derruba as tabelas do módulo (vazias) para recriar no formato novo.
drop table if exists public.report_signatures cascade;
drop table if exists public.report_media      cascade;
drop table if exists public.report_answers    cascade;
drop table if exists public.pendencias        cascade;
drop table if exists public.reports           cascade;
drop table if exists public.devices           cascade;

-- 1) Ciclos de amostragem rotativa (Parte 7)
create table if not exists public.ciclos_amostragem (
  id                    uuid primary key default gen_random_uuid(),
  cliente_id            text references public.clients(id) on delete cascade,
  contrato_id           text,
  periodo_inicio        date,
  periodo_fim           date,
  percentual_por_visita numeric,
  dispositivos_totais   int default 0,
  dispositivos_testados int default 0,
  created_at            timestamptz not null default now()
);

-- 2) Inventário de dispositivos (as-built) — padrão v2.0
create table if not exists public.devices (
  id                    uuid primary key default gen_random_uuid(),
  cliente_id            text not null references public.clients(id) on delete cascade,
  sistema               text not null default 'SDAI'
                        check (sistema in ('SDAI','CFTV','CONTROLE_ACESSO','BMS')),
  central               text,
  laco                  text,
  endereco              text,
  tipo_dispositivo      text,
  fabricante            text,
  modelo                text,
  localizacao           text,
  pavimento             text,
  data_instalacao       date,
  status                text not null default 'ativo'
                        check (status in ('ativo','inativo','substituido','removido')),
  ultima_manutencao     date,
  ultimo_teste_funcional date,
  ciclo_amostragem_id   uuid references public.ciclos_amostragem(id) on delete set null,
  item_catalogo_id      text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists devices_cliente_idx on public.devices (cliente_id);
-- Chave: um dispositivo ativo por (cliente, central, laço, endereço).
create unique index if not exists devices_asbuilt_unique
  on public.devices (cliente_id, central, laco, endereco) where status = 'ativo';

-- 3) Relatórios — padrão v2.0
create table if not exists public.reports (
  id                 uuid primary key default gen_random_uuid(),
  template_id        uuid references public.report_templates(id) on delete set null,
  template_codigo    text not null,               -- conveniência (motor lê do banco por código)
  numero             text,                          -- LEV-2026-0142, COR-..., PRE-...
  tipo               text not null
                     check (tipo in ('LEVANTAMENTO','CORRETIVA','PREVENTIVA')),
  cliente_id         text references public.clients(id) on delete set null,
  os_id              text,                          -- SOLTO: não há tabela de OS ainda (ponto 4)
  contrato_id        text references public.contracts(id) on delete set null,
  tecnico_id         uuid default auth.uid(),
  tecnico_nome       text,
  titulo             text,
  local              text,
  status             text not null default 'rascunho'
                     check (status in ('rascunho','em_execucao','aguardando_assinatura','finalizado','cancelado')),
  data_inicio        timestamptz not null default now(),
  data_fim           timestamptz,
  geo_inicio         jsonb,                         -- {lat,lng,accuracy,timestamp}
  geo_fim            jsonb,
  resumo_execucao    jsonb,                         -- contadores calculados
  observacoes_gerais text,
  sync_status        text not null default 'sincronizado'
                     check (sync_status in ('local','sincronizado','conflito')),
  client_uuid        uuid,                          -- gerado no dispositivo (dedup na sync)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists reports_cliente_idx on public.reports (cliente_id);
create index if not exists reports_tecnico_idx on public.reports (tecnico_id);
create unique index if not exists reports_client_uuid_unique on public.reports (client_uuid) where client_uuid is not null;

-- 4) Respostas por campo — padrão v2.0
create table if not exists public.report_answers (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.reports(id) on delete cascade,
  secao       text,
  campo_key   text not null,                        -- texto, não FK (preserva se template mudar)
  valor       jsonb,
  device_id   uuid references public.devices(id) on delete set null,
  observacao  text,
  repeater_idx int,
  created_at  timestamptz not null default now()
);
create index if not exists report_answers_report_idx on public.report_answers (report_id);

-- 5) Pendências — padrão v2.0 (+ unidade)
create table if not exists public.pendencias (
  id                        uuid primary key default gen_random_uuid(),
  cliente_id                text references public.clients(id) on delete set null,
  device_id                 uuid references public.devices(id) on delete set null,
  report_origem_id          uuid references public.reports(id) on delete set null,
  grupo                     text,
  descricao                 text,
  acao_recomendada          text
                            check (acao_recomendada in
                              ('substituir','instalar','reposicionar','reparar',
                               'limpar','desobstruir','reprogramar','investigar')),
  norma_referencia          text,
  local                     text,
  quantidade                numeric default 1,
  unidade                   text,                    -- pç, m, vb, pt, h
  item_catalogo_id          text,
  item_texto_livre          text,
  precisa_cadastro_catalogo boolean not null default false,
  criticidade_operacional   int check (criticidade_operacional between 1 and 3), -- INTERNO
  status                    text not null default 'aberta'
                            check (status in
                              ('aberta','orcada','aprovada','em_execucao',
                               'corrigida','cancelada','recusada_cliente')),
  proposta_id               text,
  report_execucao_id        uuid references public.reports(id) on delete set null,
  criada_em                 timestamptz not null default now(),
  resolvida_em              timestamptz
);
create index if not exists pendencias_cliente_idx on public.pendencias (cliente_id);
create index if not exists pendencias_status_idx  on public.pendencias (status);

-- 6) Mídia — padrão v2.0 (original vs marcada; bandeja = answer_id null)
create table if not exists public.report_media (
  id                     uuid primary key default gen_random_uuid(),
  report_id              uuid not null references public.reports(id) on delete cascade,
  answer_id              uuid references public.report_answers(id) on delete set null,
  pendencia_id           uuid references public.pendencias(id) on delete set null,
  device_id              uuid references public.devices(id) on delete set null,
  tipo                   text not null default 'evidencia'
                         check (tipo in ('antes','depois','evidencia','geral')),
  storage_path_original  text not null,             -- nunca sobrescrito
  storage_path_marcado   text,                       -- versão com markup
  nota_rapida            text,
  legenda                text,
  capturado_em           timestamptz not null default now(),
  geo                    jsonb,
  ordem                  int default 0,
  created_at             timestamptz not null default now()
);
create index if not exists report_media_report_idx on public.report_media (report_id);
create index if not exists report_media_bandeja_idx on public.report_media (report_id) where answer_id is null;

-- 7) Assinaturas
create table if not exists public.report_signatures (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references public.reports(id) on delete cascade,
  papel        text not null check (papel in ('cliente','tecnico','responsavel_tecnico')),
  nome         text not null,
  documento    text,                                 -- mascarado na exibição (LGPD)
  cargo        text,
  storage_path text,                                 -- PNG
  assinado_em  timestamptz not null default now(),
  geo          jsonb
);
create index if not exists report_signatures_report_idx on public.report_signatures (report_id);

-- 8) Custos de logística (versionado por vigência)
create table if not exists public.custos_logistica (
  id                          uuid primary key default gen_random_uuid(),
  vigencia_inicio             date not null,
  vigencia_fim                date,
  custo_km                    numeric default 0,
  diaria_alimentacao          numeric default 0,
  diaria_hospedagem           numeric default 0,
  hora_tecnica_deslocamento   numeric default 0,
  pedagio_rota                jsonb,
  created_at                  timestamptz not null default now()
);

-- 9) Catálogo provisório (cliente/marca/item criados em campo)
create table if not exists public.catalogo_provisorio (
  id                uuid primary key default gen_random_uuid(),
  tipo              text not null check (tipo in ('cliente','marca','item')),
  dados             jsonb not null default '{}'::jsonb,
  report_origem_id  uuid references public.reports(id) on delete set null,
  criado_por        uuid default auth.uid(),
  status            text not null default 'pendente'
                    check (status in ('pendente','aprovado','mesclado','rejeitado')),
  registro_final_id text,                             -- para onde foi mesclado
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists catalogo_provisorio_status_idx on public.catalogo_provisorio (status);

-- =====================================================================
-- Funções auxiliares de RLS
-- =====================================================================

-- Dono do relatório (técnico) OU admin/gestor.
create or replace function public.owns_report(rid uuid)
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.reports r
    where r.id = rid
      and (r.tecnico_id = auth.uid() or public.auth_role() in ('ADMINISTRATIVO','GESTOR'))
  );
$$;
grant execute on function public.owns_report(uuid) to authenticated;

-- Relatório editável: dono/admin/gestor E não finalizado (imutabilidade, Parte 3).
create or replace function public.report_editavel(rid uuid)
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.reports r
    where r.id = rid
      and r.status <> 'finalizado'
      and (r.tecnico_id = auth.uid() or public.auth_role() in ('ADMINISTRATIVO','GESTOR'))
  );
$$;
grant execute on function public.report_editavel(uuid) to authenticated;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.ciclos_amostragem   enable row level security;
alter table public.devices             enable row level security;
alter table public.reports             enable row level security;
alter table public.report_answers      enable row level security;
alter table public.pendencias          enable row level security;
alter table public.report_media        enable row level security;
alter table public.report_signatures   enable row level security;
alter table public.custos_logistica    enable row level security;
alter table public.catalogo_provisorio enable row level security;

grant select, insert, update, delete on public.ciclos_amostragem   to authenticated;
grant select, insert, update, delete on public.devices             to authenticated;
grant select, insert, update, delete on public.reports             to authenticated;
grant select, insert, update, delete on public.report_answers      to authenticated;
grant select, insert, update, delete on public.pendencias          to authenticated;
grant select, insert, update, delete on public.report_media        to authenticated;
grant select, insert, update, delete on public.report_signatures   to authenticated;
grant select, insert, update, delete on public.custos_logistica    to authenticated;
grant select, insert, update, delete on public.catalogo_provisorio to authenticated;

-- ----- devices -----
drop policy if exists "devices select" on public.devices;
create policy "devices select" on public.devices for select to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'));
drop policy if exists "devices insert" on public.devices;
create policy "devices insert" on public.devices for insert to authenticated
  with check (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'));
drop policy if exists "devices update" on public.devices;
create policy "devices update" on public.devices for update to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR'))
  with check (public.auth_role() in ('ADMINISTRATIVO','GESTOR'));
drop policy if exists "devices delete" on public.devices;
create policy "devices delete" on public.devices for delete to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR'));

-- ----- reports (Financeiro vê todos; finalizado imutável) -----
drop policy if exists "reports select" on public.reports;
create policy "reports select" on public.reports for select to authenticated
  using (tecnico_id = auth.uid() or public.auth_role() in ('ADMINISTRATIVO','GESTOR','FINANCEIRO'));
drop policy if exists "reports insert" on public.reports;
create policy "reports insert" on public.reports for insert to authenticated
  with check (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'));
drop policy if exists "reports update" on public.reports;
create policy "reports update" on public.reports for update to authenticated
  using (status <> 'finalizado' and (tecnico_id = auth.uid() or public.auth_role() in ('ADMINISTRATIVO','GESTOR')))
  with check (tecnico_id = auth.uid() or public.auth_role() in ('ADMINISTRATIVO','GESTOR'));
drop policy if exists "reports delete" on public.reports;
create policy "reports delete" on public.reports for delete to authenticated
  using (status <> 'finalizado' and public.auth_role() in ('ADMINISTRATIVO','GESTOR'));

-- ----- report_answers / report_media / report_signatures (via posse + editável) -----
drop policy if exists "answers select" on public.report_answers;
create policy "answers select" on public.report_answers for select to authenticated
  using (public.owns_report(report_id) or public.auth_role() = 'FINANCEIRO');
drop policy if exists "answers write" on public.report_answers;
create policy "answers write" on public.report_answers for all to authenticated
  using (public.report_editavel(report_id)) with check (public.report_editavel(report_id));

drop policy if exists "media select" on public.report_media;
create policy "media select" on public.report_media for select to authenticated
  using (public.owns_report(report_id) or public.auth_role() = 'FINANCEIRO');
drop policy if exists "media write" on public.report_media;
create policy "media write" on public.report_media for all to authenticated
  using (public.report_editavel(report_id)) with check (public.report_editavel(report_id));

drop policy if exists "signatures select" on public.report_signatures;
create policy "signatures select" on public.report_signatures for select to authenticated
  using (public.owns_report(report_id) or public.auth_role() = 'FINANCEIRO');
drop policy if exists "signatures write" on public.report_signatures;
create policy "signatures write" on public.report_signatures for all to authenticated
  using (public.report_editavel(report_id)) with check (public.report_editavel(report_id));

-- ----- pendencias -----
drop policy if exists "pendencias select" on public.pendencias;
create policy "pendencias select" on public.pendencias for select to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO','FINANCEIRO'));
drop policy if exists "pendencias insert" on public.pendencias;
create policy "pendencias insert" on public.pendencias for insert to authenticated
  with check (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'));
drop policy if exists "pendencias update" on public.pendencias;
create policy "pendencias update" on public.pendencias for update to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR'))
  with check (public.auth_role() in ('ADMINISTRATIVO','GESTOR'));
drop policy if exists "pendencias delete" on public.pendencias;
create policy "pendencias delete" on public.pendencias for delete to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR'));

-- ----- ciclos_amostragem -----
drop policy if exists "ciclos select" on public.ciclos_amostragem;
create policy "ciclos select" on public.ciclos_amostragem for select to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'));
drop policy if exists "ciclos write" on public.ciclos_amostragem;
create policy "ciclos write" on public.ciclos_amostragem for all to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR'))
  with check (public.auth_role() in ('ADMINISTRATIVO','GESTOR'));

-- ----- custos_logistica (financeiro sensível) -----
drop policy if exists "custos select" on public.custos_logistica;
create policy "custos select" on public.custos_logistica for select to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR','FINANCEIRO'));
drop policy if exists "custos write" on public.custos_logistica;
create policy "custos write" on public.custos_logistica for all to authenticated
  using (public.auth_role() = 'ADMINISTRATIVO')
  with check (public.auth_role() = 'ADMINISTRATIVO');

-- ----- catalogo_provisorio (homologar = admin) -----
drop policy if exists "catprov select" on public.catalogo_provisorio;
create policy "catprov select" on public.catalogo_provisorio for select to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'));
drop policy if exists "catprov insert" on public.catalogo_provisorio;
create policy "catprov insert" on public.catalogo_provisorio for insert to authenticated
  with check (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'));
drop policy if exists "catprov update" on public.catalogo_provisorio;
create policy "catprov update" on public.catalogo_provisorio for update to authenticated
  using (public.auth_role() = 'ADMINISTRATIVO')
  with check (public.auth_role() = 'ADMINISTRATIVO');
drop policy if exists "catprov delete" on public.catalogo_provisorio;
create policy "catprov delete" on public.catalogo_provisorio for delete to authenticated
  using (public.auth_role() = 'ADMINISTRATIVO');
