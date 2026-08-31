import { getSupabaseClient } from './supabaseClient';

export type FieldPhotoSyncStatus = 'pendente' | 'sincronizado' | 'erro';
export type FieldPhotoMarker = 'antes' | 'depois' | 'falha' | 'corrigido' | 'pendente';

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
  pendenciaId?: string;
  storagePathOriginal: string;
  storagePathMarkup?: string;
  storagePathEvidencia?: string;
  notaRapida?: string;
  marcador?: FieldPhotoMarker;
  capturadoEm: string;
  geo?: unknown;
  clientUuid: string;
  syncStatus: FieldPhotoSyncStatus;
}

const uuid = () => crypto.randomUUID();
const sessionRow = (s: FieldPhotoSession) => ({ id: s.id, client_id: s.clientId, local_setor: s.localSetor ?? null, tecnico_id: s.tecnicoId, tecnico_nome: s.tecnicoNome ?? null, iniciado_em: s.iniciadoEm, finalizado_em: s.finalizadoEm ?? null, client_uuid: s.clientUuid, sync_status: s.syncStatus });
const photoRow = (p: FieldPhoto) => ({ id: p.id, session_id: p.sessionId, client_id: p.clientId, report_id: p.reportId ?? null, os_id: p.osId ?? null, pendencia_id: p.pendenciaId ?? null, storage_path_original: p.storagePathOriginal, storage_path_markup: p.storagePathMarkup ?? null, storage_path_evidencia: p.storagePathEvidencia ?? null, nota_rapida: p.notaRapida ?? null, marcador: p.marcador ?? null, capturado_em: p.capturadoEm, geo: p.geo ?? null, client_uuid: p.clientUuid, sync_status: p.syncStatus });
const fromPhoto = (r: any): FieldPhoto => ({ id: r.id, sessionId: r.session_id, clientId: r.client_id, reportId: r.report_id ?? undefined, osId: r.os_id ?? undefined, pendenciaId: r.pendencia_id ?? undefined, storagePathOriginal: r.storage_path_original, storagePathMarkup: r.storage_path_markup ?? undefined, storagePathEvidencia: r.storage_path_evidencia ?? undefined, notaRapida: r.nota_rapida ?? undefined, marcador: r.marcador ?? undefined, capturadoEm: r.capturado_em, geo: r.geo ?? undefined, clientUuid: r.client_uuid, syncStatus: r.sync_status });

export const newFieldPhotoSession = (input: Pick<FieldPhotoSession, 'clientId' | 'tecnicoId' | 'tecnicoNome' | 'localSetor'>, capturedAt = new Date().toISOString()): FieldPhotoSession => ({ id: uuid(), clientUuid: uuid(), syncStatus: 'pendente', iniciadoEm: capturedAt, ...input });
export const newFieldPhoto = (input: Pick<FieldPhoto, 'sessionId' | 'clientId' | 'storagePathOriginal' | 'notaRapida' | 'marcador' | 'geo'>, capturedAt = new Date().toISOString()): FieldPhoto => ({ id: uuid(), clientUuid: uuid(), syncStatus: 'pendente', capturadoEm: capturedAt, ...input });
export const isUnclassifiedFieldPhoto = (p: Pick<FieldPhoto, 'reportId' | 'osId' | 'pendenciaId'>) => !p.reportId && !p.osId && !p.pendenciaId;
export const evidenceLines = (p: Pick<FieldPhoto, 'capturadoEm' | 'notaRapida'>, session: Pick<FieldPhotoSession, 'localSetor' | 'tecnicoNome'>, clientName: string) => {
  const date = new Date(p.capturadoEm);
  return { time: date.toLocaleTimeString('pt-BR'), date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(), clientName, localSetor: session.localSetor, note: p.notaRapida, technician: session.tecnicoNome };
};

export async function createFieldPhotoSession(session: FieldPhotoSession) {
  const { error } = await (getSupabaseClient() as any).from('field_photo_sessions').insert(sessionRow(session));
  if (error) throw error;
}
export async function insertFieldPhoto(photo: FieldPhoto) {
  const { data, error } = await (getSupabaseClient() as any).from('field_photos').insert(photoRow(photo)).select().single();
  if (error) throw error;
  return fromPhoto(data);
}
export async function listUnclassifiedFieldPhotos() {
  const { data, error } = await (getSupabaseClient() as any).from('field_photos').select('*').is('report_id', null).is('os_id', null).is('pendencia_id', null).order('capturado_em', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromPhoto);
}
