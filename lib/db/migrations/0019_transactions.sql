-- Lançamentos financeiros (Receitas/Despesas). Requer 0004/0005. Idempotente.

create table if not exists public.transactions (
  id               text primary key,
  type             text not null check (type in ('RECEITA', 'DESPESA')),
  client_or_vendor text,
  description      text,
  tx_date          text,
  status           text default 'PENDENTE',
  amount           numeric default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists transactions_type_idx on public.transactions (type);

alter table public.transactions enable row level security;

grant select, insert, update, delete on public.transactions to authenticated;

-- Financeiro é sensível: apenas ADMINISTRATIVO e FINANCEIRO
drop policy if exists "transactions select" on public.transactions;
create policy "transactions select"
  on public.transactions for select
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'FINANCEIRO'));

drop policy if exists "transactions insert" on public.transactions;
create policy "transactions insert"
  on public.transactions for insert
  to authenticated
  with check (public.auth_role() in ('ADMINISTRATIVO', 'FINANCEIRO'));

drop policy if exists "transactions update" on public.transactions;
create policy "transactions update"
  on public.transactions for update
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'FINANCEIRO'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'FINANCEIRO'));

drop policy if exists "transactions delete" on public.transactions;
create policy "transactions delete"
  on public.transactions for delete
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'FINANCEIRO'));
