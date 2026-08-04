-- Orçamentos de serviço (CustomQuote). Requer 0004/0005. Idempotente.

create table if not exists public.custom_quotes (
  id                text primary key,
  client_name       text,
  description       text,
  labor_value       numeric default 0,
  material_value    numeric default 0,
  total_value       numeric default 0,
  discount_applied  numeric default 0,
  final_value       numeric default 0,
  validity_days     integer default 15,
  status            text default 'ENVIADO',
  created_at        timestamptz not null default now()
);

create index if not exists custom_quotes_status_idx on public.custom_quotes (status);

alter table public.custom_quotes enable row level security;

grant select, insert, update, delete on public.custom_quotes to authenticated;

drop policy if exists "quotes select" on public.custom_quotes;
create policy "quotes select"
  on public.custom_quotes for select
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'));

drop policy if exists "quotes insert" on public.custom_quotes;
create policy "quotes insert"
  on public.custom_quotes for insert
  to authenticated
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'));

drop policy if exists "quotes update" on public.custom_quotes;
create policy "quotes update"
  on public.custom_quotes for update
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'));

drop policy if exists "quotes delete" on public.custom_quotes;
create policy "quotes delete"
  on public.custom_quotes for delete
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));
