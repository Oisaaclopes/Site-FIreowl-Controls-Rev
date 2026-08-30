# QA — Fireowl Guardian

Data da auditoria: 2026-08-29  
Escopo: estabilização das Etapas 1–6, sem criação de módulos novos.

## 1. Resumo executivo

Foi feita uma auditoria estática do código, migrations, rotas e fluxos integrados. Não foi possível confirmar o estado do banco remoto, executar RPCs autenticadas, validar RLS por perfil, nem realizar a validação visual assistida em navegador/mobile neste ambiente. Portanto, a etapa está **tecnicamente verificada em código, mas depende de QA E2E no Supabase e em dispositivos reais para encerramento**.

Correção aplicada nesta auditoria: em ambiente com Supabase configurado, uma falha ao carregar o estoque não substitui mais os dados reais por `INITIAL_INVENTORY`; a tela passa a exibir estado vazio real.

## 2. Ambiente testado

- Repositório/branch: `main`.
- Último ponto anterior: `bccfbc1` (Etapa 6).
- Aplicação: Next.js 15, TypeScript, Supabase.
- Não há acesso administrativo ao projeto Supabase nesta execução.

## 3. Migrations necessárias / checklist de aplicação

As migrations abaixo existem no repositório e precisam estar aplicadas **na ordem** para o E2E dos fluxos auditados:

| Migration | Dependências e finalidade | Situação remota |
|---|---|---|
| `0033_ordens_servico.sql` | tabela `ordens_servico`, RLS e trigger `set_updated_at` | confirmar no Supabase |
| `0044_survey_requirements.sql` | necessidades e link levantamento→pedido | confirmar no Supabase |
| `0048_contract_source_pedido.sql` | origem de contrato no pedido | confirmar no Supabase |
| `0056_contracts_structured.sql` | contratos, rotinas, competências, anexos; requer 0020/0022/0029/0032/0033/0048 | confirmar no Supabase |
| `0057_contract_execution_to_os.sql` | RPC `generate_os_from_execution` e trigger de status; requer 0033/0056 | confirmar no Supabase |
| `0058_suppliers_structured.sql` | campos de fornecedor e `supplier_products`; FK `inventory_item_id uuid` | confirmar no Supabase |

Observações de banco:

- 0056 e 0058 são aditivas e idempotentes em tabelas/colunas/índices. 0056 depende de `public.set_updated_at`, que 0033 cria quando ausente.
- A FK corrigida de 0058 usa `supplier_products.inventory_item_id uuid`, compatível com `inventory_items.id`.
- As policies de 0056 e 0058 dependem de `public.auth_role()`. É obrigatório validar a existência e o resultado correto dessa função para cada perfil.
- 0057 usa `SELECT ... FOR UPDATE` na competência, portanto protege duplo clique para a **mesma** execução. Há risco de colisão na geração do número de OS para **competências distintas em paralelo** (P1 abaixo), pois o número é calculado por `max(...) + 1` sem serialização global/índice único visível nesta migration.

## 4. Fluxos auditados

| Fluxo | Resultado de código | Observação |
|---|---|---|
| Levantamento → Pedido | Parcial | Agrupa materiais, medições e serviços; preserva quantidade necessária e não baixa estoque. Há risco concorrente P1. |
| Pedido → proposta → PDF | Parcial | Dados materializados/fallback histórico existem; paginação visual e PDFs extensos exigem E2E manual. |
| Pedido/proposta → contrato | Parcial | Origem estruturada e contratos/rotinas existem. Upload de anexos requer teste real de storage/RLS. |
| Contrato → rotina → competência → OS | Parcial | RPC idempotente por competência; validar E2E e concorrência entre competências. |
| Agenda | Parcial | Consome OS/competências reais segundo a implementação da Etapa 4; validar calendários e empty states no navegador. |
| Relatório → pendência → pedido/OS | Parcial | Links e modelos existem; exige teste com dados reais, fotos e estados de pendência. |
| Catálogo × estoque | Verificado estaticamente | Estados conceituais e `normalizeSearch` existem; validar com dados reais. |
| Fornecedor × produto | Verificado estaticamente | Custo/prazo ficam na relação `supplier_products`; não atualizam `inventory_items`. |

## 5. P0 encontrados

Nenhum P0 conhecido na auditoria estática.

## 6. P1 encontrados

1. **P1-A — Conversão concorrente de levantamento em pedido. Status: FIXED (aguarda E2E).** A migration 0059 adiciona o vínculo `initial_conversion` e a RPC `get_or_create_order_from_survey`, serializada por levantamento. A composição continua no app; o banco cria/devolve somente a conversão inicial. Pedidos adicionais continuam possíveis como vínculos `manual` explícitos.
2. **P1-B — Numeração concorrente de OS. Status: FIXED (aguarda E2E).** A migration 0059 adiciona lock transacional anual antes de calcular `OS-AAAA-NNNN` e tenta criar índice único parcial de número. Se houver duplicata histórica, ela não altera nem apaga dados: emite aviso e deixa o índice pendente para saneamento manual.
3. **Dados de demonstração ainda são fallback intencional quando Supabase não está configurado.** `lib/mockData.ts` permanece para modo local/demonstração. Com Supabase configurado, o fallback do estoque para mock foi removido nesta QA. Antes de produção, ambiente sem configuração deve exibir aviso explícito de modo demonstração ou ser bloqueado.

## 7. P2 encontrados

1. **DevicesManager. Status: FIXED (aguarda E2E).** Comparação de marcas passou a usar `normalizeSearch`, como Estoque e Pedido. A busca de modelos do levantamento já deriva do catálogo no RelatóriosView.
2. **Anexos contratuais. Status: FIXED (aguarda E2E).** O painel de contrato agora envia para `report-media/contracts/{contractId}`, registra o metadado, abre por URL assinada e remove metadado+arquivo. Upload/Storage/RLS precisam de validação autenticada.
3. **Técnico responsável na OS:** a estrutura de `ordens_servico` não mostra vínculo técnico dedicado nesta migration. Classificação P2 enquanto a operação consegue criar/executar OS, porém Agenda não tem atribuição individual estruturada.
4. **Testes automatizados insuficientes para fluxos críticos:** existe apenas `lib/proposta.leak.test.ts` (5 testes). Não há testes automatizados para conversão levantamento→pedido, RPC de competência→OS, RLS, PDFs ou offline.
5. **Mobile/PDF/offline/RLS:** não puderam ser validados visualmente ou contra Supabase neste ambiente; seguem como checklist obrigatório abaixo.

## 8. P3 encontrados

- Ocorrências de `placeholder` em formulários são placeholders legítimos.
- `app/page.tsx` contém comentário de overlay de bounding box; classificar como ferramenta visual, não dado operacional.
- Componentes históricos não roteados não foram removidos sem um grafo completo de dependências.

## 9. Correções realizadas nesta QA

- `components/CrmApp.tsx`: removido o uso de estoque fictício após erro de carregamento quando Supabase está configurado. Falha remota agora preserva um empty state verdadeiro.
- `0059_qa_conversion_and_os_concurrency.sql`: operação atômica de conversão inicial e serialização da numeração de OS.
- `lib/surveyOrderConversion.ts`: conversão passou a usar a RPC de banco em vez de criar Pedido e vínculo em chamadas separadas.
- `scripts/qa-concurrency-integration-test.mjs`: teste real, opcional e com limpeza, dos cenários simultâneos de levantamento e competência.
- `ContractDetailPanel`: upload, listagem, abertura e remoção de anexos de contrato ligados ao bucket privado existente.
- `ItensCardEditor`: materiais vinculados exibem Necessário, Disponível e Diferença sem alterar a quantidade do Pedido.

## 10. Mocks e dados fictícios

- `lib/mockData.ts`: contém seeds/fixtures locais, incluindo Logística Integrada e Carlos Silva. São exibidos somente quando Supabase não está configurado em vários módulos; não são aceitáveis como dados de produção.
- `INITIAL_PEDIDOS_OS` está vazio, conforme remoção anterior de OS fictícia.
- Seeds de marcas/serviços precisam ser tratados como catálogo inicial, não como operações reais. A primeira carga de marcas persiste o seed de forma idempotente quando o banco está vazio.
- Nenhum dashboard deve usar esses dados com Supabase configurado; a correção de estoque reforça essa regra.

## 11. Testes desktop e mobile a executar manualmente

Desktop e 375/390/412 px:

- Criar levantamento FSP-951=3, cabo=85 m, eletroduto=32 m; gerar pedido e confirmar as três quantidades sem redução por saldo.
- Repetir “Gerar pedido” e confirmar abertura do pedido existente; executar também com duas sessões para expor o P1 concorrente.
- Criar proposta, editar texto, gerar PDF, duplicar, criar revisão e conferir conteúdo histórico.
- Criar contrato, rotina, competência e clicar duas vezes em Gerar OS; confirmar a mesma OS. Repetir com duas competências simultâneas.
- Validar Agenda sem duplicar competência que já possua `ordem_servico_id`.
- Validar atendimento corretivo completo, fotos, assinatura, pendência e fechamento rastreável.
- Validar fornecedor A/B para FSP-951 com custos diferentes e confirmar que `inventory_items.cost_price`, saldo e preço de venda não mudam.
- Validar modais/drawers, tabela de pedido, fotos, assinatura e ações fixas sem overflow/teclado encobrindo campos.

## 12. Offline / sync

O motor de sync permanece no código; o indicador visual foi removido. Não foi possível desligar/religar a rede no ambiente de auditoria. Testar criação/edição de atendimento, fotos e pendências offline; depois reconectar e confirmar idempotência, conflitos e ausência de duplicação.

## 12.1 Evidências E2E desta continuação

| Item | Status | Evidência / bloqueio |
|---|---|---|
| Migration 0059 | APPLIED (informado pelo operador) | Aplicação confirmada pelo usuário; não há acesso de banco nesta sessão para consultar histórico. |
| Teste de concorrência | BLOCKED | `SUPABASE_SERVICE_ROLE_KEY` não está presente no ambiente local. Executar o script de QA no PowerShell com a chave somente no ambiente local. |
| Duplicatas históricas de OS | BLOCKED | Requer consulta autenticada ao Supabase. A migration não altera duplicatas existentes. |
| RLS/RPC/Storage | BLOCKED | Requer sessões reais dos perfis e credenciais de ambiente. |
| Mobile/PDF/offline | BLOCKED | Requer navegador/dispositivo e dados reais; não foi inferido como PASS. |

## 12.2 Pré-flight E2E — 2026-08-29

| Item | Status | Evidência / próximo passo |
|---|---|---|
| URL e chave anônima do Supabase | CONFIGURED localmente | Existem no `.env.local`; valores não foram exibidos. |
| `SUPABASE_SERVICE_ROLE_KEY` | MISSING localmente | O script `qa-concurrency-integration-test.mjs` não foi executado para não criar registros QA sem credencial/ambiente confirmado. |
| Ambiente seguro (staging vs. produção) | BLOCKED | Não foi possível confirmar o tipo do projeto somente pela configuração local. Não criar dados artificiais até confirmação humana. |
| Sessão de usuário para RLS/mobile/PDF/offline | BLOCKED | O navegador integrado alcançou a tela de login, mas não há sessão de funcionário autorizada para teste. |
| Duplicatas históricas de OS | BLOCKED | Requer consulta autenticada. Não houve leitura/escrita direta no banco. |

## 12.3 Atribuição de técnico à OS — auditoria estática

**P2 — OPEN.** `ordens_servico` não possui coluna estruturada de `technician_id`, `executor_id` ou equivalente na migration 0033. O técnico aparece em relatórios (`reports.tecnico_id`/`tecnico_nome`) e valores de responsável podem ser derivados em fluxos de Pedido, mas a Agenda/OS não consegue determinar de modo estruturado quem executará uma OS. Impacto: a OS segue operável, porém não permite filtro, restrição ou escala individual confiável. Próxima etapa recomendada: modelagem aditiva de atribuição de executores, sem inventar equipes ou localização.

## 13. RLS e permissões

Executar no Supabase autenticado, por Administrador, Gestor, Comercial, Técnico e Financeiro:

- `suppliers`, `supplier_products`, `contracts`, tabelas `contract_*`, `ordens_servico`, `reports` e `inventory_items`;
- upload/leitura no bucket `report-media` (incluindo `contracts/` e logos);
- RPCs `ensure_routine_execution` e `generate_os_from_execution`;
- confirmar que Técnico possui apenas as permissões necessárias e não pode criar/excluir OS administrativa.

## 14. Qualidade de código

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | aprovado |
| `npm test` | aprovado — 1 arquivo, 5 testes |
| `npm run lint` | aprovado |
| `npm run build` | aprovado antes desta alteração mínima; reexecutar no fechamento da etapa |

## 15. Checklist para produção

- [ ] Confirmar migrations 0033, 0044, 0048, 0056, 0057, 0058 e 0059 em `supabase_migrations`.
- [ ] Aplicar a migration 0059 antes de executar qualquer fluxo concorrente de conversão/OS.
- [ ] Rodar `node scripts/qa-concurrency-integration-test.mjs` com service role; registrar PASS, FAIL ou BLOCKED.
- [ ] Executar E2E desktop/mobile, PDF, offline e RLS deste documento.
- [ ] Confirmar bucket/policies de `report-media` para logos, relatórios e anexos de contrato.
- [ ] Validar dados reais após migração e garantir que modo demonstração não seja usado em produção.
- [ ] Executar typecheck, testes, lint e build finais.

## 16. Conclusão

Não há P0 conhecido em análise estática. A Etapa 7 **não deve ser encerrada como QA E2E completo** até a confirmação das migrations no Supabase, execução dos testes autenticados e decisão/correção dos dois P1 de concorrência.
