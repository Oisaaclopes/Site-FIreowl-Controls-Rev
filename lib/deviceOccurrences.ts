import { getSupabaseClient } from './supabaseClient';
import type { Device, DeviceOccurrence, DeviceOccurrenceType, OperationalStatus } from './types';

const TABLE = 'device_occurrences';

export interface OccurrenceDraft {
  occurrenceType: DeviceOccurrenceType;
  deviceId?: string;
  loop?: string;
  address?: string;
  identification?: string;
  manufacturer?: string;
  model?: string;
  location?: string;
  notes?: string;
}

const text = (v: unknown) => String(v ?? '').trim() || undefined;

/** Extrai as três anormalidades estruturadas do checklist sem inventar ativo. */
export function extractSdaiOccurrenceDrafts(values: Record<string, unknown>): OccurrenceDraft[] {
  const out: OccurrenceDraft[] = [];
  const addCards = (gate: string, key: string, occurrenceType: DeviceOccurrenceType) => {
    if (values[gate] !== 'Sim') return;
    const cards = Array.isArray(values[key]) ? values[key] as Record<string, unknown>[] : [];
    for (const c of cards) {
      const loop = text(c.laco), address = text(c.endereco), deviceId = text(c.device_id);
      if (!deviceId && !loop && !address && !text(c.descricao) && !text(c.observacao)) continue;
      out.push({ occurrenceType, deviceId, loop, address,
        identification: text(c.codigo) || text(c.dispositivo_perfil), manufacturer: text(c.fabricante), model: text(c.modelo),
        location: text(c.local), notes: text(c.descricao) || text(c.observacao) });
    }
  };
  addCards('falha_ativa', 'falhas', 'FAULT');
  addCards('alarme_ativo', 'alarmes', 'ALARM');
  addCards('dispositivos_desabilitados', 'desabilitados', 'DISABLED');
  return out;
}

export const OCCURRENCE_LABEL: Record<DeviceOccurrenceType, string> = {
  FAULT: 'Em falha', DISABLED: 'Desabilitado', ALARM: 'Em alarme',
};

/** Prioridade visual quando há mais de uma ocorrência aberta no mesmo ativo. */
export function operationalStatusForDevice(deviceId: string, occurrences: DeviceOccurrence[]): OperationalStatus {
  const types = new Set(occurrences.filter((o) => o.status === 'OPEN' && o.deviceId === deviceId).map((o) => o.occurrenceType));
  if (types.has('ALARM')) return 'ALARM';
  if (types.has('DISABLED')) return 'DISABLED';
  if (types.has('FAULT')) return 'FAULT';
  return 'NORMAL';
}

export function operationalCounts(devices: Device[], occurrences: DeviceOccurrence[]) {
  const active = devices.filter((d) => d.status === 'ativo' && !d.removedAt);
  const counts = { total: active.length, NORMAL: 0, FAULT: 0, DISABLED: 0, ALARM: 0 };
  for (const d of active) counts[operationalStatusForDevice(d.id, occurrences)]++;
  return counts;
}

export function filterByOperationalStatus(devices: Device[], occurrences: DeviceOccurrence[], status: OperationalStatus | 'ALL') {
  return status === 'ALL' ? devices : devices.filter((d) => operationalStatusForDevice(d.id, occurrences) === status);
}

function rowToOccurrence(r: any): DeviceOccurrence {
  return { id: r.id, dedupeKey: r.dedupe_key, clienteId: r.cliente_id ?? undefined,
    deviceId: r.device_id ?? undefined, occurrenceType: r.occurrence_type, status: r.status,
    observedAt: r.observed_at, resolvedAt: r.resolved_at ?? undefined, resolvedBy: r.resolved_by ?? undefined, sourceType: r.source_type,
    reportId: r.report_id ?? undefined, workOrderId: r.work_order_id ?? undefined,
    serviceAttendanceId: r.service_attendance_id ?? undefined, pendenciaId: r.pendencia_id ?? undefined,
    loopSnapshot: r.loop_snapshot ?? undefined, addressSnapshot: r.address_snapshot ?? undefined,
    identificationSnapshot: r.identification_snapshot ?? undefined,
    manufacturerSnapshot: r.manufacturer_snapshot ?? undefined, modelSnapshot: r.model_snapshot ?? undefined,
    locationSnapshot: r.location_snapshot ?? undefined, notes: r.notes ?? undefined,
    createdAt: r.created_at, updatedAt: r.updated_at };
}

function occurrenceToRow(o: DeviceOccurrence) {
  return { id: o.id, dedupe_key: o.dedupeKey, cliente_id: o.clienteId ?? null,
    device_id: o.deviceId ?? null, occurrence_type: o.occurrenceType, status: o.status,
    observed_at: o.observedAt, resolved_at: o.resolvedAt ?? null, source_type: o.sourceType,
    report_id: o.reportId ?? null, work_order_id: o.workOrderId ?? null,
    service_attendance_id: o.serviceAttendanceId ?? null, pendencia_id: o.pendenciaId ?? null,
    loop_snapshot: o.loopSnapshot ?? null, address_snapshot: o.addressSnapshot ?? null,
    identification_snapshot: o.identificationSnapshot ?? null,
    manufacturer_snapshot: o.manufacturerSnapshot ?? null, model_snapshot: o.modelSnapshot ?? null,
    location_snapshot: o.locationSnapshot ?? null, notes: o.notes ?? null };
}

export async function upsertDeviceOccurrence(o: DeviceOccurrence): Promise<DeviceOccurrence> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).upsert(occurrenceToRow(o), { onConflict: 'dedupe_key' }).select().single();
  if (error) throw error;
  return rowToOccurrence(data);
}

export async function fetchDeviceOccurrences(filter: { clienteId?: string; deviceId?: string; status?: 'OPEN' | 'RESOLVED' } = {}): Promise<DeviceOccurrence[]> {
  const supabase = getSupabaseClient() as any;
  let q = supabase.from(TABLE).select('*').order('observed_at', { ascending: false });
  if (filter.clienteId) q = q.eq('cliente_id', filter.clienteId);
  if (filter.deviceId) q = q.eq('device_id', filter.deviceId);
  if (filter.status) q = q.eq('status', filter.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(rowToOccurrence);
}

export async function resolveDeviceOccurrence(id: string, resolvedAt = new Date().toISOString(), resolvedBy?: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(TABLE).update({ status: 'RESOLVED', resolved_at: resolvedAt, resolved_by: resolvedBy ?? null }).eq('id', id);
  if (error) throw error;
}

export async function resolveOccurrencesByPendenciaId(pendenciaId: string, resolvedAt = new Date().toISOString(), resolvedBy?: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(TABLE).update({ status: 'RESOLVED', resolved_at: resolvedAt, resolved_by: resolvedBy ?? null })
    .eq('pendencia_id', pendenciaId).eq('status', 'OPEN');
  if (error) throw error;
}
