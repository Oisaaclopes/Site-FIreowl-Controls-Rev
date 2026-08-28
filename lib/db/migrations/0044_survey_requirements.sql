-- Necessidades técnicas de levantamento: não são consumo, reserva ou movimento de estoque.
create table if not exists public.report_required_materials (
  id uuid primary key default gen_random_uuid(), report_id uuid not null references public.reports(id) on delete cascade,
  catalog_item_id text, descricao text not null, marca text, modelo text, quantidade numeric not null default 1, unidade text not null default 'un', observacao text,
  source_type text not null default 'general', source_reference text, source_label text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.report_required_services (
  id uuid primary key default gen_random_uuid(), report_id uuid not null references public.reports(id) on delete cascade,
  service_id text, descricao text not null, quantidade numeric not null default 1, unidade text not null default 'un', observacao text,
  source_type text not null default 'general', source_reference text, source_label text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.report_measurements (
  id uuid primary key default gen_random_uuid(), report_id uuid not null references public.reports(id) on delete cascade,
  categoria text not null, descricao text not null, quantidade numeric not null, unidade text not null, local text, observacao text, catalog_item_id text, incluir_no_pedido boolean not null default false,
  source_type text, source_reference text, source_label text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.report_order_links (
  id uuid primary key default gen_random_uuid(), report_id uuid not null references public.reports(id) on delete cascade, pedido_id text not null references public.pedidos(id) on delete cascade, created_at timestamptz not null default now(), unique(report_id, pedido_id)
);
create index if not exists report_required_materials_report_idx on public.report_required_materials(report_id);
create index if not exists report_required_services_report_idx on public.report_required_services(report_id);
create index if not exists report_measurements_report_idx on public.report_measurements(report_id);
create index if not exists report_order_links_report_idx on public.report_order_links(report_id);

alter table public.report_required_materials enable row level security;
alter table public.report_required_services enable row level security;
alter table public.report_measurements enable row level security;
alter table public.report_order_links enable row level security;
grant select, insert, update, delete on public.report_required_materials, public.report_required_services, public.report_measurements, public.report_order_links to authenticated;
drop policy if exists "survey materials access" on public.report_required_materials;
drop policy if exists "survey services access" on public.report_required_services;
drop policy if exists "survey measurements access" on public.report_measurements;
drop policy if exists "survey links access" on public.report_order_links;
create policy "survey materials access" on public.report_required_materials for all to authenticated using (public.owns_report(report_id)) with check (public.owns_report(report_id));
create policy "survey services access" on public.report_required_services for all to authenticated using (public.owns_report(report_id)) with check (public.owns_report(report_id));
create policy "survey measurements access" on public.report_measurements for all to authenticated using (public.owns_report(report_id)) with check (public.owns_report(report_id));
create policy "survey links access" on public.report_order_links for all to authenticated using (public.owns_report(report_id)) with check (public.owns_report(report_id));
