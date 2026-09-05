/* ===================================================================
 * ETAPA 3D.2 — Orquestração de salvamento de ativo do LEVANTAMENTO na Base
 * Técnica (§1). Online: grava direto (devices + verification). Offline: enfileira
 * no outbox com id gerado no cliente → replay idempotente, sem duplicar (§16).
 * O id do ativo é SEMPRE gerado no cliente para a chave ser estável nos dois
 * caminhos (evita ativo fantasma se cair a rede no meio).
 * =================================================================== */
import { Device, DeviceVerification } from './types';
import { upsertDevice } from './devices';
import { addVerification } from './deviceVerifications';
import { enqueueTechAsset } from './offline/technicalBaseSync';
import { isOnline } from './offline/reportSync';

export function newAssetId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `asset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

export interface SurveyAssetInput {
  device: Device;                                     // já com id (newAssetId)
  verification?: Omit<DeviceVerification, 'id'>;      // condição/reconciliação da visita
  ownerUserId?: string;
}

export interface SurveyAssetResult { mode: 'online' | 'offline'; device: Device }

/**
 * Persiste (ou enfileira) um ativo + sua verificação. Deduplicação é decidida
 * ANTES pela UI (findIdentityMatches): quando é um existente, o caller passa o
 * device.id do existente → upsert atualiza sem criar novo (§6/§7).
 */
export async function persistSurveyAsset(input: SurveyAssetInput): Promise<SurveyAssetResult> {
  if (!input.device.id) input.device.id = newAssetId();
  if (isOnline()) {
    const saved = await upsertDevice(input.device);
    if (input.verification) await addVerification({ ...input.verification, deviceId: saved.id });
    return { mode: 'online', device: saved };
  }
  const verification = input.verification ? { ...input.verification, id: newAssetId(), deviceId: input.device.id } : undefined;
  await enqueueTechAsset({ device: input.device, verification, ownerUserId: input.ownerUserId });
  return { mode: 'offline', device: input.device };
}
