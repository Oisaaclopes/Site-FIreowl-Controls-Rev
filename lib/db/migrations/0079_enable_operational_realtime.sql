-- Publica somente dados operacionais com benefício de atualização imediata.
-- RLS continua sendo aplicada pelo Supabase Realtime; esta migration não cria
-- nem flexibiliza políticas. Idempotente para ambientes parcialmente ativados.
do $$
declare
  table_name text;
  realtime_tables text[] := array[
    'time_punches', 'punch_adjustments', 'day_entries', 'profiles',
    'pedidos', 'ordens_servico', 'reports', 'report_answers', 'report_media',
    'report_signatures', 'pendencias', 'field_photos', 'field_photo_sessions',
    'field_photo_comparisons', 'inventory_items', 'stock_movements',
    'supply_orders', 'supply_purchases', 'supply_purchase_items',
    'supply_receipts', 'supply_receipt_items', 'contract_routines',
    'contract_routine_executions', 'contract_hour_ledger', 'contracts',
    'transactions'
  ];
begin
  foreach table_name in array realtime_tables loop
    if to_regclass(format('public.%I', table_name)) is not null
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = table_name
       ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
