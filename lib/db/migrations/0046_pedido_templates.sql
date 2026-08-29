-- Modelos reutilizáveis de proposta, gerais ou vinculados a um cliente.
-- O conteúdo fica em JSONB para evoluir junto ao formulário comercial.
create table if not exists public.pedido_templates (
  id text primary key,
  name text not null,
  client_id text references public.clients(id) on delete set null,
  template jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pedido_templates_client_idx on public.pedido_templates(client_id);

alter table public.pedido_templates enable row level security;
grant select, insert, update, delete on public.pedido_templates to authenticated;

drop policy if exists "pedido templates select" on public.pedido_templates;
create policy "pedido templates select" on public.pedido_templates for select to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'));

drop policy if exists "pedido templates write" on public.pedido_templates;
create policy "pedido templates write" on public.pedido_templates for all to authenticated
  using (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'))
  with check (public.auth_role() in ('ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO'));
