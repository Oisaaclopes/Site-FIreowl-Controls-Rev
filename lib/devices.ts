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
    grupo: r.grupo ?? undefined,
    tipoAtivo: r.tipo_ativo ?? undefined,
    parentDeviceId: r.parent_device_id ?? undefined,
    technicalIdentifier: r.technical_identifier ?? undefined,
    technicalAttributes: (r.technical_attributes && typeof r.technical_attributes === 'object') ? r.technical_attributes : undefined,
    condicao: r.condicao ?? undefined,
    serial: r.serial ?? undefined,
    source: r.source ?? undefined,
    sourceSurveyId: r.source_survey_id ?? undefined,
    replacedByDeviceId: r.replaced_by_device_id ?? undefined,
    removedAt: r.removed_at ?? undefined,
    lastVerifiedAt: r.last_verified_at ?? undefined,
    createdBy: r.created_by ?? undefined,
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
  // Campos 3D só são enviados quando presentes (compat. com bancos sem a 0094).
  if (d.grupo !== undefined) row.grupo = d.grupo || null;
  if (d.tipoAtivo !== undefined) row.tipo_ativo = d.tipoAtivo || null;
  if (d.parentDeviceId !== undefined) row.parent_device_id = d.parentDeviceId || null;
  if (d.technicalIdentifier !== undefined) row.technical_identifier = d.technicalIdentifier || null;
  if (d.technicalAttributes !== undefined) row.technical_attributes = d.technicalAttributes || {};
  if (d.condicao !== undefined) row.condicao = d.condicao || null;
  if (d.serial !== undefined) row.serial = d.serial || null;
  if (d.source !== undefined) row.source = d.source || null;
  if (d.sourceSurveyId !== undefined) row.source_survey_id = d.sourceSurveyId || null;
  if (d.replacedByDeviceId !== undefined) row.replaced_by_device_id = d.replacedByDeviceId || null;
  if (d.removedAt !== undefined) row.removed_at = d.removedAt || null;
  if (d.lastVerifiedAt !== undefined) row.last_verified_at = d.lastVerifiedAt || null;
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
