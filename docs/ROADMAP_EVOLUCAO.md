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
- Conversão de proposta aceita não recorrente em pedido interno de fornecimento com itens, valores e vínculo de origem.
- Aba de fornecimento com acompanhamento de fornecedor, cotação, compra e recebimento.

## Pendências reais

1. Decidir a política de emissão offline: hoje o documento é emitido mesmo se o registro público de QR não puder ser publicado.
2. Adicionar notas e eventos de comunicação à linha do tempo do cliente.
3. Integrar o recebimento do pedido de fornecimento ao estoque para atualizar quantidades após conferência.
4. Validar a comparação lado a lado de revisões com textos extensos e histórico de múltiplas versões.
5. Validar as notificações proativas de vencimento no uso real.
6. Aplicar as migrations 0049 e 0050 e validar os fluxos ponta a ponta com dados reais em desktop e celular, especialmente permissões/RLS e o catálogo técnico após o seed.

## Princípio de segurança

Nenhum fluxo deve apagar o histórico técnico/comercial. Exclusões de cliente e
catálogo devem continuar condicionadas à ausência de vínculos ou usar
arquivamento quando houver histórico.
