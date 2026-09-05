/* ===================================================================
 * ETAPA 3D.2 — Sincronização offline de ativos/verificações da Base Técnica.
 * Reaproveita o outbox existente (§16). O `id` do device é gerado no CLIENTE, e o
 * upsert por id torna o replay IDEMPOTENTE — reenviar o mesmo ativo NÃO duplica.
 * A verificação (opcional) também leva id de cliente e faz upsert por id.
 * =================================================================== */
import { Device, DeviceVerification } from '../types';
import { upsertDevice } from '../devices';
import { addVerification } from '../deviceVerifications';
import { enqueueOfflineJob, listOfflineJobs, registerOfflineHandler, canProcessJob, getOutboxOwner } from './outbox';

export interface TechAssetPayload {
  device: Device;                              // já com id gerado no cliente
  verification?: Omit<DeviceVerification, 'id'> & { id: string };
  ownerUserId?: string;
}

/** Enfileira criação/atualização de ativo (+ verificação) para sync offline-safe. */
export async function enqueueTechAsset(payload: TechAssetPayload): Promise<string> {
  return enqueueOfflineJob<TechAssetPayload>({
    domain: 'TECH_ASSET',
    entityClientUuid: payload.device.id,       // chave estável → coalesce + idempotência
    payload,
    ownerUserId: payload.ownerUserId,
  });
}

export async function pendingTechAssetJobs(): Promise<number> {
  const owner = getOutboxOwner();
  return (await listOfflineJobs('TECH_ASSET')).filter((j) => canProcessJob(j, owner)).length;
}

registerOfflineHandler<TechAssetPayload>('TECH_ASSET', async (job) => {
  const { device, verification } = job.payload;
  await upsertDevice(device);                  // upsert por id: replay não duplica
  if (verification) await addVerification(verification); // upsert por id: idem
});
