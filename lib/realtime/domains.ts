export const REALTIME_DOMAINS = {
  point: ['time_punches', 'punch_adjustments', 'day_entries'],
  employees: ['profiles', 'time_punches'],
  orders: ['pedidos'],
  serviceOrders: ['ordens_servico'],
  agenda: ['ordens_servico', 'contract_routine_executions'],
  reports: ['reports', 'report_answers', 'report_media', 'report_signatures'],
  pending: ['pendencias'],
  fieldPhotos: ['field_photos', 'field_photo_sessions', 'field_photo_comparisons'],
  inventory: ['inventory_items', 'stock_movements', 'supply_orders', 'supply_purchases', 'supply_purchase_items', 'supply_receipts', 'supply_receipt_items'],
  contracts: ['contracts', 'contract_routines', 'contract_routine_executions', 'contract_hour_ledger'],
  finance: ['transactions'],
  dashboard: ['time_punches', 'punch_adjustments', 'profiles', 'pedidos', 'ordens_servico', 'reports', 'pendencias', 'contracts', 'transactions'],
} as const;

export type RealtimeDomain = keyof typeof REALTIME_DOMAINS;

export const REALTIME_TABLES = [...new Set(Object.values(REALTIME_DOMAINS).flat())];

export function domainsForTable(table: string): RealtimeDomain[] {
  return (Object.entries(REALTIME_DOMAINS) as [RealtimeDomain, readonly string[]][])
    .filter(([, tables]) => tables.includes(table))
    .map(([domain]) => domain);
}
