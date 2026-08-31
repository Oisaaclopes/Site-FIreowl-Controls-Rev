import { createFieldPhotoSession, FieldPhoto, FieldPhotoSession, insertFieldPhoto, updateFieldPhotoSessionStatus } from '../fieldPhotos';
import { buildFieldPhotoPath, uploadFieldPhotoAsset } from '../fieldPhotoStorage';
import { enqueueOfflineJob, OfflineJob, registerOfflineHandler } from './outbox';

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
}

export async function enqueueFieldPhotoSession(session: FieldPhotoSession): Promise<void> {
  await enqueueOfflineJob<FieldPhotoSessionPayload>({
    domain: 'FIELD_PHOTO_SESSION', entityClientUuid: session.clientUuid, payload: { session },
  });
}

export async function enqueueFieldPhoto(payload: FieldPhotoPayload): Promise<void> {
  await enqueueOfflineJob<FieldPhotoPayload>({
    domain: 'FIELD_PHOTO', entityClientUuid: payload.photo.clientUuid, payload,
  });
}

async function syncSession(job: OfflineJob<FieldPhotoSessionPayload>): Promise<void> {
  const session = await createFieldPhotoSession(job.payload.session);
  await updateFieldPhotoSessionStatus(session.id, 'sincronizado');
}

async function syncPhoto(job: OfflineJob<FieldPhotoPayload>): Promise<void> {
  const { photo, session, original, evidence, markup } = job.payload;
  // Garante que o FK exista antes de subir binários. O id local já é UUID válido,
  // mas a sessão é reconciliada pelo client_uuid para o caso de retry/duplicidade.
  const syncedSession = await createFieldPhotoSession(session);
  const owner = session.tecnicoId;
  const base = { technicianId: owner, sessionClientUuid: session.clientUuid, photoClientUuid: photo.clientUuid };
  const originalPath = await uploadFieldPhotoAsset({ path: buildFieldPhotoPath({ ...base, asset: 'original' }), file: original });
  const evidencePath = evidence
    ? await uploadFieldPhotoAsset({ path: buildFieldPhotoPath({ ...base, asset: 'evidence' }), file: evidence })
    : undefined;
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
