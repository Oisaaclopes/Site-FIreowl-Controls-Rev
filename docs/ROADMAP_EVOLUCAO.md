# Roteiro de evolução pendente

Registro atualizado em 29/08/2026. Itens concluídos não entram nesta lista.

## Entregue nesta etapa

- QR de autenticidade para relatório, proposta, orçamento, ordem de serviço e contrato.
- Modelos favoritos gerais e por cliente: salvar, aplicar, renomear e excluir, persistidos no Supabase pela migration 0046.
- Indicadores comerciais de conversão, perdas, propostas próximas do vencimento e volume.
- Fluxo operacional base: levantamento → proposta → OS de campo → relatório → correção de pendência.
- Ficha consolidada do cliente com contratos, propostas, OS, relatórios, pendências, receitas e linha do tempo única.
- Revisões de proposta com motivo, responsável e alterações comerciais relevantes registradas no PDF.
- Indicadores comerciais de conversão, perdas, validade e tempo médio estimado até aceite.
- Conversão guiada de proposta aceita em OS e, quando recorrente, em contrato com vínculo de origem.

## Pendências reais

1. Decidir a política de emissão offline: hoje o documento é emitido mesmo se o registro público de QR não puder ser publicado.
2. Adicionar notas e eventos de comunicação à linha do tempo do cliente.
3. Completar a conversão por tipo comercial com criação de pedido de fornecimento quando o escopo não for de execução nem recorrente.
4. Ampliar a comparação de revisões para textos extensos e exibir uma comparação lado a lado na interface.
5. Implementar notificações proativas de vencimento (além dos alertas visuais já presentes na aba de propostas).
6. Aplicar as migrations 0046, 0047 e 0048 e validar os fluxos ponta a ponta com dados reais em desktop e celular, especialmente permissões/RLS e o catálogo técnico após o seed.

## Princípio de segurança

Nenhum fluxo deve apagar o histórico técnico/comercial. Exclusões de cliente e
catálogo devem continuar condicionadas à ausência de vínculos ou usar
arquivamento quando houver histórico.
