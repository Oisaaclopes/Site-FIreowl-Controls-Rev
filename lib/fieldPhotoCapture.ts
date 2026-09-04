import {
  FieldPhoto,
  FieldPhotoMoment,
  FieldPhotoSession,
  newFieldPhoto,
  newFieldPhotoSession,
} from './fieldPhotos';
import { buildFieldPhotoPath } from './fieldPhotoStorage';
import { createFireowlEvidence } from './fieldPhotoEvidence';
import { capturePosition, reverseGeocode } from './fieldPhotoGeo';
import { enqueueFieldPhoto, enqueueFieldPhotoSession } from './offline/fieldPhotoSync';

/* ===================================================================
 * ETAPA 3B.3 — Pipeline REUTILIZÁVEL de captura de evidência (§9).
 * EXATAMENTE o mesmo caminho do Registro Rápido (field_photos + storage privado
 * + outbox offline + evidência derivada), mas com o CONTEXTO já conhecido
 * (cliente/OS/atendimento/técnico) — sem abrir o Registro Rápido. Câmera e
 * upload usam este mesmo pipeline; não há segunda fila nem outro storage.
 * =================================================================== */

/** Cria e enfileira UMA sessão para o atendimento (uma por atendimento). */
export async function ensureAttendanceSession(input: {
  clientId: string;
  technicianId: string;
  technicianName?: string;
  localSetor?: string;
}): Promise<FieldPhotoSession> {
  const session = newFieldPhotoSession({
    clientId: input.clientId,
    tecnicoId: input.technicianId,
    tecnicoNome: input.technicianName,
    localSetor: input.localSetor,
  });
  await enqueueFieldPhotoSession(session);
  return session;
}

/**
 * timestamp de captura HONESTO (§11): usa o `lastModified` do arquivo — que o
 * navegador define como o momento real de captura tanto para foto tirada na hora
 * (câmera) quanto para foto escolhida da galeria. Como a captura passou a ser
 * unificada ([Adicionar foto], sem distinção câmera/galeria), não há como (nem
 * por que) inferir a origem: o metadado do próprio arquivo é o melhor sinal e
 * nunca a "hora do upload". Sem lastModified confiável, cai para agora.
 * `created_at` no banco (default now) segue sendo o enviado_em/criado_em.
 */
export function evidenceCapturedAt(file: File): string {
  const lm = Number((file as any).lastModified);
  if (Number.isFinite(lm) && lm > 0) return new Date(lm).toISOString();
  return new Date().toISOString();
}

export interface CapturedEvidence {
  photo: FieldPhoto;
  original: File;
  evidence?: Blob;
  /** URL local (blob) do original para preview imediato. */
  previewUrl: string;
}

/**
 * Enfileira uma evidência do atendimento com o contexto preenchido. Reaproveita
 * geo best-effort (nunca bloqueia). NÃO movimenta estoque — equipamento é só
 * identificação técnica (§42).
 */
export async function captureAttendanceEvidence(input: {
  file: File;
  session: FieldPhotoSession;
  clientId: string;
  clientName: string;
  osId?: string;
  serviceAttendanceId: string;
  moment: FieldPhotoMoment;
  /** Item de Evidência (3B.4) a que a foto pertence, quando houver. */
  evidenceItemId?: string;
  note?: string;
  equipmentCatalogItemId?: string;
  equipmentBrand?: string;
  equipmentModel?: string;
}): Promise<CapturedEvidence> {
  const capturedAt = evidenceCapturedAt(input.file);
  const geo = await capturePosition().then((p) => (p ? reverseGeocode(p) : undefined)).catch(() => undefined);

  const base = newFieldPhoto(
    {
      sessionId: input.session.id,
      clientId: input.clientId,
      storagePathOriginal: '',
      notaRapida: input.note?.trim() || undefined,
      // marcador legado espelha o momento p/ compatibilidade com Antes×Depois.
      marcador: input.moment === 'DEPOIS' || input.moment === 'CENTRAL_DEPOIS' ? 'depois'
        : input.moment === 'ANTES' || input.moment === 'CENTRAL_ANTES' ? 'antes'
        : undefined,
      geo,
      osId: input.osId,
      serviceAttendanceId: input.serviceAttendanceId,
      evidenceMoment: input.moment,
      evidenceItemId: input.evidenceItemId,
      equipmentCatalogItemId: input.equipmentCatalogItemId,
      equipmentBrand: input.equipmentBrand?.trim() || undefined,
      equipmentModel: input.equipmentModel?.trim() || undefined,
    },
    capturedAt
  );
  const pathBase = { technicianId: input.session.tecnicoId, sessionClientUuid: input.session.clientUuid, photoClientUuid: base.clientUuid };
  const photo: FieldPhoto = {
    ...base,
    storagePathOriginal: buildFieldPhotoPath({ ...pathBase, asset: 'original' }),
    storagePathEvidencia: buildFieldPhotoPath({ ...pathBase, asset: 'evidence' }),
  };

  let evidence: Blob | undefined;
  try {
    evidence = await createFireowlEvidence(input.file, photo, input.session, input.clientName);
  } catch { /* a evidência derivada é regerada na sincronização */ }

  await enqueueFieldPhoto({ photo, session: input.session, original: input.file, evidence, clientName: input.clientName });
  return { photo, original: input.file, evidence, previewUrl: URL.createObjectURL(input.file) };
}
