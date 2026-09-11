import { fetchSurveys } from './technicalSurveys';
import { fetchDevices } from './devices';
import { fetchVerificationsForSurvey } from './deviceVerifications';
import { listOfflineJobs } from './offline/outbox';
import type { TechAssetPayload } from './offline/technicalBaseSync';
import type { FieldPhotoPayload, FieldPhotoSessionPayload } from './offline/fieldPhotoSync';
import { FieldPhotoSession, listFieldPhotosBySession } from './fieldPhotos';
import { signedFieldPhotoUrls } from './fieldPhotoStorage';
import { getSupabaseClient } from './supabaseClient';

/** Read existing canonical records/outbox only. No save, enqueue, STARTED or session creation. */
export async function restoreSurveyNavigation(input: { id: string; clientId: string; area: string; owner: string; sessionId?: string }) {
  const survey = (await fetchSurveys(input.clientId, input.area)).find((s) => s.id === input.id && s.status === 'EM_ANDAMENTO');
  if (!survey) return null;
  const [devices, verifications, allJobs] = await Promise.all([
    fetchDevices(input.clientId), fetchVerificationsForSurvey(input.id), listOfflineJobs().catch(() => []),
  ]);
  const jobs = allJobs.filter((j) => j.ownerUserId === input.owner);
  const assets = jobs.filter((j) => j.domain === 'TECH_ASSET').map((j) => j.payload as TechAssetPayload)
    .filter((p) => p.device.clienteId === input.clientId && (p.device.sourceSurveyId === input.id || p.verification?.surveyId === input.id));
  const pool = new Map(devices.map((d) => [d.id, d]));
  assets.forEach((p) => pool.set(p.device.id, p.device));
  const checks = new Map([...verifications].reverse().map((v) => [v.deviceId, v]));
  assets.forEach((p) => { if (p.verification) checks.set(p.device.id, p.verification); });
  const photoJobs = jobs.filter((j) => j.domain === 'FIELD_PHOTO').map((j) => j.payload as FieldPhotoPayload)
    .filter((p) => p.photo.technicalSurveyId === input.id && p.photo.clientId === input.clientId);
  let session: FieldPhotoSession | null = null;
  if (input.sessionId) {
    session = jobs.filter((j) => j.domain === 'FIELD_PHOTO_SESSION').map((j) => (j.payload as FieldPhotoSessionPayload).session)
      .concat(photoJobs.map((p) => p.session)).find((s) => s.id === input.sessionId && s.clientId === input.clientId && s.tecnicoId === input.owner) || null;
    if (!session) {
      const { data, error } = await (getSupabaseClient() as any).from('field_photo_sessions').select('*').eq('id', input.sessionId).eq('client_id', input.clientId).eq('tecnico_id', input.owner).maybeSingle();
      if (!error && data) session = { id: data.id, clientUuid: data.client_uuid, clientId: data.client_id, tecnicoId: data.tecnico_id, tecnicoNome: data.tecnico_nome, iniciadoEm: data.iniciado_em, syncStatus: data.sync_status, localSetor: data.local_setor };
    }
  }
  const remotePhotos = session ? await listFieldPhotosBySession(session.id).catch(() => []) : [];
  const photos = remotePhotos.filter((p) => p.technicalSurveyId === input.id && p.clientId === input.clientId);
  const signed = await signedFieldPhotoUrls(photos.map((p) => p.storagePathEvidencia || p.storagePathOriginal)).catch(() => ({} as Record<string, string>));
  const previews: Record<string, string[]> = {};
  const localUrls: string[] = [];
  const seen = new Set<string>();
  for (const p of photoJobs) {
    if (!p.photo.deviceId) continue;
    const url = URL.createObjectURL(p.evidence || p.original);
    localUrls.push(url);
    (previews[p.photo.deviceId] ||= []).push(url);
    seen.add(p.photo.clientUuid);
  }
  for (const p of photos) {
    const url = signed[p.storagePathEvidencia || p.storagePathOriginal];
    if (p.deviceId && url && !seen.has(p.clientUuid)) (previews[p.deviceId] ||= []).push(url);
  }
  return { survey, devices: [...pool.values()], verifications: [...checks.values()], session, previews, localUrls };
}
