import { getSupabaseClient } from './supabaseClient';
import { Device } from './types';

const TABLE = 'devices';

function rowToDevice(r: any): Device {
  return {
    id: String(r.id),
    clienteId: r.cliente_id || '',
    sistema: (r.sistema || 'SDAI') as Device['sistema'],
    central: r.central ?? undefined,
    laco: r.laco ?? undefined,
    endereco: r.endereco ?? undefined,
    tipoDispositivo: r.tipo_dispositivo ?? undefined,
    fabricante: r.fabricante ?? undefined,
    modelo: r.modelo ?? undefined,
    localizacao: r.localizacao ?? undefined,
    pavimento: r.pavimento ?? undefined,
    dataInstalacao: r.data_instalacao ?? undefined,
    status: (r.status || 'ativo') as Device['status'],
    ultimaManutencao: r.ultima_manutencao ?? undefined,
    ultimoTesteFuncional: r.ultimo_teste_funcional ?? undefined,
    cicloAmostragemId: r.ciclo_amostragem_id ?? undefined,
    itemCatalogoId: r.item_catalogo_id ?? undefined,
  };
}

function deviceToRow(d: Device): Record<string, unknown> {
  const row: Record<string, unknown> = {
    cliente_id: d.clienteId,
    sistema: d.sistema,
    central: d.central ?? null,
    laco: d.laco ?? null,
    endereco: d.endereco ?? null,
    tipo_dispositivo: d.tipoDispositivo ?? null,
    fabricante: d.fabricante ?? null,
    modelo: d.modelo ?? null,
    localizacao: d.localizacao ?? null,
    pavimento: d.pavimento ?? null,
    data_instalacao: d.dataInstalacao ?? null,
    status: d.status,
    ultima_manutencao: d.ultimaManutencao ?? null,
    ultimo_teste_funcional: d.ultimoTesteFuncional ?? null,
    ciclo_amostragem_id: d.cicloAmostragemId ?? null,
    item_catalogo_id: d.itemCatalogoId ?? null,
    updated_at: new Date().toISOString(),
  };
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

/**
 * Registra o teste funcional de um lote de dispositivos (amostragem da
 * preventiva): grava ultimo_teste_funcional e, opcionalmente, vincula ao ciclo.
 */
export async function marcarTesteFuncional(
  deviceIds: string[],
  dataISO: string,
  cicloAmostragemId?: string
): Promise<void> {
  const ids = deviceIds.filter(Boolean);
  if (ids.length === 0) return;
  const supabase = getSupabaseClient() as any;
  const patch: Record<string, unknown> = {
    ultimo_teste_funcional: dataISO,
    updated_at: new Date().toISOString(),
  };
  if (cicloAmostragemId) patch.ciclo_amostragem_id = cicloAmostragemId;
  const { error } = await supabase.from(TABLE).update(patch).in('id', ids);
  if (error) throw error;
}
