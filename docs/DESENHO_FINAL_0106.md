# Desenho FINAL da migration 0106 (Manutenção Contratual)

> **Nada aplicado. Migration NÃO criada.** Este é o schema final proposto para a futura `0106`, para sua aprovação. Convenção do repo: PKs legadas (`clients.id`, `contracts.id`) = `text`; internas = `uuid`; aditiva, idempotente, revisada no SQL Editor. Próximo número real: **0106**.

## 0. Resultado da re-auditoria pontual (base do desenho)
- `reports` **já possui** `contrato_id text` (FK `contracts`) e `cliente_id text` → **reutilizar** (não recriar).
- `reports` **não possui** período documental (`period_start`/`period_end`/`competencia`) → **incluir** (§2).
- **Não existe** revisão/supersessão no banco. O **padrão maduro** de revisão documental é `proposal.revisoes[]` (jsonb): `{ numero, data, elaborador, motivo, alteracoes[], snapshot{...} }`. → **reutilizar a FORMA** do snapshot/revisão; a *linkagem* usa nova linha por causa da imutabilidade forte dos `reports` (§11/§12).
- FormEngine/versionamento (`report_answers`, `template_snapshot`, `template_version`, trigger de congelamento, `resolveReportTemplate`) → **reutilizar integralmente** (§5/§9).

---

## 1. `CREATE TABLE asset_maintenance_policies` (nova)

```sql
create table if not exists public.asset_maintenance_policies (
  id                     uuid primary key default gen_random_uuid(),
  nivel                  text not null
                         check (nivel in ('PADRAO','AREA','TIPO','CLIENTE','CONTRATO','ATIVO')),
  -- seletores (curinga quando null); preenchidos conforme o nivel
  area                   text
                         check (area is null or area in ('SDAI','CFTV','CONTROLE_ACESSO','BMS','ALARME')),
  grupo                  text,                                   -- devices.grupo (família)
  tipo_ativo             text,                                   -- devices.tipo_ativo (tipo canônico)
  cliente_id             text references public.clients(id)   on delete cascade,
  contract_id            text references public.contracts(id) on delete cascade,
  device_id              uuid references public.devices(id)   on delete cascade,
  -- payload da política
  periodicidade_meses    numeric not null check (periodicidade_meses > 0),
  obrigatorio_no_ciclo   boolean not null default false,
  janela_tolerancia_dias integer,
  ativa                  boolean not null default true,
  observacao             text,
  created_by             uuid default auth.uid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  -- coerência de seletores por nível (mais simples e segura que 6 colunas booleanas)
  check (nivel <> 'ATIVO'    or device_id  is not null),
  check (nivel <> 'CONTRATO' or contract_id is not null),
  check (nivel <> 'CLIENTE'  or cliente_id  is not null),
  check (nivel <> 'AREA'     or area        is not null),
  check (nivel <> 'TIPO'     or (tipo_ativo is not null or grupo is not null)),
  check (nivel <> 'PADRAO'   or (contract_id is null and device_id is null and cliente_id is null))
);
```

**Estrutura mais simples e segura escolhida (§7):** uma tabela, `nivel` explícito + seletores nuláveis. Não há coluna por nível; a hierarquia `PADRÃO → ÁREA → FAMÍLIA/TIPO → CLIENTE → CONTRATO → ATIVO` é expressa por `nivel` + seletores, e a resolução é por peso de especificidade (§8). `on delete cascade` nos seletores: apagar contrato/cliente/ativo remove suas políticas (config, não histórico).

### Índices
```sql
create index if not exists amp_contract_idx on public.asset_maintenance_policies (contract_id) where contract_id is not null;
create index if not exists amp_device_idx   on public.asset_maintenance_policies (device_id)   where device_id  is not null;
create index if not exists amp_cliente_idx  on public.asset_maintenance_policies (cliente_id)  where cliente_id is not null;
create index if not exists amp_area_tipo_idx on public.asset_maintenance_policies (area, tipo_ativo);
```

### Partial-unique (antiduplicação por especificidade, só ativas)
```sql
create unique index if not exists amp_uq_ativo    on public.asset_maintenance_policies (device_id)  where nivel='ATIVO'    and ativa;
create unique index if not exists amp_uq_contrato on public.asset_maintenance_policies (contract_id, coalesce(area,''), coalesce(grupo,''), coalesce(tipo_ativo,'')) where nivel='CONTRATO' and ativa;
create unique index if not exists amp_uq_cliente  on public.asset_maintenance_policies (cliente_id,  coalesce(area,''), coalesce(grupo,''), coalesce(tipo_ativo,'')) where nivel='CLIENTE'  and ativa;
create unique index if not exists amp_uq_padrao   on public.asset_maintenance_policies (coalesce(area,''), coalesce(grupo,''), coalesce(tipo_ativo,'')) where nivel in ('PADRAO','AREA','TIPO') and ativa;
```

### Trigger / RLS
```sql
create trigger amp_set_updated_at before update on public.asset_maintenance_policies
  for each row execute function public.set_updated_at();

alter table public.asset_maintenance_policies enable row level security;
grant select, insert, update, delete on public.asset_maintenance_policies to authenticated;

create policy "amp select" on public.asset_maintenance_policies for select to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO'));   -- técnico lê periodicidade em campo
create policy "amp write"  on public.asset_maintenance_policies for all to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO','GESTOR'))
  with check (public.auth_role() in ('ADMINISTRATIVO','GESTOR'));
```

### Checklist §19
| item | valor |
|---|---|
| **Motivo** | periodicidade configurável multidisciplinar (§14) — inexistente hoje; única tabela nova |
| **Impacto** | zero em tabelas existentes; alimenta a função pura de resolução |
| **Compat. retroativa** | aditiva; sem política = "periodicidade não definida" (nunca inventa norma) |
| **Offline** | leitura cacheável; escrita é administrativa/online → sem domínio de outbox novo |
| **Rollback** | `drop table if exists public.asset_maintenance_policies;` (config, sem perda operacional) |
| **Realtime** | opcional adicionar à publicação; não obrigatório |

---

## 2. `ALTER reports` — período documental + contrato (identidade do período)

`reports.contrato_id`/`cliente_id` já existem → **reutilizar**. Faltam:
```sql
alter table public.reports
  add column if not exists period_start date,
  add column if not exists period_end   date,
  add column if not exists competencia  text;   -- rótulo opcional (2026-09 / 2026-Q3 / 2026)
```

| campo | tipo | null | default | FK/ON DELETE | índice | unique | CHECK | motivo |
|---|---|---|---|---|---|---|---|---|
| `period_start` | date | **null** | — | — | `(contrato_id, period_start, period_end)` parcial | não | `check (period_end is null or period_start is null or period_end >= period_start)` | janela documental explícita do consolidado (§2/§17) |
| `period_end` | date | null | — | — | idem | não | idem | fim da janela |
| `competencia` | text | null | — | — | — | não | — | rótulo humano; **nunca** chave de agregação (D.2 do desenho anterior) |

```sql
create index if not exists reports_contract_period_idx
  on public.reports (contrato_id, period_start, period_end)
  where contrato_id is not null and period_start is not null;
```

- **RLS:** herda `reports` (finalizado imutável). Sem mudança de policy.
- **Compat.:** aditiva; relatórios existentes ficam com período `NULL` (documentos por atendimento não têm janela).
- **Offline:** sem impacto (consolidado é fechado online).
- **Rollback:** `drop column` dos três.

---

## 3. `ALTER reports ADD service_attendance_id` (vínculo documento ↔ atendimento)

```sql
alter table public.reports
  add column if not exists service_attendance_id uuid
    references public.service_attendances(id) on delete set null;
create index if not exists reports_attendance_idx
  on public.reports (service_attendance_id) where service_attendance_id is not null;
```

| item | valor |
|---|---|
| **Tipo/null/default** | `uuid`, **nullable**, sem default |
| **FK / ON DELETE** | `service_attendances(id)` · `on delete set null` (apagar atendimento não apaga o documento; vira avulso) |
| **UNIQUE** | **NÃO** (1 atendimento → 0..N documentos técnicos; §3) |
| **Cardinalidade** | `service_attendance 1 → 0..N reports` · `report 0..1 service_attendance` |
| **Motivo** | saber de qual atendimento nasceu o checklist (§3/§5). **Nunca** usar `os_id` como identidade (§33) |
| **Consolidado** | `MANUTENCAO` fica com `service_attendance_id = NULL` (não pertence a 1 atendimento — §13) |
| **RLS** | herda `reports`; o técnico já vê os próprios reports; atendimento próprio via RLS de `service_attendances` |
| **Compat.** | aditiva; reports legados = NULL |
| **Offline** | vínculo gravado junto do report no `reportSync` existente; sem novo domínio |
| **Rollback** | `drop column if exists service_attendance_id;` |

---

## 4. `ALTER reports` — snapshot documental + revisão (§11/§12)

**Reuso da FORMA madura `proposal.revisoes[]`**, respeitando a imutabilidade forte de `reports` (finalizado é bloqueado por RLS; snapshot congelado por trigger). Campos mínimos:

```sql
alter table public.reports
  add column if not exists snapshot            jsonb,   -- documento consolidado congelado (reproduz o emitido)
  add column if not exists revisao             text default 'R00',
  add column if not exists fechado_em          timestamptz,
  add column if not exists supersedes_report_id uuid
    references public.reports(id) on delete set null;   -- R01 aponta o R00
create index if not exists reports_supersedes_idx
  on public.reports (supersedes_report_id) where supersedes_report_id is not null;
```

- **`snapshot jsonb`** carrega o documento reproduzível (mesma ideia de `revisoes[].snapshot` da proposta): cliente/unidade, contrato, período, sistemas, atendimentos (id+técnico+data+resultado), técnicos, ativos relevantes (**id + nome/endereço no momento** — não é cadastro, é congelamento de leitura §15/§16), status de centrais/equipamentos, medições, testes (verificações do período), cobertura, alterações da Base (antes/depois), pendências (abertas/anteriores/resolvidas), corretivas, fotos selecionadas (**paths**, não arquivo — §15), conclusão, refs de assinatura, `fechado_em`, `revisao`, e a **lista de membership** (IDs de executions/attendances incluídos — ver §17).
- **`resumo_execucao`** permanece com sua semântica atual (contadores) — **não** sobrecarregado (§11).
- **Imutabilidade:** estender o trigger `reports_freeze_template_snapshot` (0075) para também congelar `snapshot`/`revisao`/`fechado_em` uma vez preenchidos — **mesma técnica, sem mecanismo novo**.
- **Revisão R00/R01 (§12):** R00 finalizado **nunca muda** (RLS + trigger). Correção = **nova linha** `reports` com `revisao='R01'` e `supersedes_report_id → R00`. A aba Relatórios mostra a revisão vigente; R00 fica no histórico. *(A FORMA do snapshot/metadados de revisão reaproveita `proposal.revisoes[]`; a linkagem é por nova linha porque report finalizado é imutável — proposta não tem esse congelamento.)*

| item | valor |
|---|---|
| **null/default** | `snapshot` null; `revisao` default `'R00'`; `fechado_em` null; `supersedes_report_id` null |
| **FK/ON DELETE** | `supersedes_report_id → reports(id)` `on delete set null` |
| **UNIQUE/CHECK** | sem unique; sem check novo (revisão validada no app) |
| **RLS** | herda `reports`; trigger reforça imutabilidade |
| **Compat.** | aditiva; reports atuais `revisao='R00'`, `snapshot NULL` |
| **Offline** | fechamento é ação online (gestão) → sem domínio novo |
| **Rollback** | `drop column` dos 4 + reverter trigger à versão 0075 |

---

## 5. `ALTER contract_routines ADD template_codigo` (§9)

```sql
alter table public.contract_routines add column if not exists template_codigo text;
```
- **Nullable**, **sem FK** (convenção `catalog_item_id`; `codigo` já é unique em `report_templates`; não travar rename/seed).
- **Comportamento histórico:** a rotina só escolhe **qual** template; a **versão executada** continua congelada em `reports.template_snapshot`+`template_version` (0075). Sem versionamento paralelo.
- **RLS:** herda `contract_routines` (ADMIN/GESTOR/FINANCEIRO). **Compat.:** aditiva. **Offline:** irrelevante (config). **Rollback:** `drop column`.

---

## 6. `ALTER CHECK` — novo tipo `MANUTENCAO` (§10)

```sql
-- reports.tipo
alter table public.reports drop constraint if exists reports_tipo_check;
alter table public.reports add constraint reports_tipo_check
  check (tipo in ('LEVANTAMENTO','CORRETIVA','PREVENTIVA','MANUTENCAO'));
-- report_templates.tipo (para permitir template consolidado, se houver)
alter table public.report_templates drop constraint if exists report_templates_tipo_check;
alter table public.report_templates add constraint report_templates_tipo_check
  check (tipo in ('LEVANTAMENTO','CORRETIVA','PREVENTIVA','MANUTENCAO'));
```
- **Motivo:** consolidado agrega preventiva+corretivas+pendências → não é PREVENTIVA (§10). PREVENTIVA segue existindo onde corresponde.
- **Impacto/compat.:** drop+recreate do CHECK é seguro (dados atuais usam só CORRETIVA/PREVENTIVA; LEVANTAMENTO esvaziado na 0100). O nome real do constraint deve ser confirmado no banco antes (Postgres pode tê-lo nomeado `reports_tipo_check`).
- **`MANUTENCAO`:** `template_snapshot` fica **NULL** (é gerado, não FormEngine); `snapshot` (§4) carrega os dados; `resolveReportTemplate` já degrada com `source='unknown'` sem quebrar.
- **Rollback:** recriar CHECK sem `MANUTENCAO` (pré-check: nenhuma linha usando o valor).

---

## 7. Effective maintenance policy — função pura (§8)

Local sugerido `lib/maintenancePolicies.ts` (puro, testável, offline com dados sincronizados; **fonte única da regra**). Assinatura conceitual:

```
resolveEffectivePolicy(
  device: { area, grupo, tipo_ativo, cliente_id, id },
  contractId: string | null,
  policies: AssetMaintenancePolicy[]   // apenas ativa=true, já sincronizadas
): { periodicidadeMeses, obrigatorioNoCiclo, janelaToleranciaDias, origem } | null
```

**Algoritmo:**
1. **Casa** (todo seletor não-nulo bate; nulo = curinga): `device_id==device.id`, `contract_id==contractId`, `cliente_id==device.cliente_id`, `area/grupo/tipo_ativo==do ativo`.
2. **Pontua** por especificidade (mais específico vence):

   | condição | peso |
   |---|---|
   | ATIVO (`device_id`) | 1000 |
   | CONTRATO + `tipo_ativo` | 850 |
   | CONTRATO + `grupo` | 800 |
   | CONTRATO (só) | 750 |
   | CLIENTE + `tipo_ativo`/`grupo` | 650 |
   | CLIENTE (só) | 600 |
   | PADRÃO/AREA/TIPO + `area`+`tipo_ativo` | 400 |
   | PADRÃO + `area`+`grupo` | 300 |
   | PADRÃO + `area` | 200 |
   | PADRÃO global | 100 |
3. Maior peso vence; empate → `updated_at` mais recente. Sem match → `null` ("periodicidade não definida"; nunca inventa).

**Exemplo (§8):** Detector de fumaça — Padrão 12m, Contrato X 6m, Ativo 3m → **3m**. Sem override de ativo → **6m**. Sem override de contrato → **12m**. Fallback previsível, sem duplicar regra.

---

## 8. Cardinalidades finais (§20)

```
Contract 1───N ContractRoutine
ContractRoutine 1───N ContractRoutineExecution        (UNIQUE(routine, competencia))
ContractRoutineExecution 1───0..1 OrdemServico        (idempotente)
Contract 1───N ServiceAttendance                      (via OS; §33 nunca 1:1 com OS)
OrdemServico 1───N ServiceAttendance
ServiceAttendance 1───0..N Reports/documentos técnicos (reports.service_attendance_id, sem unique)
Report 0..1 ServiceAttendance
(Contract + [period_start,period_end]) ───→ 1 Report MANUTENCAO por revisão   (service_attendance_id NULL)
Report(MANUTENCAO) ──agrega──▶ N attendances/executions   (membership congelada no snapshot; nenhum attendance é "dono")
Report 0..1 supersedes_report_id (self, R00◄─R01)
Device 1───N DeviceVerification                       (N testes / eventos históricos)
Device 0..1 parent_device_id · 0..1 replaced_by_device_id (self)
Pendencia N──(atravessa)──N períodos/competências      (entidade persistente; nunca copiada)
Pendencia 1───N FieldPhoto
AssetMaintenancePolicy N──(resolve, mais específico)──1 Device   (não FK rígido)
ContractRoutine N───1 report_templates (por codigo, soft)
```

---

## 9. Exemplo multi-frequência detalhado (§17)

**Contrato CT-2026-X** · vigência **2026-01-01 → 2026-12-31**
Rotinas: `R_SDAI` (mensal, intervalo 1), `R_CFTV` (trimestral, intervalo 3), `R_ALARME` (mensal, intervalo 1).
**Relatório MANUTENCAO** · janela **2026-09-01 → 2026-09-30**.

**Quais routine_executions entram** (regra: `data_programada ∈ janela`, ou, na ausência, data do atendimento):
- `R_SDAI` competência **2026-09**, `data_programada 2026-09-03` → **ENTRA**
- `R_ALARME` competência **2026-09**, `data_programada 2026-09-03` → **ENTRA**
- `R_CFTV` competência **2026-Q3** → **ENTRA só se** sua `data_programada`/atendimento cair em setembro (ex.: `2026-09-10`). Se a visita trimestral ocorreu em julho, **NÃO entra** no consolidado de setembro (aparece como "sem atendimento no período; última visita 2026-07-15" ou é agregada ao consolidado de julho).

**Quais attendances entram:** `service_attendances` com `started_at`/`finished_at ∈ janela`, ligados por `ordens_servico ← execution.ordem_servico_id`, filtrando `ordens_servico.contrato_id = 'CT-2026-X'`. Essa é a **evidência real de execução** dentro do período.

**Como a trimestral é considerada:** pela **data real** (programada/atendida), não pela string `2026-Q3`. Uma execução trimestral cai em **exatamente um** consolidado mensal (o mês de sua âncora de data) → sem dupla contagem.

**Como evitar duplicidade:** dedupe por **identidades reais** (`execution.id`, `service_attendance.id`, `device_verification.id`, `pendencia.id`) — **nunca** por `os_id`. Cada execução/atendimento tem âncora de data única → pertence a uma janela.

**Como identificar atividade executada no período:** join `contract → ordens_servico → service_attendances` filtrado por data ∈ janela; testes/fotos/pendências pendurados nesses attendances entram automaticamente.

**Limitação examinada — precisa de `maintenance_cycles`?** **NÃO.**
- Caso de borda: atendimento que começa 28/09 e termina 02/10 poderia tocar duas janelas. Resolução determinística por **âncora única** (`started_at` ou `data_programada`) → pertence a uma só janela.
- "Que execuções entraram oficialmente no consolidado de setembro?" → fica **congelado na `reports.snapshot` (membership)** ao fechar. O snapshot **é** o registro persistente de pertencimento → dispensa entidade de ciclo.
- **Gatilho para parar e propor `maintenance_cycles`:** só se surgir necessidade de identidade global nomeada/reutilizável por FK, status global persistido antes do fechamento, ou execução que exija **múltiplas OS** por rotina/competência (hoje `execution.ordem_servico_id` é único). Nada disso é exigido agora → **não crio**.

---

## 10. Snapshot / revisão (§11/§12) — resumo
- **Antes de fechar:** documento dinâmico (lê tabelas operacionais vivas).
- **Ao fechar:** grava `snapshot` (reproduz o emitido) + `fechado_em` + `revisao='R00'`; trigger congela.
- **Correção:** nova linha `revisao='R01'`, `supersedes_report_id→R00`; R00 intacto.
- **Reuso:** forma de `proposal.revisoes[]`; imutabilidade de `reports` (RLS+trigger 0075). Sem lógica paralela.

## 11. RLS (§19) — resumo
- Nova policy só em `asset_maintenance_policies` (select ADMIN/GESTOR/TECNICO; write ADMIN/GESTOR).
- Todos os `ALTER` em `reports`/`contract_routines` **herdam** RLS existente; nada afrouxado; trigger reforça imutabilidade. Técnico sem acesso comercial (dados de contrato via RPC `SECURITY DEFINER` já existente).

## 12. Offline (§19) — resumo
- Políticas: cache de leitura no campo; escrita administrativa online → **sem** domínio de outbox novo.
- `service_attendance_id`/período/snapshot gravam junto do report no `reportSync` existente. Reusar domínios `REPORT`/`TECH_ASSET`/`FIELD_PHOTO*`. Avaliar `MAINTENANCE_TEST` **na mesma fila** só se o payload divergir — **não** agora.

## 13. Índices / constraints (§19) — consolidado
- `asset_maintenance_policies`: 4 índices + 4 partial-unique + 6 CHECK de coerência.
- `reports`: `reports_contract_period_idx`, `reports_attendance_idx`, `reports_supersedes_idx`; CHECK de período; CHECK `tipo` recriado com `MANUTENCAO`.
- `report_templates`: CHECK `tipo` recriado com `MANUTENCAO`.

## 14. Rollback completo da futura 0106 (§19)
```sql
drop table if exists public.asset_maintenance_policies;
alter table public.contract_routines drop column if exists template_codigo;
alter table public.reports
  drop column if exists supersedes_report_id,
  drop column if exists fechado_em,
  drop column if exists revisao,
  drop column if exists snapshot,
  drop column if exists competencia,
  drop column if exists period_end,
  drop column if exists period_start,
  drop column if exists service_attendance_id;
-- reverter trigger reports_freeze_* à versão 0075
-- recriar CHECK de tipo sem MANUTENCAO (pré-check: sem linhas tipo='MANUTENCAO' em reports e report_templates)
```
Idempotente (`add ... if not exists`, `drop ... if exists`); nenhum objeto de Storage tocado; sem perda de dado operacional.

## 15. Riscos restantes
1. **Nome real do constraint** `reports_tipo_check`/`report_templates_tipo_check` deve ser confirmado no banco (Postgres pode ter gerado outro nome) antes do drop.
2. **Convenção text×uuid:** `contract_id`/`cliente_id` são `text` na policy; `device_id` é `uuid`. Erro fácil — validar nos seletores.
3. **Camada-1 vs. PREVENTIVA legada:** já existe fluxo PREVENTIVA no `ReportForm` com cobertura via `ciclos_amostragem`. Definir na implementação se o checklist SDAI reusa `PREVENTIVA_SDAI` + `service_attendance_id` ou um novo código de template — **não** altera a 0106 (é seed/UI), mas evita retrabalho.
4. **Âncora de data** dos attendances multi-dia: fixar `started_at` como âncora para pertencimento a janela (regra de código, não schema).

## 16. Decisões que ainda preciso de você
1. **Período em `reports`:** aprova `period_start`/`period_end` + `competencia` (texto opcional)?
2. **Revisão:** confirma **nova linha `supersedes_report_id`** (R00 imutável) reusando a *forma* de `proposal.revisoes[]`? (vs. tudo-em-jsonb, que contraria a imutabilidade dos reports)
3. **`snapshot` como coluna própria** em `reports` (sem tocar `resumo_execucao`) — confirmado?
4. **Nível `CLIENTE`** na policy (além de PADRÃO/CONTRATO/ATIVO) — mantenho os 6 níveis ou simplifico para 3?
5. **Confirmar recriação do CHECK** de `report_templates.tipo` também (ou só `reports.tipo`, deixando templates sem `MANUTENCAO` já que o consolidado é gerado sem template)?

**PARADO após o desenho. Não crio a 0106 até você aprovar estes 5 pontos.**
