# Auditoria — Levantamento Técnico → Pedido

## O que já existe e será reutilizado

- `ReportForm` e `FormEngine`: execução de templates por área, campos
  condicionais, repeaters, fotos, assinaturas e validação centralizada.
- Templates de levantamento: SDAI, CFTV, Controle de Acesso, BMS e Alarme.
- `report_answers`: fonte histórica das respostas por campo; `report_media` e
  `report_signatures` preservam evidências associadas ao relatório.
- `InventoryItem`: catálogo/estoque com código, marca, modelo, unidade, saldo e
  preços. Levantamento consulta esse catálogo, mas não deve consumir saldo.
- `ServiceCatalogItem`: catálogo de serviços com categoria, valor padrão e
  horas estimadas.
- `Pedido.proposal.equipmentItems`: aceita materiais e serviços no mesmo pedido
  por `tipo`, quantidade, unidade, marca/modelo e vínculo ao estoque/serviço.
- `persistReportBundle`: fluxo offline-first idempotente que grava relatório,
  respostas, mídias, assinaturas e pendências.

## Lacunas identificadas

1. O levantamento atual tem dados em respostas genéricas; não há uma estrutura
   consultável para materiais necessários, serviços necessários, medições e sua
   origem técnica.
2. Não existe vínculo persistente entre `reports` e `pedidos`.
3. Não há conversor que agrupe necessidades confirmadas em itens de pedido sem
   misturar necessidade de orçamento com consumo de estoque.
4. O template SDAI atual precisa de blocos novos opcionais para sistema
   existente, falhas verificadas e medições.

## Decisão de implementação

`report_answers` continuará sendo a fonte do documento/PDF. Uma tabela auxiliar
versionada registrará as necessidades estruturadas do levantamento e seus links
de origem. Isso permite agrupamento e rastreabilidade ao criar o pedido sem
alterar relatórios antigos ou duplicar regras do FormEngine.

## Migrations previstas

- `survey_requirements`: necessidades de material, serviço e medição por
  relatório, com `source_detail` e quantidade/unidade.
- `survey_order_links`: relação única entre levantamento e pedido, evitando
  criação acidental de pedido duplicado.
