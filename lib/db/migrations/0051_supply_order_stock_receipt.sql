-- Marca a única entrada de estoque gerada pelo recebimento de um pedido de fornecimento.
alter table public.supply_orders add column if not exists stock_received_at timestamptz;
