-- Campos adicionais dos contratos: vínculo ao cliente da base, data de
-- início, tipo/escopo do contrato e dia de vencimento da mensalidade.
-- Aditivo e idempotente. Requer 0020_contracts.sql.

alter table public.contracts add column if not exists client_id     text;
alter table public.contracts add column if not exists start_date    text;
alter table public.contracts add column if not exists contract_type text;
alter table public.contracts add column if not exists payment_day   integer;

create index if not exists contracts_client_idx on public.contracts (client_id);
