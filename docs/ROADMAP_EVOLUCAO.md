# Roteiro de evolução pendente

Registro atualizado em 29/08/2026. Itens concluídos não entram nesta lista.

## Entregue nesta etapa

- QR de autenticidade para relatório, proposta, orçamento e ordem de serviço.
- Modelos favoritos gerais e por cliente: salvar, aplicar, renomear e excluir, persistidos no Supabase pela migration 0046.
- Indicadores comerciais de conversão, perdas, propostas próximas do vencimento e volume.
- Fluxo operacional base: levantamento → proposta → OS de campo → relatório → correção de pendência.
- Ficha consolidada do cliente com contratos, propostas, OS, relatórios, pendências, receitas e linha do tempo única.

## Pendências reais

1. Estender QR de autenticidade para contratos e impedir emissão quando o registro público não puder ser publicado (hoje a geração continua disponível offline).
2. Adicionar notas e eventos de comunicação à linha do tempo do cliente.
3. Fazer conversão guiada de proposta aprovada para pedido, OS ou contrato conforme o tipo comercial, com confirmação de dados antes de criar os documentos.
4. Comparar revisões por campo, registrar o autor e exibir diferenças entre versões.
5. Completar indicadores com tempo até aprovação e alertas automatizados de vencimento.
6. Aplicar a migration 0046 e validar os fluxos ponta a ponta com dados reais em desktop e celular, especialmente permissões/RLS e o catálogo técnico após o seed.

## Princípio de segurança

Nenhum fluxo deve apagar o histórico técnico/comercial. Exclusões de cliente e
catálogo devem continuar condicionadas à ausência de vínculos ou usar
arquivamento quando houver histórico.
