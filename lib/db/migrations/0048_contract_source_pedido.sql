-- Rastreabilidade da conversão de proposta recorrente em contrato.
alter table public.contracts add column if not exists source_pedido_id text references public.pedidos(id) on delete set null;
create unique index if not exists contracts_source_pedido_unique on public.contracts(source_pedido_id) where source_pedido_id is not null;
