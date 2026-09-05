import { getSupabaseClient } from './supabaseClient';

export type FieldPhotoSyncStatus = 'pendente' | 'sincronizado' | 'erro';
export type FieldPhotoMarker = 'antes' | 'depois' | 'falha' | 'corrigido' | 'pendente';
/** Fase da evidência dentro do atendimento (3B.3/0087). */
export type FieldPhotoMoment = 'ANTES' | 'DURANTE' | 'DEPOIS' | 'CENTRAL_ANTES' | 'CENTRAL_DEPOIS';
export interface FieldPhotoGeo { latitude:number; longitude:number; accuracy?:number; capturedAt:string; address?:string; }

export interface FieldPhotoSession {
  id: string;
  clientId: string;
  localSetor?: string;
  tecnicoId: string;
  tecnicoNome?: string;
  iniciadoEm: string;
  finalizadoEm?: string;
  clientUuid: string;
  syncStatus: FieldPhotoSyncStatus;
}
export interface FieldPhoto {
  id: string;
  sessionId: string;
  clientId: string;
  reportId?: string;
  osId?: string;
  /** Atendimento (service_attendances) em que a evidência foi capturada (0084). */
  serviceAttendanceId?: string;
  pendenciaId?: string;
  /** Identificação de equipamento (3B.2/0086): catálogo OU manual. NUNCA move estoque. */
  equipmentCatalogItemId?: string;
  equipmentBrand?: string;
  equipmentModel?: string;
  /** Fase da evidência no atendimento (3B.3/0087). */
  evidenceMoment?: FieldPhotoMoment;
  /** Item de Evidência (3B.4/0088) a que a foto pertence. */
  evidenceItemId?: string;
  /** Ativo da Base Técnica (0095/3D.3) a que a evidência pertence. */
  deviceId?: string;
  /** Levantamento técnico (technical_surveys, 0095/3D.3) da captura. */
  technicalSurveyId?: string;
  storagePathOriginal: string;
  storagePathMarkup?: string;
  storagePathEvidencia?: string;
  notaRapida?: string;
  marcador?: FieldPhotoMarker;
  capturadoEm: string;
  geo?: FieldPhotoGeo;
  clientUuid: string;
  syncStatus: FieldPhotoSyncStatus;
}

const uuid = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const value = (Math.random() * 16) | 0;
    return (ch === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
};
const sessionRow = (s: FieldPhotoSession) => ({ id: s.id, client_id: s.clientId, local_setor: s.localSetor ?? null, tecnico_id: s.tecnicoId, tecnico_nome: s.tecnicoNome ?? null, iniciado_em: s.iniciadoEm, finalizado_em: s.finalizadoEm ?? null, client_uuid: s.clientUuid, sync_status: s.syncStatus });
const photoRow = (p: FieldPhoto) => ({ id: p.id, session_id: p.sessionId, client_id: p.clientId, report_id: p.reportId ?? null, os_id: p.osId ?? null, service_attendance_id: p.serviceAttendanceId ?? null, pendencia_id: p.pendenciaId ?? null, storage_path_original: p.storagePathOriginal, storage_path_markup: p.storagePathMarkup ?? null, storage_path_evidencia: p.storagePathEvidencia ?? null, nota_rapida: p.notaRapida ?? null, marcador: p.marcador ?? null, capturado_em: p.capturadoEm, geo: p.geo ?? null, client_uuid: p.clientUuid, sync_status: p.syncStatus, equipment_catalog_item_id: p.equipmentCatalogItemId ?? null, equipment_brand: p.equipmentBrand ?? null, equipment_model: p.equipmentModel ?? null, evidence_moment: p.evidenceMoment ?? null, evidence_item_id: p.evidenceItemId ?? null, device_id: p.deviceId ?? null, technical_survey_id: p.technicalSurveyId ?? null });
const fromPhoto = (r: any): FieldPhoto => ({ id: r.id, sessionId: r.session_id, clientId: r.client_id, reportId: r.report_id ?? undefined, osId: r.os_id ?? undefined, serviceAttendanceId: r.service_attendance_id ?? undefined, pendenciaId: r.pendencia_id ?? undefined, storagePathOriginal: r.storage_path_original, storagePathMarkup: r.storage_path_markup ?? undefined, storagePathEvidencia: r.storage_path_evidencia ?? undefined, notaRapida: r.nota_rapida ?? undefined, marcador: r.marcador ?? undefined, capturadoEm: r.capturado_em, geo: r.geo ?? undefined, clientUuid: r.client_uuid, syncStatus: r.sync_status, equipmentCatalogItemId: r.equipment_catalog_item_id ?? undefined, equipmentBrand: r.equipment_brand ?? undefined, equipmentModel: r.equipment_model ?? undefined, evidenceMoment: r.evidence_moment ?? undefined, evidenceItemId: r.evidence_item_id ?? undefined, deviceId: r.device_id ?? undefined, technicalSurveyId: r.technical_survey_id ?? undefined });
const fromSession = (r: any): FieldPhotoSession => ({ id: r.id, clientId: r.client_id, localSetor: r.local_setor ?? undefined, tecnicoId: r.tecnico_id, tecnicoNome: r.tecnico_nome ?? undefined, iniciadoEm: r.iniciado_em, finalizadoEm: r.finalizado_em ?? undefined, clientUuid: r.client_uuid, syncStatus: r.sync_status });

export const newFieldPhotoSession = (input: Pick<FieldPhotoSession, 'clientId' | 'tecnicoId' | 'tecnicoNome' | 'localSetor'>, capturedAt = new Date().toISOString()): FieldPhotoSession => ({ id: uuid(), clientUuid: uuid(), syncStatus: 'pendente', iniciadoEm: capturedAt, ...input });
export const newFieldPhoto = (input: Pick<FieldPhoto, 'sessionId' | 'clientId' | 'storagePathOriginal' | 'notaRapida' | 'marcador' | 'geo'> & Partial<Pick<FieldPhoto, 'osId' | 'serviceAttendanceId' | 'equipmentCatalogItemId' | 'equipmentBrand' | 'equipmentModel' | 'evidenceMoment' | 'evidenceItemId' | 'deviceId' | 'technicalSurveyId'>>, capturedAt = new Date().toISOString()): FieldPhoto => ({ id: uuid(), clientUuid: uuid(), syncStatus: 'pendente', capturadoEm: capturedAt, ...input });
export const isUnclassifiedFieldPhoto = (p: Pick<FieldPhoto, 'reportId' | 'osId' | 'pendenciaId'>) => !p.reportId && !p.osId && !p.pendenciaId;
export const evidenceLines = (p: Pick<FieldPhoto, 'capturadoEm' | 'notaRapida'>, session: Pick<FieldPhotoSession, 'localSetor' | 'tecnicoNome'>, clientName: string) => {
  const date = new Date(p.capturadoEm);
  return { time: date.toLocaleTimeString('pt-BR'), date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(), clientName, localSetor: session.localSetor, note: p.notaRapida, technician: session.tecnicoNome };
};

export async function createFieldPhotoSession(session: FieldPhotoSession) {
  const table = (getSupabaseClient() as any).from('field_photo_sessions');
  const { data, error } = await table.insert(sessionRow(session)).select().single();
  if (!error) return fromSession(data);
  if (error.code !== '23505') throw error;
  const { data: existing, error: lookupError } = await table.select('*').eq('client_uuid', session.clientUuid).single();
  if (lookupError) throw lookupError;
  const { data: updated, error: updateError } = await table
    .update({ local_setor: session.localSetor ?? null, finalizado_em: session.finalizadoEm ?? null, sync_status: session.syncStatus })
    .eq('id', existing.id).select().single();
  if (updateError) throw updateError;
  return fromSession(updated);
}
export async function insertFieldPhoto(photo: FieldPhoto) {
  const table = (getSupabaseClient() as any).from('field_photos');
  const { data, error } = await table.insert(photoRow(photo)).select().single();
  if (!error) return fromPhoto(data);
  if (error.code !== '23505') throw error;
  const { data: existing, error: lookupError } = await table.select('*').eq('client_uuid', photo.clientUuid).single();
  if (lookupError) throw lookupError;
  return fromPhoto(existing);
}
/** Evidências vinculadas a um ativo da Base Técnica (galeria do ativo, 3D.3). */
export async function listFieldPhotosByDevice(deviceId: string) {
  const { data, error } = await (getSupabaseClient() as any).from('field_photos').select('*').eq('device_id', deviceId).order('capturado_em', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromPhoto);
}
export async function listUnclassifiedFieldPhotos() {
  const { data, error } = await (getSupabaseClient() as any).from('field_photos').select('*').is('report_id', null).is('os_id', null).is('pendencia_id', null).order('capturado_em', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromPhoto);
}

export async function listFieldPhotosBySession(sessionId: string): Promise<FieldPhoto[]> {
  const { data, error } = await (getSupabaseClient() as any).from('field_photos').select('*').eq('session_id', sessionId).order('capturado_em', { ascending: true });
  if (error) throw error;
  return (data || []).map(fromPhoto);
}

export async function updateFieldPhotoSessionStatus(id: string, syncStatus: FieldPhotoSyncStatus): Promise<void> {
  const { error } = await (getSupabaseClient() as any).from('field_photo_sessions').update({ sync_status: syncStatus }).eq('id', id);
  if (error) throw error;
}

/**
 * Exclusão segura de UMA foto de campo (§19/§20). Reutiliza a arquitetura
 * existente: cancela o job pendente na outbox (se ainda não sincronizou),
 * remove os assets do storage privado e apaga o registro sob RLS. O CASCADE da
 * 0067 limpa comparações Before×After que referenciam a foto. Best-effort nos
 * passos de storage/outbox: o que importa é o registro sair do banco.
 */
export async function deleteFieldPhoto(photo: Pick<FieldPhoto, 'id' | 'clientUuid' | 'storagePathOriginal' | 'storagePathEvidencia' | 'storagePathMarkup'>): Promise<void> {
  const { removeOfflineJob } = await import('./offline/outbox');
  const { removeFieldPhotoAssets } = await import('./fieldPhotoStorage');
  // 1) cancela upload pendente (id = `${domain}:${entityClientUuid}`).
  if (photo.clientUuid) await removeOfflineJob(`FIELD_PHOTO:${photo.clientUuid}`).catch(() => {});
  // 2) remove arquivos do bucket.
  await removeFieldPhotoAssets([photo.storagePathOriginal, photo.storagePathEvidencia, photo.storagePathMarkup]).catch(() => {});
  // 3) apaga o registro (RLS: dono da sessão ou gestão). Ignora se ainda não existir.
  const { error } = await (getSupabaseClient() as any).from('field_photos').delete().eq('id', photo.id);
  if (error && error.code !== 'PGRST116') throw error;
}

/** Atualiza metadados de UMA foto (§18/§32): observação, momento, equipamento. */
export async function updateFieldPhotoMeta(id: string, patch: Partial<Pick<FieldPhoto, 'notaRapida' | 'evidenceMoment' | 'equipmentCatalogItemId' | 'equipmentBrand' | 'equipmentModel'>>): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.notaRapida !== undefined) row.nota_rapida = patch.notaRapida || null;
  if (patch.evidenceMoment !== undefined) row.evidence_moment = patch.evidenceMoment ?? null;
  if (patch.equipmentCatalogItemId !== undefined) row.equipment_catalog_item_id = patch.equipmentCatalogItemId || null;
  if (patch.equipmentBrand !== undefined) row.equipment_brand = patch.equipmentBrand || null;
  if (patch.equipmentModel !== undefined) row.equipment_model = patch.equipmentModel || null;
  if (Object.keys(row).length === 0) return;
  const { error } = await (getSupabaseClient() as any).from('field_photos').update(row).eq('id', id);
  if (error) throw error;
}

/** Evidências (fotos) classificadas para uma OS. Base do painel de evidências do
 *  atendimento — a RLS de field_photos continua valendo. */
export async function listFieldPhotosForOs(osId: string): Promise<FieldPhoto[]> {
  if (!osId) return [];
  const { data, error } = await (getSupabaseClient() as any).from('field_photos').select('*').eq('os_id', osId).order('capturado_em', { ascending: true });
  if (error) throw error;
  return (data || []).map(fromPhoto);
}

/** Evidências vinculadas a UM atendimento específico (0084). */
export async function listFieldPhotosForAttendance(attendanceId: string): Promise<FieldPhoto[]> {
  if (!attendanceId) return [];
  const { data, error } = await (getSupabaseClient() as any).from('field_photos').select('*').eq('service_attendance_id', attendanceId).order('capturado_em', { ascending: true });
  if (error) throw error;
  return (data || []).map(fromPhoto);
}
