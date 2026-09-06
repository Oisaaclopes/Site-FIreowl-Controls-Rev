# Auditoria de Arquitetura — Manutenção Contratual Integrada

> Fase estrutural nova. **Nenhuma linha de código, migration ou schema foi alterada nesta etapa.** Este documento é a entrega A–N / §38 exigida antes de qualquer implementação. Próximo número real de migration no repositório: **0106** (última aplicada: `0105_calendar_events`).

---

## 1. Estado atual encontrado (visão geral)

O Fireowl Guardian **já é**, na prática, 80% de um sistema de manutenção contratual — só que as peças estão distribuídas por etapas (Comercial, Operacional 3A/3B, Base Técnica 3D) e ainda **não foram orquestradas** sob um contexto único "Contrato → Ciclo → Atendimento". A boa notícia da auditoria: **quase nada precisa ser criado do zero**. O trabalho é de *integração e orquestração*, exatamente como o briefing exige (§2/§7).

Stack: Next.js (export estático → Hostinger) + Supabase (Postgres + RLS + Realtime + Storage privado) + react-pdf. 105 migrations aditivas/idempotentes, convenção `text` para PKs legadas (`clients.id`, `contracts.id`) e `uuid` para entidades internas.

---

## 2. Auditoria item a item (§30) — EXISTENTE / REUTILIZAR / LACUNA

| # | Responsabilidade | Onde vive hoje | Reutilizar? | Lacuna |
|---|---|---|---|---|
| 1 | **Contratos** | `contracts` (0020/0022) + estruturados 0056: `contract_routines`, `contract_routine_executions`, `contract_hour_ledger`, `contract_attachments`; `contracts.areas_cobertas text[]`, `tipos_atendimento text[]`, `sla jsonb` | **SIM (núcleo)** | Falta vínculo formal Área→Template e periodicidade por ativo |
| 2 | **field_operations** | `field_operations` + `field_operation_assignments` (0083) — operação recorrente + N técnicos, com RLS por alocação | **SIM** | Nenhuma |
| 3 | **service_attendances** | `service_attendances` (0083) — 0..N por OS, GPS início/fim, `result`, condição da central (0087), assinatura (0091) | **SIM (peça central de execução)** | Nenhuma estrutural |
| 4 | **technical_surveys** | `technical_surveys` + `device_verifications` (0095) — levantamento por área + histórico de condição por ativo | **SIM** | Nenhuma |
| 5 | **Base Técnica** | `devices` (0029 v2 + 0094 multidisciplinar) — **entidade canônica única** | **SIM (canônica, §3)** | Nenhuma — já é a fonte da verdade |
| 6 | **Hierarquia de ativos** | `devices.parent_device_id` (self-ref) + `technical_attributes jsonb` + `lib/sdaiHierarchy.ts`, `lib/technicalBase.ts` (config por área) | **SIM** | Nenhuma |
| 7 | **Lifecycle de ativos** | `devices.status` (ativo/inativo/substituido/removido) + `condicao` + `replaced_by_device_id` + `removed_at`; `lib/assetLifecycle.ts` + `assetLifecycleApply.ts`; `base_update_decision` nos evidence items (0098) | **SIM** | Nenhuma — hard-delete já é proibido |
| 8 | **FormEngine / templates** | `reportSchema.ts` (tipos: `checklist_dispositivos`, `checklist_pendencias`, `repeater`, `passfail`, `foto`, `select_falha`, `gera_pendencia`, `abre_pendencia_se`), `formConditions.ts` (show_if/hide_if/required_if/disable_if), `reportTemplates.ts` + `reportTemplateVersioning.ts`, `components/reports/FormEngine.tsx` | **SIM (motor genérico já existe)** | Falta o **template SDAI de manutenção** (conteúdo, não motor) |
| 9 | **field_photos / evidence** | `field_photo_sessions` + `field_photos` (0064) com vínculos a report/os/pendência/**atendimento** (0084)/**evidence_item** (0088)/**device**+**survey** (0095), `evidence_moment` (0087), `marcador`; comparações antes×depois (0067); original+markup+evidência; storage privado + signed URLs; `sync_status` | **SIM (não criar galeria nova, §8)** | Só falta vínculo opcional a **ciclo** (derivável) |
| 10 | **Pendências** | `pendencias` (0027/0029) — lifecycle completo (aberta→orcada→aprovada→em_execucao→corrigida/…), `device_id`, `report_origem_id`, `report_execucao_id`, `proposta_id`, `criticidade_operacional` INTERNA | **SIM (atravessa ciclos por natureza, §17)** | Nenhuma estrutural |
| 11 | **OS** | `ordens_servico` (0033) + lifecycle/cancelamento/hard-delete seguro (0074) + `source_pedido_id` (0073) + RPC `get_os_mission` + `pendencia_ids[]` + `report_id` | **SIM** | Nenhuma |
| 12 | **Pedido** | `pedidos` (0008/0046) — `proposal jsonb` (`areaPrincipal`, `equipmentItems`, responsabilidades) | **SIM (corretivas → orçamento, §18)** | Nenhuma |
| 13 | **Agenda / calendar_events** | `calendar_events` (0105) eventos livres + `contract_routine_executions.data_programada` (cronograma derivado do contrato) + `lib/schedule.ts`, `calendarEvents.ts` | **SIM (não criar calendário paralelo, §25)** | Ponte cronograma-de-contrato → agenda pode ser reforçada |
| 14 | **Relatórios** | `reports` + `report_answers` + `report_media` + `report_signatures` + `ciclos_amostragem` (0024/0025/0029). `reports.tipo` já inclui **`PREVENTIVA`** | **SIM** | Falta **gerador consolidado multi-sistema** (código) |
| 15 | **PDFs react-pdf** | `lib/reportPdf.ts` + `components/documentos/*Document.tsx` (ReportTechnicalDocument, LaudoTecnicoDocument, PropostaDocument, pdfKit) | **SIM** | Novo layout de relatório consolidado (composição, não infra) |
| 16 | **Assinatura** | `report_signatures` (0029) + assinatura de atendimento (0091) + `signatures.ts` + `SignatureCanvas.tsx` | **SIM** | Nenhuma |
| 17 | **Versionamento documental** | 0075: `reports.template_snapshot`/`template_version` **imutáveis** (trigger `reports_freeze_template_snapshot`) + `schema_hash` + `publishTemplate` versionado; `docs/TEMPLATE_VERSIONING.md` | **SIM (padrão de imutabilidade já provado)** | Estender o mesmo padrão ao **snapshot de dados** do relatório fechado (decisão) |
| 18 | **Offline / outbox** | `lib/offline/` — `idb.ts`, `outbox.ts` (lease + `ownerUserId` + retry + idempotência), `reportSync.ts`, `fieldPhotoSync.ts`, `technicalBaseSync.ts`; domínios `REPORT`/`FIELD_PHOTO*`/`TECH_ASSET`/`ASSET_LIFECYCLE` | **SIM (não criar mecanismo paralelo, §27)** | Reusar domínios existentes; talvez `MAINTENANCE_TEST` como novo domínio (mesma fila) |
| 19 | **RBAC / RLS** | `rbac.ts` (`ROLE_TABS`) + SQL `auth_role()`; papéis **ADMINISTRATIVO / GESTOR / TECNICO / FINANCEIRO**; RLS por tabela (técnico vê o próprio; gestão administra) | **SIM (papéis reais, §28)** | Nenhuma — não inventar papéis |
| 20 | **Migrations** | `lib/db/migrations/0000…0105` (não `supabase/migrations`). Aditivas, idempotentes, revisadas manualmente no SQL Editor | **SIM (padrão consolidado)** | Próximo número **0106** |

---

## 3. Mapa de reaproveitamento (§38.2) — o que orquestrar

```
Cliente (clients)                     ← canônico
  └─ Contrato (contracts)             ← + areas_cobertas[], contract_routines (por área/frequência)
       └─ Ciclo/Competência           ← contract_routine_executions (JÁ TEM período + status + os + report)
            └─ OS (ordens_servico)    ← gerada por generate_os_from_execution (idempotente)
                 └─ Atendimento(s)    ← service_attendances (0..N por OS)
                      ├─ Testes       ← device_verifications (histórico por ativo) + evidence_items
                      ├─ Fotos        ← field_photos (vínculo a atendimento/ativo/evidence_item)
                      ├─ Pendências   ← pendencias (lifecycle próprio, atravessa ciclos)
                      └─ Base Técnica ← devices (canônico) atualizado só por base_update_decision
       └─ Relatório consolidado       ← reports (tipo=PREVENTIVA) + snapshot imutável (padrão 0075)
```

**Descoberta-chave:** `contract_routine_executions` **já é o "Ciclo"** conceitual do §9 — tem `competencia` (período: `2026-09` / `2026-Q3` / `2026`), `data_programada`, `status` (previsto→agendado→os_gerada→executado→relatorio_emitido), `ordem_servico_id`, `report_id` e `UNIQUE(routine_id, competencia)` (idempotência). A recorrência (mensal/quinzenal/trimestral/…) já é calculada em `lib/contractRoutines.ts` (`intervaloMesesRotina`, `competenciaDe`). **Não precisamos criar uma tabela de ciclo nova** — precisamos *expor* essa entidade como "Ciclo" na UI e permitir múltiplos atendimentos por ela (que já é o caso: 1 competência → 1 OS → N atendimentos).

`ciclos_amostragem` (0029) é uma entidade **diferente** (amostragem rotativa/cobertura §19) e resolve o item **Cobertura**, não o item Ciclo-período.

---

## 4. Lacunas reais encontradas (§38.3) — o que genuinamente falta

Apenas **quatro** lacunas estruturais reais; o resto é composição de código sobre o que existe:

1. **Periodicidade de teste configurável por tipo de ativo (§14).** Não existe. É a *única* necessidade clara de tabela nova: "modelo padrão Fireowl + override por contrato/cliente/tipo/ativo". Hoje periodicidade não está em lugar nenhum (nem hardcoded).
2. **Vínculo Área → Template → periodicidade no Plano de Manutenção (§10/§11).** Parcial: `contracts.areas_cobertas[]` + `contract_routines.area` existem, mas não há binding para o `template_codigo` que cada área usa, nem para a periodicidade da área. Provável **coluna nova em `contract_routines`** (`template_codigo`), não tabela nova.
3. **Snapshot de DADOS do relatório fechado (§23).** O padrão de imutabilidade existe (0075) mas congela só a *definição* do template — não o *conteúdo agregado* do período. Decisão: reusar `reports` + coluna `snapshot jsonb` (dados consolidados congelados) e revisão R00/R01.
4. **Regra "checklist da central 1×/ciclo por central" (§13).** Não há estado que marque isso. Preferência: **derivar** de `device_verifications`/answers da central dentro da janela do ciclo (sem tabela). Se a derivação não fechar, um marcador leve.

Tudo o mais (template SDAI, gerador de relatório consolidado, telas mobile, navegação contextual, cobertura) é **código sobre schema existente**.

---

## 5. Proposta de arquitetura (§37.D) — orquestração, não módulo paralelo

**Camada "Manutenção" = uma nova *aba/contexto* que compõe entidades existentes**, sob a aba `contratos` (ou nova entrada `manutencao` no `TabPath`/RBAC). Nada de nova Base Técnica, Fotos, Pendências, Atendimentos ou Agenda.

- **Contexto operacional (§6/§26):** estender o padrão já existente em `lib/fieldStateContext.ts` (que hoje cruza operação × alocação × atendimento por técnico) para carregar `cliente → contrato → ciclo(execução) → atendimento → área` e propagar como *contexto herdado* a Fotos/Pendências/Base/Relatório. É a peça de "navegação contextual" e já tem fundação pura e testável.
- **Plano de Manutenção:** `contracts.areas_cobertas[]` (quais áreas) + `contract_routines` por área (frequência, dias, técnicos, SLA) + binding de template por área. UI administrativa nova; dados quase todos já existentes.
- **Ciclo:** UI sobre `contract_routine_executions`; materialização sob demanda via `ensure_routine_execution` (idempotente, já existe); OS via `generate_os_from_execution` (idempotente, já existe).
- **Execução mobile (§15):** reusar `components/operacoes/ServiceAttendanceFlow.tsx` + FormEngine com *progressive disclosure*; "próximo ativo previsto" derivado de `devices` (base) + periodicidade + `device_verifications`.
- **Template SDAI (§12):** um `TemplateSchema` JSON publicado via `publishTemplate` (versionado). `checklist_dispositivos` já gera repeater a partir de `devices`; laços dinâmicos vêm da Base (§12 "nº de laços não é fixo") — o motor já suporta.
- **Relatório consolidado (§21/§22):** `reports` (tipo `PREVENTIVA`) + gerador que agrega atendimentos/testes/pendências/fotos/alterações-de-base/cobertura do ciclo; fechar = snapshot imutável (padrão 0075).

---

## 6. Modelo de dados mínimo (§31) — EXISTENTE → REUTILIZAR / NOVO → JUSTIFICATIVA / ALTERAR

| Necessidade (§31) | Decisão | Detalhe |
|---|---|---|
| maintenance plan | **REUTILIZAR** `contracts.areas_cobertas[]` + `contract_routines` | + possível `ALTERAR`: `contract_routines.template_codigo text` |
| maintenance cycle | **REUTILIZAR** `contract_routine_executions` | É o ciclo/competência; só exposição de UI |
| template version | **REUTILIZAR** `reportTemplateVersioning` + `reports.template_snapshot` (0075) | Nada novo |
| periodicidade | **NOVO** `asset_maintenance_policies` | Modelo padrão + override; **única tabela realmente nova** |
| scheduled asset test | **DERIVAR** de `devices` + policy + `device_verifications` | Sem tabela; materializar só se performance exigir |
| executed asset test | **REUTILIZAR** `device_verifications` (0095) + `service_attendance_evidence_items` (0088/0098) | Nada novo |
| vínculo com atendimento | **REUTILIZAR** `service_attendances` + FKs 0084/0087/0088/0098 | Nada novo |
| vínculo com pendência | **REUTILIZAR** `pendencias` (`device_id`, `report_origem_id`, `report_execucao_id`) | Nada novo |
| snapshot do relatório | **ALTERAR** `reports` + `snapshot jsonb` (dados agregados congelados) + revisão R00/R01 | Decisão do Isaac |

**Candidatos a migration (a partir de 0106) — NÃO criados nesta etapa, aguardando sua aprovação:**
- `0106` (candidato): `asset_maintenance_policies` — periodicidade configurável (modelo + override por contrato/cliente/tipo/ativo).
- `ALTER contract_routines ADD template_codigo text` — binding área→template.
- `ALTER reports ADD snapshot jsonb` (+ campos de revisão R00/R01) — relatório fechado imutável de dados.

---

## 7. Fluxo alvo (§37.F)

```
Contrato → Plano(áreas+rotinas+templates+periodicidade)
        → Ciclo (contract_routine_executions, competência)
        → OS (generate_os_from_execution, idempotente)
        → Atendimento (service_attendances)
             → Teste do ativo (device_verifications) ─┐
             → Foto (field_photos)                    ├→ tudo herda contexto (cliente/contrato/ciclo/atendimento/área/ativo)
             → Pendência (pendencias, atravessa ciclos)┘
             → Alteração de Base (base_update_decision → devices; histórico preservado)
             → Corretiva na visita (evidence_item antes/depois) OU Pendência→Pedido→OS corretiva
        → Relatório consolidado (reports PREVENTIVA, gerado dos dados)
        → Revisar e Fechar (snapshot imutável, R00/R01)
```

---

## 8. Respostas diretas ao checklist §38

- **§38.5 Relações entre entidades:** todas por FK real; nunca `os_id` como identidade universal (§33) — `service_attendances.id`, `device_verifications.id`, `pendencias.id` são identidades próprias; 1 OS → N atendimentos → N testes; 1 pendência → N ciclos.
- **§38.6 Como evitar duplicação:** nenhuma segunda Base/Foto/Pendência/Atendimento/Agenda; a camada Manutenção só *lê e vincula* o que existe.
- **§38.7 Histórico:** Base Técnica = estado atual (`devices`); Atendimento = registro do momento; Histórico do ativo = `device_verifications` + eventos reais (derivado, não texto duplicado); Relatório fechado = snapshot.
- **§38.8 Relatório fechado imutável:** padrão 0075 já provado (trigger de congelamento); estender ao snapshot de dados + revisão R00/R01.
- **§38.9 Pendências atravessando ciclos:** `pendencias` tem lifecycle e datas próprios; o relatório do ciclo apenas *consulta* (abertas no período / anteriores ainda abertas / resolvidas no período).
- **§38.10 Fotos vinculadas:** `field_photos` já carrega os vínculos; contexto de ciclo é derivável do atendimento/OS/execução.
- **§38.11 Base canônica:** `devices` permanece única fonte; renomear/mover/substituir reflete adiante e histórico fica em `device_verifications` + snapshot dos relatórios fechados.
- **§38.12 Agenda:** `calendar_events` + `contract_routine_executions.data_programada`; cronograma do contrato alimenta a agenda, sem calendário paralelo.
- **§38.13 Offline:** fila `lib/offline/outbox` (lease + owner + retry + idempotência) reaproveitada; no máximo um novo *domínio* na mesma fila.

---

## 9. Riscos de regressão (§37.M)

1. **Convenção text×uuid:** `contracts.id`/`clients.id` são `text`. Qualquer FK nova deve respeitar (o código já erra fácil aqui). 
2. **RLS do técnico:** técnico só enxerga o próprio atendimento/alocação; dados de contrato/comercial vêm por RPC `SECURITY DEFINER` (como `get_os_mission`) — manter esse padrão, não afrouxar RLS.
3. **Imutabilidade:** não sobrescrever relatório fechado nem histórico de ativo — respeitar triggers/guards existentes.
4. **Export estático (Hostinger):** nada de rota server-side nova sem checar `next.config.ts` (output export).
5. **Idempotência offline:** todo write de campo precisa de `client_uuid`/dedupe como os domínios atuais.

---

## 10. Divisão sugerida em etapas pequenas (§37.N)

- **M0 — Aprovação da arquitetura + migrations candidatas (este documento).**
- **M1 — Contexto de Manutenção (leitura):** aba/contexto Contrato→Ciclo→Atendimento reusando `fieldStateContext`; navegação contextual (§26). Sem schema.
- **M2 — Plano de Manutenção (admin):** áreas + rotinas + binding de template + periodicidade (depende de M0/migrations).
- **M3 — Template SDAI completo (§12):** `TemplateSchema` publicado; central + integridade + medições (laços dinâmicos da Base). Sem schema.
- **M4 — Execução mobile (§15):** próximo ativo, ações grandes, progressive disclosure, autosave, "continuar depois", regra do checklist da central por central (§13).
- **M5 — Cobertura (§19):** derivada de Base + verificações + policy.
- **M6 — Relatório consolidado + fechar imutável (§21–§23).**
- **M7 — Cliente 360 Manutenção (§24).**

---

## 11. Decisões que precisam da sua aprovação (§38.15)

1. **Ciclo = `contract_routine_executions`** (reusar), em vez de tabela nova. ✅ recomendado.
2. **Criar `asset_maintenance_policies`** (0106) para periodicidade configurável — **única tabela nova** proposta.
3. **`ALTER contract_routines ADD template_codigo`** e **`ALTER reports ADD snapshot jsonb`** (+ revisão R00/R01) — confirmar antes de eu escrever a migration.
4. **Nova entrada de aba `manutencao`** no `TabPath`/RBAC, ou aninhar dentro de `contratos`?
5. **Relatório consolidado = `reports` tipo `PREVENTIVA`** (reusar tabela) — confirmar.

**PARE — aguardando aprovação da arquitetura antes de qualquer implementação, migration ou alteração de schema.**
