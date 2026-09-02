import { createFieldPhotoSession, FieldPhoto, FieldPhotoSession, insertFieldPhoto, updateFieldPhotoSessionStatus } from '../fieldPhotos';
import { buildFieldPhotoPath, uploadFieldPhotoAsset } from '../fieldPhotoStorage';
import { createFireowlEvidence } from '../fieldPhotoEvidence';
import { canProcessJob, enqueueOfflineJob, getOutboxOwner, listOfflineJobs, OfflineJob, registerOfflineHandler } from './outbox';
import { createComparison, FieldPhotoComparison } from '../fieldPhotoComparisons';
import { reverseGeocode } from '../fieldPhotoGeo';

export interface FieldPhotoSessionPayload {
  session: FieldPhotoSession;
}

/** Blobs ficam no IndexedDB via structured clone, nunca serializados em localStorage. */
export interface FieldPhotoPayload {
  photo: FieldPhoto;
  session: FieldPhotoSession;
  original: Blob;
  evidence?: Blob;
  markup?: Blob;
  /** Necessário para uma evidência que falhou localmente ser recriada no retry. */
  clientName: string;
}
export interface FieldPhotoComparisonPayload { comparison: Omit<FieldPhotoComparison, 'id'|'createdBy'|'createdAt'|'updatedAt'>; ownerUserId: string; }

export async function enqueueFieldPhotoSession(session: FieldPhotoSession): Promise<void> {
  await enqueueOfflineJob<FieldPhotoSessionPayload>({
    // O dono é o técnico da sessão (autoritativo, mesmo se o owner global ainda não foi definido).
    domain: 'FIELD_PHOTO_SESSION', entityClientUuid: session.clientUuid, payload: { session }, ownerUserId: session.tecnicoId,
  });
}

export async function enqueueFieldPhoto(payload: FieldPhotoPayload): Promise<void> {
  await enqueueOfflineJob<FieldPhotoPayload>({
    domain: 'FIELD_PHOTO', entityClientUuid: payload.photo.clientUuid, payload, ownerUserId: payload.session.tecnicoId,
  });
}
export async function enqueueFieldPhotoComparison(payload: FieldPhotoComparisonPayload): Promise<void> {
  await enqueueOfflineJob({ domain:'FIELD_PHOTO_COMPARISON', entityClientUuid:`${payload.comparison.beforePhotoId}:${payload.comparison.afterPhotoId}`, payload, ownerUserId:payload.ownerUserId });
}

export async function pendingFieldPhotoJobs(): Promise<number> {
  const owner = getOutboxOwner();
  return (await listOfflineJobs()).filter(
    (job) => (job.domain === 'FIELD_PHOTO' || job.domain === 'FIELD_PHOTO_SESSION') && canProcessJob(job, owner)
  ).length;
}

export interface FieldPhotoJobState { status: OfflineJob['status']; lastError?: string; attempts: number }

/**
 * Estado real (na outbox) das fotos indicadas. Uma foto AUSENTE do mapa saiu da
 * fila = sincronizada de verdade; presente com status 'ERROR' falhou. Evita marcar
 * como "sincronizada" uma foto que só foi pulada por backoff (falso sucesso).
 */
export async function fieldPhotoJobStates(photoClientUuids: string[]): Promise<Map<string, FieldPhotoJobState>> {
  const wanted = new Set(photoClientUuids);
  const map = new Map<string, FieldPhotoJobState>();
  if (wanted.size === 0) return map;
  for (const job of await listOfflineJobs('FIELD_PHOTO')) {
    if (wanted.has(job.entityClientUuid)) map.set(job.entityClientUuid, { status: job.status, lastError: job.lastError, attempts: job.attempts });
  }
  return map;
}

/** Mensagem PT curta para falha de sincronização de foto, sem vazar erro técnico cru. */
export function friendlyFieldPhotoSyncError(raw?: string): string {
  const msg = (raw || '').toLowerCase();
  if (/row-level security|violates row|not authorized|permission|42501|403/.test(msg)) {
    return 'A foto não pôde ser registrada: seu acesso a Fotos de Campo precisa ser revisado. Fale com o administrador.';
  }
  if (/network|fetch|timeout|offline/.test(msg)) {
    return 'Sem conexão estável para enviar a foto agora. Ela ficou salva e será reenviada automaticamente.';
  }
  return 'Não foi possível enviar a foto agora. Ela ficou salva e o envio será tentado novamente.';
}

async function syncSession(job: OfflineJob<FieldPhotoSessionPayload>): Promise<void> {
  const session = await createFieldPhotoSession(job.payload.session);
  await updateFieldPhotoSessionStatus(session.id, 'sincronizado');
}

async function syncPhoto(job: OfflineJob<FieldPhotoPayload>): Promise<void> {
  let { photo } = job.payload; const { session, original, markup } = job.payload;
  if(photo.geo && !photo.geo.address) photo={...photo,geo:await reverseGeocode(photo.geo)};
  // Garante que o FK exista antes de subir binários. O id local já é UUID válido,
  // mas a sessão é reconciliada pelo client_uuid para o caso de retry/duplicidade.
  const syncedSession = await createFieldPhotoSession(session);
  const owner = session.tecnicoId;
  const base = { technicianId: owner, sessionClientUuid: session.clientUuid, photoClientUuid: photo.clientUuid };
  const originalPath = await uploadFieldPhotoAsset({ path: buildFieldPhotoPath({ ...base, asset: 'original' }), file: original });
  let evidence = job.payload.evidence;
  if (!evidence || (photo.geo?.address && !job.payload.photo.geo?.address)) evidence = await createFireowlEvidence(original, photo, session, job.payload.clientName);
  const evidencePath = await uploadFieldPhotoAsset({ path: buildFieldPhotoPath({ ...base, asset: 'evidence' }), file: evidence });
  const markupPath = markup
    ? await uploadFieldPhotoAsset({ path: buildFieldPhotoPath({ ...base, asset: 'markup' }), file: markup })
    : undefined;
  await insertFieldPhoto({
    ...photo,
    sessionId: (syncedSession as any).id || session.id,
    storagePathOriginal: originalPath,
    storagePathEvidencia: evidencePath,
    storagePathMarkup: markupPath,
    syncStatus: 'sincronizado',
  });
  await updateFieldPhotoSessionStatus(syncedSession.id, 'sincronizado');
}

registerOfflineHandler<FieldPhotoSessionPayload>('FIELD_PHOTO_SESSION', syncSession);
registerOfflineHandler<FieldPhotoPayload>('FIELD_PHOTO', syncPhoto);
registerOfflineHandler<FieldPhotoComparisonPayload>('FIELD_PHOTO_COMPARISON', async job => { await createComparison(job.payload.comparison); });
