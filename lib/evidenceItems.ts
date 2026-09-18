import { getSupabaseClient } from './supabaseClient';
import { EvidenceItemCategory, NaturezaIntervencao, ServiceAttendanceEvidenceItem } from './types';
import { FieldPhoto, FieldPhotoMoment } from './fieldPhotos';
import { subcategoriesForArea, TechnicalCatalogItem } from './technicalCatalog';

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
    naturezaIntervencao: (r.natureza_intervencao ?? undefined) as NaturezaIntervencao | undefined,
    equipmentType: r.equipment_type ?? undefined,
    location: r.location ?? undefined,
    deviceAddress: r.device_address ?? undefined,
    catalogItemId: r.catalog_item_id ?? undefined,
    manufacturer: r.manufacturer ?? undefined,
    model: r.model ?? undefined,
    notes: r.notes ?? undefined,
    equipmentReplaced: r.equipment_replaced ?? undefined,
    equipmentFinalCatalogItemId: r.equipment_final_catalog_item_id ?? undefined,
    equipmentFinalManufacturer: r.equipment_final_manufacturer ?? undefined,
    equipmentFinalModel: r.equipment_final_model ?? undefined,
    equipmentFinalType: r.equipment_final_type ?? undefined,
    deviceAddressFinal: r.device_address_final ?? undefined,
    deviceId: r.device_id ?? undefined,
    replacementDeviceId: r.replacement_device_id ?? undefined,
    baseUpdateDecision: r.base_update_decision ?? undefined,
    baseUpdateAppliedAt: r.base_update_applied_at ?? undefined,
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
  if (i.naturezaIntervencao !== undefined) row.natureza_intervencao = i.naturezaIntervencao || null;
  if (i.equipmentType !== undefined) row.equipment_type = i.equipmentType || null;
  if (i.location !== undefined) row.location = i.location || null;
  if (i.deviceAddress !== undefined) row.device_address = i.deviceAddress || null;
  if (i.catalogItemId !== undefined) row.catalog_item_id = i.catalogItemId || null;
  if (i.manufacturer !== undefined) row.manufacturer = i.manufacturer || null;
  if (i.model !== undefined) row.model = i.model || null;
  if (i.notes !== undefined) row.notes = i.notes || null;
  if (i.equipmentReplaced !== undefined) row.equipment_replaced = i.equipmentReplaced;
  if (i.equipmentFinalCatalogItemId !== undefined) row.equipment_final_catalog_item_id = i.equipmentFinalCatalogItemId || null;
  if (i.equipmentFinalManufacturer !== undefined) row.equipment_final_manufacturer = i.equipmentFinalManufacturer || null;
  if (i.equipmentFinalModel !== undefined) row.equipment_final_model = i.equipmentFinalModel || null;
  if (i.equipmentFinalType !== undefined) row.equipment_final_type = i.equipmentFinalType || null;
  if (i.deviceAddressFinal !== undefined) row.device_address_final = i.deviceAddressFinal || null;
  if (i.deviceId !== undefined) row.device_id = i.deviceId || null;
  if (i.replacementDeviceId !== undefined) row.replacement_device_id = i.replacementDeviceId || null;
  if (i.baseUpdateDecision !== undefined) row.base_update_decision = i.baseUpdateDecision || null;
  if (i.baseUpdateAppliedAt !== undefined) row.base_update_applied_at = i.baseUpdateAppliedAt || null;
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

/* ----------------------- Categorias por área (§25–§36) ------------------- */

/** Opção de categoria do Item: rótulo exibido + categoria "coarse" persistida +
 *  subcategoria da taxonomia (para filtrar fabricante/modelo). */
export interface EvidenceCategoryOption {
  value: string;
  label: string;
  coarse: EvidenceItemCategory;
  /** Tipo/família técnica (taxonomia) — undefined para genéricas. */
  subcategory?: string;
}

/** Mapeia uma subcategoria da taxonomia para a categoria coarse do item.
 *  Central/Repetidora → CENTRAL; cabo → CABEAMENTO; infra/eletroduto →
 *  INFRAESTRUTURA; o restante é EQUIPAMENTO. */
export function coarseFromSubcategory(sub?: string): EvidenceItemCategory {
  const s = (sub || '').toLowerCase();
  if (/centra|repetidora/.test(s)) return 'CENTRAL'; // central, centrais, repetidora
  if (/cabe|cabo/.test(s)) return 'CABEAMENTO';
  if (/infra|eletroduto|eletrocalha|tubula|conduíte|conduite/.test(s)) return 'INFRAESTRUTURA';
  return 'EQUIPAMENTO';
}

/**
 * Constrói as opções de categoria do Item a partir da ÁREA do atendimento e da
 * taxonomia REAL do catálogo (technical_catalog.subcategory), reutilizando a
 * nomenclatura canônica (§25/§26). Acrescenta genéricas seguras (Infraestrutura,
 * Cabeamento, Outro). Sem área/sem taxonomia → só as genéricas coarse (§33):
 * NÃO assume SDAI silenciosamente. Puro e testável.
 */
export function buildEvidenceCategoryOptions(catalog: TechnicalCatalogItem[], area?: string): EvidenceCategoryOption[] {
  const subs = area ? subcategoriesForArea(catalog, area) : [];
  if (subs.length === 0) {
    return (['EQUIPAMENTO', 'CENTRAL', 'INFRAESTRUTURA', 'CABEAMENTO', 'OUTRO'] as EvidenceItemCategory[])
      .map((c) => ({ value: c, label: EVIDENCE_CATEGORY_LABEL[c], coarse: c }));
  }
  const opts: EvidenceCategoryOption[] = subs.map((s) => ({ value: s, label: s, coarse: coarseFromSubcategory(s), subcategory: s }));
  // Genéricas que não são famílias de equipamento no catálogo.
  const has = (label: string) => opts.some((o) => o.label.toLowerCase() === label.toLowerCase());
  if (!has('Infraestrutura')) opts.push({ value: 'INFRAESTRUTURA', label: 'Infraestrutura', coarse: 'INFRAESTRUTURA' });
  if (!has('Cabeamento')) opts.push({ value: 'CABEAMENTO', label: 'Cabeamento', coarse: 'CABEAMENTO' });
  opts.push({ value: 'OUTRO', label: 'Outro', coarse: 'OUTRO' });
  return opts;
}

/** Fabricante/modelo do catálogo → campos do item (encontrado), sem dado comercial. */
export function equipmentToItemFields(v?: { catalogItemId?: string; brand?: string; model?: string } | null): Pick<ServiceAttendanceEvidenceItem, 'catalogItemId' | 'manufacturer' | 'model'> {
  return {
    catalogItemId: v?.catalogItemId,
    manufacturer: v?.brand?.trim() || undefined,
    model: v?.model?.trim() || undefined,
  };
}

/* ----------------------- Substituição (Antes × Depois) ------------------- */
export interface EquipmentRef { catalogItemId?: string; brand?: string; model?: string }

/** Equipamento do catálogo/manual → campos do INSTALADO (depois). */
export function equipmentToFinalItemFields(v?: EquipmentRef | null): Pick<ServiceAttendanceEvidenceItem, 'equipmentFinalCatalogItemId' | 'equipmentFinalManufacturer' | 'equipmentFinalModel'> {
  return {
    equipmentFinalCatalogItemId: v?.catalogItemId,
    equipmentFinalManufacturer: v?.brand?.trim() || undefined,
    equipmentFinalModel: v?.model?.trim() || undefined,
  };
}

/** Identificação do equipamento ENCONTRADO (antes) do item. */
export function itemEquipmentBefore(item: Pick<ServiceAttendanceEvidenceItem, 'catalogItemId' | 'manufacturer' | 'model'>): EquipmentRef {
  return { catalogItemId: item.catalogItemId, brand: item.manufacturer, model: item.model };
}
/** Identificação do equipamento INSTALADO (depois) do item. */
export function itemEquipmentAfter(item: Pick<ServiceAttendanceEvidenceItem, 'equipmentFinalCatalogItemId' | 'equipmentFinalManufacturer' | 'equipmentFinalModel'>): EquipmentRef {
  return { catalogItemId: item.equipmentFinalCatalogItemId, brand: item.equipmentFinalManufacturer, model: item.equipmentFinalModel };
}

/** Há identificação de equipamento (fabricante/modelo)? */
export function hasEquipment(e?: EquipmentRef | null): boolean {
  return !!e && !!((e.brand || '').trim() || (e.model || '').trim());
}

/** "Fabricante · Modelo" (ou vazio). */
export function equipmentLabel(e?: EquipmentRef | null): string {
  return [e?.brand, e?.model].map((x) => (x || '').trim()).filter(Boolean).join(' · ');
}

/* ------------- Natureza da intervenção (0112) — helpers PUROS ------------- */

export const NATUREZA_LABEL: Record<NaturezaIntervencao, string> = {
  MANUTENCAO: 'Manutenção',
  INSTALACAO: 'Instalação',
  SUBSTITUICAO: 'Substituição',
};

/** Natureza efetiva para renderização: item legado (undefined) = MANUTENCAO
 *  (§11 — nunca reescreve o registro; só interpreta o histórico). */
export function effectiveNature(nature?: NaturezaIntervencao): NaturezaIntervencao {
  return nature || 'MANUTENCAO';
}

/** Um "slot" de foto de um item, já com o rótulo adequado à natureza. O momento
 *  físico persistido em field_photos continua sendo ANTES/DURANTE/DEPOIS; só o
 *  rótulo apresentado muda. `optional` marca slots que não são obrigatórios. */
export interface MomentSlot { moment: FieldPhotoMoment; label: string; short: string; optional?: boolean; }

/** Slots ordenados por natureza. NÃO mostra Antes/Durante/Depois artificialmente
 *  em instalação (§7/§10): instalação usa "Local antes" (opcional) → "Instalado"
 *  → "Teste"; substituição usa "Anterior" → "Novo" → "Teste"; manutenção mantém
 *  Antes/Durante/Depois. Puro e testável. */
export function momentSlotsForNature(nature?: NaturezaIntervencao): MomentSlot[] {
  switch (effectiveNature(nature)) {
    case 'INSTALACAO':
      return [
        { moment: 'ANTES', label: 'Local antes da instalação', short: 'Local antes', optional: true },
        { moment: 'DEPOIS', label: 'Equipamento instalado', short: 'Instalado' },
        { moment: 'DURANTE', label: 'Teste / comissionamento', short: 'Teste', optional: true },
      ];
    case 'SUBSTITUICAO':
      return [
        { moment: 'ANTES', label: 'Equipamento anterior', short: 'Anterior' },
        { moment: 'DEPOIS', label: 'Novo equipamento instalado', short: 'Novo' },
        { moment: 'DURANTE', label: 'Teste / comissionamento', short: 'Teste', optional: true },
      ];
    case 'MANUTENCAO':
    default:
      return [
        { moment: 'ANTES', label: 'Antes', short: 'Antes' },
        { moment: 'DURANTE', label: 'Durante', short: 'Durante', optional: true },
        { moment: 'DEPOIS', label: 'Depois', short: 'Depois' },
      ];
  }
}

/** Rótulo de um momento para uma dada natureza (fallback: título canônico). */
export function momentLabelForNature(nature: NaturezaIntervencao | undefined, moment: FieldPhotoMoment): string {
  return momentSlotsForNature(nature).find((s) => s.moment === moment)?.label
    ?? ({ ANTES: 'Antes', DURANTE: 'Durante', DEPOIS: 'Depois', CENTRAL_ANTES: 'Central na chegada', CENTRAL_DEPOIS: 'Central na saída' }[moment]);
}

/** Instalação NÃO exige foto ANTES (§3/§7): a foto de criação do item só é
 *  obrigatória/forçada em manutenção. Em instalação/substituição a criação do
 *  item não deve forçar um "antes". */
export function requiresBeforePhotoOnCreate(nature?: NaturezaIntervencao): boolean {
  return effectiveNature(nature) === 'MANUTENCAO';
}

/** Momento físico da PRIMEIRA foto ao criar o item, por natureza. Manutenção e
 *  substituição começam pelo estado inicial (ANTES = existente/anterior);
 *  instalação começa pelo equipamento INSTALADO (DEPOIS) — não há "antes". */
export function createPhotoMomentForNature(nature?: NaturezaIntervencao): FieldPhotoMoment {
  return effectiveNature(nature) === 'INSTALACAO' ? 'DEPOIS' : 'ANTES';
}

/** Rótulo de resultado contextual por natureza, mapeado para o enum canônico
 *  (§9 — sem enum paralelo). Só apresentação; a persistência continua no enum. */
export function resultLabelForNature(result: 'RESOLVIDO' | 'PARCIALMENTE_RESOLVIDO' | 'NAO_RESOLVIDO', nature?: NaturezaIntervencao): string {
  if (effectiveNature(nature) === 'INSTALACAO' || effectiveNature(nature) === 'SUBSTITUICAO') {
    return { RESOLVIDO: 'Instalado e testado', PARCIALMENTE_RESOLVIDO: 'Instalado com pendência', NAO_RESOLVIDO: 'Não concluído' }[result];
  }
  return { RESOLVIDO: 'Resolvido', PARCIALMENTE_RESOLVIDO: 'Parcialmente resolvido', NAO_RESOLVIDO: 'Não resolvido' }[result];
}
