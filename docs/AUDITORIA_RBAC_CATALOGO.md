# Auditoria de acesso técnico — 14/09/2026

## Banco: alteração proposta, ainda não executada

Projeto conferido: Site Fireowl Controls (`kalfwikvgxogzbsemgbk`).

O commit anterior `a01ca55` já contém a migration 0110 e a substituição de
`fetchInventory` por `fetchTechnicalCatalog` no painel da preventiva SDAI.
Na retomada, a view em produção já estava com `security_invoker=false`.
Essas alterações preexistentes não foram criadas nesta retomada.

A causa original era a combinação de `technical_catalog` em modo invoker com a
policy `inventory role select`, que permite apenas ADMINISTRATIVO/GESTOR.
O técnico recebia lista vazia, que `fetchTechnicalCatalog` também usa como
fallback de erro. Não era um seletor desabilitado por role.

Consulta real em transação somente leitura, usando `authenticated` e o contexto
de um perfil TECNICO existente: 273 itens técnicos, 11 fabricantes, 267 modelos
preenchidos e **zero linhas do estoque financeiro**. Não foram lidos valores
financeiros nem realizados logins, gravações operacionais ou mudanças de policy.

Entretanto, os privilégios atuais da view ainda incluem INSERT/UPDATE/DELETE
para `authenticated` e para `anon`, além de SELECT para `anon`. A view simples
é atualizável e executa com os privilégios do proprietário. Portanto, não é
seguro considerar que essa superfície é somente leitura. O teste estático da
0110 não detecta os privilégios efetivos de produção.

Mudança mínima proposta, **pendente de autorização explícita**:

```sql
begin;
revoke all privileges on table public.technical_catalog from public, anon, authenticated;
grant select on table public.technical_catalog to authenticated;
commit;
```

Isso mantém os mesmos 20 campos de identificação, sem abrir `inventory_items`,
sem mudar sua RLS, sem criar outra view/fonte de catálogo e sem modificar
clientes, contratos, workflow, fotos ou dados. A administração continua
escrevendo no catálogo pela tabela protegida, como já ocorre.

Como a 0110 já existe no repositório e o modo da view já mudou no banco, não
será editada ou reaplicada automaticamente. Após aprovação, a correção de
privilégios deve ser registrada em uma nova migration (numeração seguinte
a confirmar), seguida de nova consulta com técnico, ADM e anônimo.

Teste pós-alteração esperado: técnico e ADM recebem o mesmo conjunto técnico;
técnico continua sem linhas financeiras; anon não tem SELECT; anon e
authenticated não têm INSERT/UPDATE/DELETE na view. Nenhum teste exige gravar
ou excluir um equipamento real.

## Retomada 14/09/2026 — conclusão da auditoria de CÓDIGO

Causa residual no cliente: `RelatoriosView` ainda montava fabricante/modelo/
família/dispositivos a partir do **estoque** (`inventory` prop, alimentado por
`fetchInventory`, bloqueado por RLS para o técnico → seletores vazios), e o
`FormEngine` oferecia "cadastrar" catálogo a qualquer perfil.

Correções concluídas nesta retomada (código; nenhuma migration nova):

- `RelatoriosView` agora carrega `fetchTechnicalCatalog()` num estado próprio
  (`technicalItems`) e alimenta `marcaOptions`, `catalog` (buildBaseReportCatalog),
  `formCatalog` (marcas/modelosPorMarca/modelosPorGrupo/detalhesModelo/categorias)
  e `dispositivosPadrao` a partir do catálogo técnico — não mais do estoque.
- `lib/technicalCatalogSelection.ts` retipado de `InventoryItem` → `TechnicalCatalogItem`.
- `lib/technicalCatalog.ts`: `fetchTechnicalCatalog` passa a pedir uma lista
  EXPLÍCITA de colunas (`TECHNICAL_CATALOG_COLUMNS`, 20 campos de identificação),
  em vez de `select('*')`. Defesa extra: mesmo que a view fosse alargada, o
  cliente só requisita campos price-free.
- `lib/rbac.ts`: `canManageCatalog(role)` = ADMINISTRATIVO/GESTOR. Em
  `RelatoriosView`, criar/editar/remover marca e produto fica atrás desse guard.
- `FormEngine.tsx`: o rótulo "cadastrar novo" só aparece quando há
  `onCreateCatalogo` (técnico não recebe callback → não vê a ação). Removido o
  filtro "Em estoque" e o badge de saldo do seletor de dispositivos (o catálogo
  técnico é identificação, não estoque — `quantidade` virou opcional).

Fluxos verificados usando o catálogo técnico (não o estoque): Preventiva SDAI
(`SdaiMaintenancePanel`), Relatórios/OS/Atendimento/Levantamento (`RelatoriosView`
→ `ReportForm`/`FormEngine`), Base Técnica (`ClientTechnicalBase`,
`BaseUpdateStep`), Evidência/Before×After (`AttendanceEvidence`),
Fotos de Campo (`QuickFieldPhotoModal`). `buildBaseReportCatalog` lê apenas
campos de identificação. A conversão comercial survey→Pedido
(`surveyOrderConversion` via `fetchInventory`) fica atrás de `canManage`
(admin/gestor) e não é seletor de identificação do técnico — mantida.
`DevicesManager` (mostra fornecedor/saldo) é código morto (sem render) — não é
alcançado por técnico.

Validação: `tsc --noEmit` limpo; ESLint 0 erros; 1221 testes passando.

Pendência de banco (migration 0111) permanece **pendente de autorização** —
ver SQL acima. Não reconfirmada live nesta retomada (sem `DATABASE_URL` direto
no working tree); o achado vem da consulta somente-leitura da sessão anterior.

## Endurecimento aprovado — migration 0111 criada (14/09/2026)

Isaac aprovou o endurecimento. Criado `lib/db/migrations/0111_technical_catalog_lockdown.sql`
(revoke all de public/anon/authenticated + grant select só a authenticated;
não altera a definição da view nem `inventory_items`; idempotente).

**Aplicação/validação do BANCO é MANUAL** (deploy é estático; não há
`DATABASE_URL`/CLI no working tree, e o service_role via PostgREST não executa
DDL nem lê `information_schema`). O arquivo 0111 traz, comentadas, as queries de
validação (grants efetivos, leitura do técnico, escrita negada) para rodar no
SQL editor após o commit.

**Checagem live possível desta máquina (somente leitura, chave anon):**
`GET /rest/v1/technical_catalog` com a chave **anon** retornou **HTTP 401
`42501 permission denied for view technical_catalog`**. Ou seja, no estado
ATUAL de produção o `anon` **NÃO** tem SELECT na view (o `revoke ... from anon`
da 0110 está valendo) — o resíduo "anon SELECT" da auditoria anterior não está
mais presente. O privilégio de **escrita de `authenticated`** (INSERT/UPDATE/
DELETE) **não pôde ser reconfirmado daqui** (exige sessão autenticada/técnico;
service_role burla RLS; PostgREST não expõe grants). A 0111 é idempotente e
garante o estado-alvo (só SELECT p/ authenticated) independentemente do resíduo;
a query (1) do arquivo confirma isso de forma definitiva no SQL editor.
