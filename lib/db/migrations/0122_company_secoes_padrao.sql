-- 0122_company_secoes_padrao
-- Padrão de seções do documento POR TIPO DE PEDIDO, definido pela empresa
-- ("Salvar como novo padrão do Orçamento"). Mapa { pedidoTipo: [chaves] } com
-- as chaves de lib/documentoSecoes. Tipo ausente = padrão do sistema.
-- Todo pedido NOVO daquele tipo nasce com essa seleção (gravada no próprio
-- pedido); pedidos existentes não mudam.
--
-- Quem grava: as policies de UPDATE de company_profile (0037) já restringem a
-- ADMINISTRATIVO/GESTOR. Todos os perfis leem.
--
-- Aditiva, idempotente. Requer 0037. 0119/0120 reservadas (catálogo), 0121 usada.

alter table public.company_profile
  add column if not exists secoes_padrao jsonb not null default '{}'::jsonb;
