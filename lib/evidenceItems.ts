import { getSupabaseClient } from './supabaseClient';
import { EvidenceItemCategory, ServiceAttendanceEvidenceItem } from './types';
import { FieldPhoto, FieldPhotoMoment } from './fieldPhotos';

/* ===================================================================
 * ETAPA 3B.4 — Item de Evidência (service_attendance_evidence_items, 0088).
 * A unidade principal da evidência: um equipamento/infra/cabeamento/central com
 * N fotos por momento. As fotos continuam em field_photos (evidence_item_id).
 * =================================================================== */

const TABLE = 'service_attendance_evidence_items';

export const EVIDENCE_CATEGORY_LABEL: Record<EvidenceItemCategory, string> = {
  EQUIPAMENTO: 'Equipamento',
  INFRAESTRUTURA: 'Infraestrutura',
  CABEAMENTO: 'Cabeamento',
  CENTRAL: 'Central',
  OUTRO: 'Outro',
};

function rowToItem(r: any): ServiceAttendanceEvidenceItem {
  return {
    id: String(r.id),
    serviceAttendanceId: String(r.service_attendance_id),
    workOrderId: r.work_order_id ?? undefined,
    title: r.title ?? '',
    category: (r.category || 'EQUIPAMENTO') as EvidenceItemCategory,
    location: r.location ?? undefined,
    deviceAddress: r.device_address ?? undefined,
    catalogItemId: r.catalog_item_id ?? undefined,
    manufacturer: r.manufacturer ?? undefined,
    model: r.model ?? undefined,
    notes: r.notes ?? undefined,
    status: r.status ?? undefined,
    createdBy: r.created_by ?? undefined,
    createdAt: r.created_at ?? undefined,
    updatedAt: r.updated_at ?? undefined,
  };
}

function itemToRow(i: Partial<ServiceAttendanceEvidenceItem>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (i.serviceAttendanceId !== undefined) row.service_attendance_id = i.serviceAttendanceId;
  if (i.workOrderId !== undefined) row.work_order_id = i.workOrderId ?? null;
  if (i.title !== undefined) row.title = i.title;
  if (i.category !== undefined) row.category = i.category;
  if (i.location !== undefined) row.location = i.location || null;
  if (i.deviceAddress !== undefined) row.device_address = i.deviceAddress || null;
  if (i.catalogItemId !== undefined) row.catalog_item_id = i.catalogItemId || null;
  if (i.manufacturer !== undefined) row.manufacturer = i.manufacturer || null;
  if (i.model !== undefined) row.model = i.model || null;
  if (i.notes !== undefined) row.notes = i.notes || null;
  if (i.status !== undefined) row.status = i.status || null;
  return row;
}

export async function fetchEvidenceItems(serviceAttendanceId: string): Promise<ServiceAttendanceEvidenceItem[]> {
  if (!serviceAttendanceId) return [];
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('service_attendance_id', serviceAttendanceId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToItem);
}

export async function createEvidenceItem(input: Omit<ServiceAttendanceEvidenceItem, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<ServiceAttendanceEvidenceItem> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).insert(itemToRow(input)).select().single();
  if (error) throw error;
  return rowToItem(data);
}

export async function updateEvidenceItem(id: string, patch: Partial<ServiceAttendanceEvidenceItem>): Promise<ServiceAttendanceEvidenceItem> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).update(itemToRow(patch)).eq('id', id).select().single();
  if (error) throw error;
  return rowToItem(data);
}

/** Exclui o Item. As fotos NÃO são apagadas (FK on delete set null): elas
 *  perdem o vínculo com o item, mas o arquivo/registro permanece (§21/§38). */
export async function deleteEvidenceItem(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

/* ----------------------- Helpers PUROS (testáveis) ----------------------- */

export interface MomentCounts { antes: number; durante: number; depois: number; }

/** Conta fotos por momento de UM item (Antes/Durante/Depois). Puro. */
export function countPhotosByMoment(photos: Pick<FieldPhoto, 'evidenceItemId' | 'evidenceMoment'>[], itemId: string): MomentCounts {
  const scope = photos.filter((p) => p.evidenceItemId === itemId);
  const count = (m: FieldPhotoMoment) => scope.filter((p) => p.evidenceMoment === m).length;
  return { antes: count('ANTES'), durante: count('DURANTE'), depois: count('DEPOIS') };
}

/** Fotos de um item em um momento específico. Puro. */
export function photosForItemMoment(
  photos: FieldPhoto[],
  itemId: string,
  moment: FieldPhotoMoment
): FieldPhoto[] {
  return photos.filter((p) => p.evidenceItemId === itemId && p.evidenceMoment === moment);
}

/** Fabricante/modelo do catálogo → campos do item, sem dado comercial. */
export function equipmentToItemFields(v?: { catalogItemId?: string; brand?: string; model?: string } | null): Pick<ServiceAttendanceEvidenceItem, 'catalogItemId' | 'manufacturer' | 'model'> {
  return {
    catalogItemId: v?.catalogItemId,
    manufacturer: v?.brand?.trim() || undefined,
    model: v?.model?.trim() || undefined,
  };
}
