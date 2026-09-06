# Desenho técnico — Migration 0106 + ALTERs (Manutenção Contratual)

> **Somente desenho. Nada foi aplicado, nenhuma migration criada, nenhum código alterado.** Entrega A–G solicitada. Próximo número real: **0106**. Convenção do repo: PKs legadas (`clients.id`, `contracts.id`) são `text`; entidades internas são `uuid`; migrations aditivas/idempotentes revisadas no SQL Editor.

## Sumário das decisões conceituais aplicadas neste desenho
- Ciclo consolidado = **derivado** por contrato + **intervalo de datas** (não por string de competência — ver limitação crítica em **D**). Sem `maintenance_cycles`.
- `asset_maintenance_policies` = **multidisciplinar**, resolução por especificidade (**A**).
- `contract_routines.template_codigo` aponta o template vigente; a versão executada continua sendo congelada no `reports.template_snapshot` (**B**).
- Snapshot documental **reutiliza** a imutabilidade já existente (RLS + trigger 0075); só faltam campos de dados agregados e revisão (**C**).
- Tipo do relatório consolidado: **não** forçar PREVENTIVA — apresento 3 alternativas (**C.4**).

---

## A. `asset_maintenance_policies` (nova — 0106)

### A.1 Objetivo
Periodicidade de teste/manutenção **configurável e multidisciplinar**, sem estrutura específica de SDAI e sem duplicar regra. Uma linha = uma política num determinado **nível de escopo**; a política efetiva de um ativo é resolvida por **especificidade (mais específico vence)**.

### A.2 Colunas

| coluna | tipo | null | descrição |
|---|---|---|---|
| `id` | `uuid` PK default `gen_random_uuid()` | not null | |
| `nivel` | `text` | not null | `'PADRAO' \| 'CONTRATO' \| 'ATIVO'` (CHECK). Define o teto de especificidade e valida os seletores. |
| `area` | `text` | null | `SDAI/CFTV/CONTROLE_ACESSO/BMS/ALARME` (CHECK quando não-nulo). Seletor. |
| `grupo` | `text` | null | família/taxonomia (`devices.grupo`). Seletor. |
| `tipo_ativo` | `text` | null | tipo canônico (`devices.tipo_ativo`). Seletor. |
| `contract_id` | `text` → `contracts(id)` `on delete cascade` | null | obrigatório quando `nivel='CONTRATO'`. |
| `cliente_id` | `text` → `clients(id)` `on delete cascade` | null | opcional (política por cliente sem contrato específico). |
| `device_id` | `uuid` → `devices(id)` `on delete cascade` | null | obrigatório quando `nivel='ATIVO'`. |
| `periodicidade_meses` | `numeric` | not null | passo em meses (`>0`). Cobre mensal(1)…anual(12) e trimestral(3). |
| `obrigatorio_no_ciclo` | `boolean` default `false` | not null | ex.: central/baterias/laços = obrigatório todo ciclo. |
| `janela_tolerancia_dias` | `integer` | null | folga p/ "vencido" (opcional). |
| `ativa` | `boolean` default `true` | not null | soft-disable sem apagar histórico. |
| `observacao` | `text` | null | |
| `created_by` | `uuid` default `auth.uid()` | null | |
| `created_at` / `updated_at` | `timestamptz` default `now()` | not null | trigger `set_updated_at` (reuso). |

### A.3 Constraints
- `check (nivel in ('PADRAO','CONTRATO','ATIVO'))`
- `check (periodicidade_meses > 0)`
- `check (area is null or area in ('SDAI','CFTV','CONTROLE_ACESSO','BMS','ALARME'))`
- **Coerência de seletores por nível:**
  - `check (nivel <> 'ATIVO' or device_id is not null)`
  - `check (nivel <> 'CONTRATO' or contract_id is not null)`
  - `check (nivel <> 'PADRAO' or (contract_id is null and device_id is null))` — PADRAO é Fireowl (por área/grupo/tipo), nunca amarrado a contrato/ativo.
- **Antiduplicação no mesmo nível/seleção** (partial unique, só ativas):
  - `unique (device_id) where nivel='ATIVO' and ativa` — um ativo tem no máx. 1 política própria.
  - `unique (contract_id, coalesce(area,''), coalesce(grupo,''), coalesce(tipo_ativo,'')) where nivel='CONTRATO' and ativa`
  - `unique (coalesce(area,''), coalesce(grupo,''), coalesce(tipo_ativo,'')) where nivel='PADRAO' and ativa`

### A.4 Índices
- `(contract_id) where contract_id is not null`
- `(device_id) where device_id is not null`
- `(area, tipo_ativo)` — resolução por padrão Fireowl
- `(cliente_id) where cliente_id is not null`

### A.5 RLS (espelha o padrão da Base Técnica)
- `grant select,insert,update,delete ... to authenticated`
- **select:** `auth_role() in ('ADMINISTRATIVO','GESTOR','TECNICO')` — técnico precisa da periodicidade em campo ("último teste / próxima previsão").
- **insert/update/delete:** `auth_role() in ('ADMINISTRATIVO','GESTOR')` — configuração é administrativa (§28). Sem `USING(true)`, sem service role.

### A.6 Precedência / "effective policy" (sem duplicar regra)
Resolução **pura e determinística** (recomendo `lib/maintenancePolicies.ts`, testável, cacheável offline — nada de I/O), recebendo o ativo + contexto de contrato e a lista de políticas aplicáveis:

Entrada: `device { area, grupo, tipo_ativo, cliente_id, id }`, `contractId`, `policies[]` (só `ativa=true`).

1. Filtra políticas que **casam** com o ativo/contexto (todo seletor não-nulo da política precisa bater; seletor nulo = curinga):
   - `device_id` = `device.id` (se preenchido)
   - `contract_id` = `contractId` (se preenchido)
   - `cliente_id` = `device.cliente_id` (se preenchido)
   - `area`/`grupo`/`tipo_ativo` = os do ativo (se preenchidos)
2. Pontua cada política casada por **especificidade** (mais específico vence):

   | condição | peso |
   |---|---|
   | `nivel='ATIVO'` (device_id) | 1000 |
   | `nivel='CONTRATO'` + `tipo_ativo` | 800 |
   | `nivel='CONTRATO'` + `grupo` | 700 |
   | `nivel='CONTRATO'` (só contrato) | 600 |
   | `nivel='PADRAO'` + `area`+`tipo_ativo` | 400 |
   | `nivel='PADRAO'` + `area`+`grupo` | 300 |
   | `nivel='PADRAO'` + `area` | 200 |
   | `nivel='PADRAO'` global | 100 |

3. Vence o maior peso; empate → `updated_at` mais recente. Se nenhuma casar → **sem política** (UI mostra "periodicidade não definida", nunca inventa norma — §14).

> Resolução em TS (não em SQL) porque a periodicidade é consumida **offline** no fluxo do técnico e junto de dados já carregados (Base + verificações). Uma view/RPC SQL opcional pode espelhar isso para relatórios no servidor, mas a fonte única da regra é a função pura.

### A.7 Exemplos (multidisciplinar)
| linha | nivel | area | tipo_ativo | contract_id | device_id | periodicidade_meses |
|---|---|---|---|---|---|---|
| Fireowl: detector de fumaça | PADRAO | SDAI | Detector de fumaça | — | — | 12 |
| Fireowl: acionador manual | PADRAO | SDAI | Acionador manual | — | — | 3 |
| Fireowl: sirene | PADRAO | SDAI | Sirene | — | — | 3 |
| Fireowl: central SDAI | PADRAO | SDAI | Central | — | — | 1 (obrigatorio_no_ciclo=true) |
| Fireowl: câmera | PADRAO | CFTV | Câmera | — | — | 6 |
| Fireowl: controladora acesso | PADRAO | CONTROLE_ACESSO | Controladora | — | — | 6 |
| Fireowl: ponto BMS | PADRAO | BMS | Ponto/Equipamento | — | — | 12 |
| Contrato X: acionador | CONTRATO | SDAI | Acionador manual | `CT-2026-X` | — | 3 |
| Ativo específico | ATIVO | — | — | — | `<uuid>` | 4 |

*(Nota §14: essas periodicidades são regras configuráveis de manutenção, não obrigação normativa — o seed inicial entra como dados, não como migration.)*

---

## B. `contract_routines.template_codigo` (ALTER)

### B.1 Campo proposto
`alter table public.contract_routines add column if not exists template_codigo text;`
- **Nullable**, **sem FK** para `report_templates(codigo)` — mesma convenção de `catalog_item_id` ("sem FK: pode ser manual/legado") e para não travar rename/seed de template. Integridade validada na aplicação (o `codigo` já é `unique` em `report_templates`).

### B.2 Relação com template/versão
- A rotina aponta o **código** do template vigente da área (ex.: `PREVENTIVA_SDAI`).
- No momento em que um atendimento gera/preenche um relatório, o motor **congela a versão vigente** em `reports.template_snapshot` + `template_version` (mecanismo 0075 já existente). 

### B.3 Comportamento histórico (auditado — sem versionamento paralelo)
- `report_templates` guarda **a versão vigente** por código (`versao`, `schema_hash`).
- Cada relatório carrega seu **snapshot imutável** (trigger `reports_freeze_template_snapshot`: uma vez gravado, nunca muda; reenvio idêntico é no-op).
- `resolveReportTemplate()` já resolve: snapshot → fallback vigente (legado) → unknown.
- **Conclusão:** alterar o template futuramente **não** reinterpreta atendimento concluído. `template_codigo` na rotina apenas escolhe **qual** template usar; o **como estava** continua no snapshot. Nada de estrutura de versão nova.

---

## C. `reports` — versionamento existente vs. faltante

### C.1 O que JÁ existe
- **Imutabilidade do fechado:** RLS `reports update` exige `status <> 'finalizado'` → relatório finalizado não muda. `delete` idem + RPC `delete_report_if_unused` (só sem vínculos).
- **Snapshot da definição:** `template_snapshot` + `template_version` imutáveis (0075).
- **Sumário:** `resumo_execucao jsonb` (contadores) e `data_fim` (= `finalizadoEm`).
- **Status:** `rascunho → em_execucao → aguardando_assinatura → finalizado → cancelado`.

### C.2 O que FALTA (para o consolidado do §22/§23)
O relatório consolidado agrega dados que vivem em **tabelas mutáveis** (atendimentos, `devices`, `device_verifications`, `pendencias`, fotos). Finalizar o relatório **não** congela esses dados hoje — só a definição do template. Portanto falta:
1. **Snapshot de dados agregados** do documento no fechamento.
2. **Revisão documental** (R00/R01).
3. **Carimbo de fechamento** dedicado (hoje reaproveitável de `data_fim`).

> **Reuso vs. redundância:** `resumo_execucao` é semanticamente "contadores" e já é lido pelo PDF; **não** recomendo sobrecarregá-lo (risco de regressão). O snapshot documental completo pede campo próprio.

### C.3 Proposta de campos (ALTER `reports`)
```
add column snapshot            jsonb          -- documento consolidado congelado (§22)
add column revisao             text default 'R00'
add column fechado_em          timestamptz    -- carimbo de fechamento (ou reusar data_fim)
add column supersedes_report_id uuid references public.reports(id) on delete set null
```
- **Imutabilidade do snapshot:** estender o trigger `reports_freeze_template_snapshot` (mesma técnica) para congelar `snapshot`/`revisao`/`fechado_em` quando já preenchidos — **não criar mecanismo novo**.
- **Conteúdo do `snapshot`** (quando aplicável, tudo por referência a IDs + valores congelados, **sem duplicar a lista de ativos como base paralela** — congela o *estado observado no fechamento*): cliente/unidade, contrato, competência/período, sistemas, atendimentos (id+técnico+data+resultado), técnicos, ativos relevantes (id + nome/endereço **no momento**), status das centrais/equipamentos, medições, testes (verificações do período), cobertura, alterações de ativos (antes/depois), pendências (abertas/anteriores/resolvidas), corretivas, fotos selecionadas (paths), conclusão, assinatura (refs), `fechado_em`, `revisao`.

### C.4 Revisão R00/R01 — duas estratégias (decisão)
- **(b) Recomendada — nova linha supersede (imutabilidade estrita):** correção emite **novo `reports`** com `revisao='R01'` e `supersedes_report_id` apontando o R00. O R00 permanece intacto (nunca muda retroativamente — §23). Auditoria perfeita; custa 1 coluna (`supersedes_report_id`).
- **(a) Reabrir+rebump:** RPC admin reabre, incrementa `revisao`, re-congela snapshot novo. Menos linhas, porém mexe no fechado — contraria "fechado nunca muda". **Não recomendo.**

### C.5 Tipo do relatório consolidado (item 6 — NÃO forçar PREVENTIVA)
Enum atual: `LEVANTAMENTO/CORRETIVA/PREVENTIVA`. O consolidado agrega preventiva + corretivas + pendências → **não é** PREVENTIVA. Alternativas:

| opção | o que muda | prós | contras |
|---|---|---|---|
| **(A) recomendada** — novo tipo `MANUTENCAO` | `ALTER` do CHECK em `reports.tipo` e `report_templates.tipo` (drop+recreate do constraint; dados atuais só usam CORRETIVA/PREVENTIVA, então o recreate é seguro) | honra §6; consolidado tem identidade; `template_snapshot` fica NULL (é gerado, não FormEngine) e `snapshot` carrega os dados | mexe em CHECK (revisar) |
| (B) reusar `PREVENTIVA` | nada no schema | zero migration | semanticamente errado (o user vetou) |
| (C) documento derivado fora de `reports` | nova entidade | separação | vira "relatório paralelo" — contraria §2 |

**Arquitetura de duas camadas (importante):**
- **Camada 1 — relatório por atendimento/sistema:** o checklist SDAI (§12) roda no **FormEngine** (persiste em `report_answers`, exige 1 `reports` por atendimento/sistema, ex.: `PREVENTIVA_SDAI`). Já existe fluxo PREVENTIVA (central + próximo dispositivo + cobertura via `ciclos_amostragem`).
- **Camada 2 — consolidado do período (tipo `MANUTENCAO`):** **gerado** agregando as camadas 1 do período; não duplica ativos; congela `snapshot` ao fechar.

> **Limitação a decidir:** a camada 1 usa FormEngine→`report_answers`, que hoje **não** tem vínculo formal a `service_attendances`. Se adotarmos "1 relatório por atendimento", provavelmente precisaremos de `reports.service_attendance_id` (ALTER extra). Alternativa: persistir o checklist como evidências/verificações do atendimento (sem `reports` por atendimento) e o FormEngine só na camada 2. **Isso precisa da sua decisão** (impacta se há ALTER adicional em `reports`).

---

## D. Ciclo — exemplo real e **limitação crítica**

### D.1 Exemplo (competência) — como você definiu
```
Contrato CT-2026-X · período Setembro/2026
  rotina SDAI    → execution A (contract_routine_executions)
  rotina CFTV    → execution B
  rotina Alarme  → execution C
Relatório consolidado (MANUTENCAO) agrega A + B + C.
```
Cada `contract_routine_execution` → 1 OS (`generate_os_from_execution`, idempotente) → N `service_attendances` → N `device_verifications`/evidências/fotos/pendências.

### D.2 ⚠️ Limitação crítica descoberta na auditoria — **agregar por `competencia` (string) NÃO funciona entre frequências diferentes**
`lib/contractRoutines.competenciaDe()` gera rótulos **por passo da rotina**:
- mensal → `2026-09`
- trimestral → `2026-Q3`
- anual → `2026`

Logo, para "Setembro/2026", SDAI mensal = `2026-09`, CFTV trimestral = `2026-Q3`, anual = `2026`. **As strings não são iguais** → `where competencia = '2026-09'` perderia CFTV/anual. Agregar por igualdade de string de competência **quebra** em contrato multi-frequência.

**Solução (sem entidade nova):** o ciclo consolidado é derivado por **`contract_id` + intervalo de datas** `[periodo_inicio, periodo_fim]`, reunindo `contract_routine_executions` cujo `data_programada` (ou a data do atendimento) **cai no intervalo** — independentemente do rótulo de competência. Ou seja: chave real do consolidado = **(contrato, janela de datas)**, não a string.

### D.3 Quando isso obrigaria uma entidade nova (gatilho do seu §1)
Manteria-se **derivado** enquanto (contrato + janela de datas) resolver tudo com segurança. **Pararei e apresentarei** antes de criar `maintenance_cycles` se surgir:
- necessidade de **identidade/nome global** do ciclo (ex.: "Ciclo 2026-Q3 fechado") persistida e referenciável por FK;
- **status global** do ciclo além do derivado das execuções;
- **fechamento único** que precise travar o conjunto (hoje o fechamento vive no `reports` consolidado, que já resolve);
- execuções com `data_programada` **NULL** que impeçam a derivação por data;
- caso 1 rotina precise de **múltiplas OS** na mesma competência (hoje `execution.ordem_servico_id` é único → 1 execução ↔ 1 OS).

### D.4 Outras limitações menores
- Executões com `data_programada` nula não entram no intervalo (mitigável usando a data do atendimento).
- Janela do consolidado precisa ser explícita (derivada do plano/rotina), pois "mês" não é universal.

---

## E. Cardinalidades finais

```
clients 1───N contracts
contracts 1───N contract_routines            (1 por área/frequência)
contract_routines 1───N contract_routine_executions   (UNIQUE(routine, competencia))
contract_routine_executions 1───0..1 ordens_servico   (idempotente)
ordens_servico 1───N service_attendances               (§33: nunca 1:1)
service_attendances 1───N service_attendance_evidence_items
service_attendances 1───N field_photos
service_attendances 1───N device_verifications
devices 1───N device_verifications                      (histórico do ativo)
devices 0..1 parent_device_id (self)  ·  devices 0..1 replaced_by_device_id (self)
pendencias N───(atravessa)──N competências/ciclos       (lifecycle próprio; origem/execução por FK a reports)
pendencias 1───N field_photos
asset_maintenance_policies N───(resolve)──1 device      (efetiva por especificidade; não FK rígido)
contract_routines N───1 report_templates (por codigo, soft)
reports (MANUTENCAO) 1───(agrega)──N reports (camada 1) / attendances do período
reports 0..1 supersedes_report_id (self, R00→R01)
consolidado := (contract_id, [periodo_inicio, periodo_fim])   -- derivado, sem tabela
```

---

## F. Impacto em RLS / Offline

**RLS**
- `asset_maintenance_policies`: nova policy (select ADMIN/GESTOR/TECNICO; write ADMIN/GESTOR). Sem impacto em tabelas existentes.
- `contract_routines.template_codigo`: herda a RLS da tabela (ADMIN/GESTOR/FINANCEIRO) — sem mudança.
- `reports.snapshot/revisao/fechado_em/supersedes_report_id`: herdam a RLS de `reports` (finalizado imutável). A extensão do trigger de congelamento **reforça** a imutabilidade, não afrouxa.
- Técnico continua **sem** acesso comercial; dados de contrato para o app do técnico seguem via RPC `SECURITY DEFINER` (padrão `get_os_mission`).

**Offline (fila única existente — §27)**
- Políticas de manutenção: **leitura/cache** offline (periodicidade no campo). Escrita é administrativa (desktop, online) → **não** precisa de domínio de outbox novo.
- Verificações/evidências/fotos do atendimento já usam domínios `REPORT`/`FIELD_PHOTO*`/`TECH_ASSET`/`ASSET_LIFECYCLE`. Se a camada-1 do checklist gerar writes offline próprios, reusar `REPORT`/`TECH_ASSET` (avaliar `MAINTENANCE_TEST` **na mesma fila** só se houver payload distinto — decidir na implementação, não agora).
- `snapshot` do consolidado é gerado no **fechamento** (ação online, desktop/gestão) → sem impacto na fila.

---

## G. Rollback da futura migration 0106

Aditiva e reversível sem perda de dados operacionais:
```
-- políticas (nova tabela): drop total é seguro (config, não histórico operacional)
drop table if exists public.asset_maintenance_policies;

-- contract_routines
alter table public.contract_routines drop column if exists template_codigo;

-- reports (só se os ALTERs forem aplicados)
alter table public.reports drop column if exists supersedes_report_id;
alter table public.reports drop column if exists fechado_em;
alter table public.reports drop column if exists revisao;
alter table public.reports drop column if exists snapshot;
-- reverter o trigger à versão 0075 (recreate sem congelar snapshot/revisao)

-- tipo MANUTENCAO (só se adicionado; recria CHECK sem o valor)
-- PRÉ-CHECK obrigatório: não pode haver linhas usando o valor a remover.
--   reports:          delete/none where tipo='MANUTENCAO'  (ou abortar)
--   report_templates: idem
alter table public.reports drop constraint reports_tipo_check;
alter table public.reports add constraint reports_tipo_check
  check (tipo in ('LEVANTAMENTO','CORRETIVA','PREVENTIVA'));
alter table public.report_templates drop constraint report_templates_tipo_check;
alter table public.report_templates add constraint report_templates_tipo_check
  check (tipo in ('LEVANTAMENTO','CORRETIVA','PREVENTIVA'));
```
- **Storage:** nenhum objeto tocado (config e colunas). 
- **Idempotência:** todo `add column if not exists`; drops com `if exists`.

---

## Decisões que preciso de você antes de escrever a 0106
1. **`asset_maintenance_policies`** com resolução por especificidade (A) — aprova este desenho exato?
2. **Revisão documental:** estratégia **(b) nova linha supersede** (recomendada) ou (a) reabrir?
3. **Tipo consolidado:** **(A) novo `MANUTENCAO`** (recomendado) confirmado, ou reusar PREVENTIVA/derivado?
4. **Camada-1 do checklist:** relatório por atendimento (implica `reports.service_attendance_id`) **ou** persistir via verificações/evidências do atendimento (sem `reports` por atendimento)? — define se há ALTER extra.
5. **Ciclo derivado por (contrato + janela de datas)** em vez de string de competência (D.2) — de acordo?

**PARADO após o desenho. Não crio a migration 0106, não implemento o template SDAI, não altero código até você aprovar.**
