import { createFieldPhotoSession, FieldPhoto, FieldPhotoSession, insertFieldPhoto, updateFieldPhotoSessionStatus } from '../fieldPhotos';
import { buildFieldPhotoPath, uploadFieldPhotoAsset } from '../fieldPhotoStorage';
import { createFireowlEvidence } from '../fieldPhotoEvidence';
import { canProcessJob, enqueueOfflineJob, getOutboxOwner, listOfflineJobs, OfflineJob, registerOfflineHandler } from './outbox';

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

export async function pendingFieldPhotoJobs(): Promise<number> {
  const owner = getOutboxOwner();
  return (await listOfflineJobs()).filter(
    (job) => (job.domain === 'FIELD_PHOTO' || job.domain === 'FIELD_PHOTO_SESSION') && canProcessJob(job, owner)
  ).length;
}

async function syncSession(job: OfflineJob<FieldPhotoSessionPayload>): Promise<void> {
  const session = await createFieldPhotoSession(job.payload.session);
  await updateFieldPhotoSessionStatus(session.id, 'sincronizado');
}

async function syncPhoto(job: OfflineJob<FieldPhotoPayload>): Promise<void> {
  const { photo, session, original, markup } = job.payload;
  // Garante que o FK exista antes de subir binários. O id local já é UUID válido,
  // mas a sessão é reconciliada pelo client_uuid para o caso de retry/duplicidade.
  const syncedSession = await createFieldPhotoSession(session);
  const owner = session.tecnicoId;
  const base = { technicianId: owner, sessionClientUuid: session.clientUuid, photoClientUuid: photo.clientUuid };
  const originalPath = await uploadFieldPhotoAsset({ path: buildFieldPhotoPath({ ...base, asset: 'original' }), file: original });
  let evidence = job.payload.evidence;
  if (!evidence) evidence = await createFireowlEvidence(original, photo, session, job.payload.clientName);
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
