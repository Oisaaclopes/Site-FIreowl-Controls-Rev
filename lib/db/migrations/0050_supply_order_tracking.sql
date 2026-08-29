-- Acompanhamento operacional de compra e recebimento dos pedidos de fornecimento.
alter table public.supply_orders add column if not exists supplier text;
alter table public.supply_orders add column if not exists purchase_date text;
alter table public.supply_orders add column if not exists received_at text;
