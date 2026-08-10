import { getSupabaseClient } from './supabaseClient';
import { Device } from './types';

const TABLE = 'devices';

function rowToDevice(r: any): Device {
  return {
    id: String(r.id),
    clienteId: r.cliente_id || '',
    grupo: r.grupo ?? undefined,
    tipo: r.tipo ?? undefined,
    fabricante: r.fabricante ?? undefined,
    modelo: r.modelo ?? undefined,
    enderecoCentral: r.endereco_central ?? undefined,
    local: r.local ?? undefined,
    serial: r.serial ?? undefined,
    itemCatalogoId: r.item_catalogo_id ?? undefined,
    status: (r.status || 'OPERACIONAL') as Device['status'],
  };
}

function deviceToRow(d: Device): Record<string, unknown> {
  const row: Record<string, unknown> = {
    cliente_id: d.clienteId,
    grupo: d.grupo ?? null,
    tipo: d.tipo ?? null,
    fabricante: d.fabricante ?? null,
    modelo: d.modelo ?? null,
    endereco_central: d.enderecoCentral ?? null,
    local: d.local ?? null,
    serial: d.serial ?? null,
    item_catalogo_id: d.itemCatalogoId ?? null,
    status: d.status,
    updated_at: new Date().toISOString(),
  };
  // Só envia id em updates (insert deixa o banco gerar o uuid).
  if (d.id) row.id = d.id;
  return row;
}

export async function fetchDevices(clienteId?: string): Promise<Device[]> {
  const supabase = getSupabaseClient() as any;
  let query = supabase.from(TABLE).select('*').order('created_at', { ascending: false });
  if (clienteId) query = query.eq('cliente_id', clienteId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(rowToDevice);
}

export async function upsertDevice(d: Device): Promise<Device> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).upsert(deviceToRow(d), { onConflict: 'id' }).select().single();
  if (error) throw error;
  return rowToDevice(data);
}

export async function deleteDevice(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
