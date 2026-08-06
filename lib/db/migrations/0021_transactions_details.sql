-- Campos adicionais dos lançamentos financeiros (Receitas/Despesas):
-- categoria, vencimento, forma de pagamento, documento/NF, centro de custo
-- e vínculos com a base (cliente, contrato, OS). Aditivo e idempotente.
-- Requer 0019_transactions.sql.

alter table public.transactions add column if not exists category       text;
alter table public.transactions add column if not exists due_date       text;
alter table public.transactions add column if not exists payment_method text;
alter table public.transactions add column if not exists document_ref   text;
alter table public.transactions add column if not exists cost_center    text;
alter table public.transactions add column if not exists client_id      text;
alter table public.transactions add column if not exists contract_id    text;
alter table public.transactions add column if not exists os_id          text;

create index if not exists transactions_client_idx on public.transactions (client_id);
create index if not exists transactions_contract_idx on public.transactions (contract_id);
