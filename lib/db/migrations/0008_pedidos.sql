-- Propostas comerciais / orçamentos (Pedidos). Guarda os DADOS da proposta
-- (não o PDF, que é gerado na hora). Requer 0004/0005 (auth_role). Idempotente.

create table if not exists public.pedidos (
  id                          text primary key,
  numero_pedido               text,
  referencia                  text,
  cliente_id                  text,
  cliente_nome                text,
  fornecedor                  text,
  data_emissao                text,
  responsavel_comercial_id    text,
  responsavel_comercial_nome  text,
  status                      text,
  valor_total                 numeric default 0,
  proposal                    jsonb,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists pedidos_status_idx on public.pedidos (status);
create index if not exists pedidos_cliente_idx on public.pedidos (cliente_nome);

alter table public.pedidos enable row level security;

grant select, insert, update, delete on public.pedidos to authenticated;

-- Acesso: ADMINISTRATIVO, GESTOR e FINANCEIRO (comercial/faturamento). Técnico não.
drop policy if exists "pedidos select" on public.pedidos;
create policy "pedidos select"
  on public.pedidos for select
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'));

drop policy if exists "pedidos insert" on public.pedidos;
create policy "pedidos insert"
  on public.pedidos for insert
  to authenticated
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'));

drop policy if exists "pedidos update" on public.pedidos;
create policy "pedidos update"
  on public.pedidos for update
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'));

drop policy if exists "pedidos delete" on public.pedidos;
create policy "pedidos delete"
  on public.pedidos for delete
  to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR'));
