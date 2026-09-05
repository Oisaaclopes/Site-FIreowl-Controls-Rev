/* ===================================================================
 * ETAPA 3D.4 — Aplicação do ciclo de vida do ativo (I/O + online/offline).
 * Executa um plano MATERIALIZADO de forma idempotente. Online: grava direto.
 * Offline: enfileira no outbox (chave = evidence_item) para replay único (§24).
 * Ordem crítica na substituição: DESATIVA o antigo ANTES de inserir o novo — o
 * índice único parcial de `devices` (cliente/central/laço/endereço where ativo)
 * bloquearia dois ativos no mesmo endereço.
 * =================================================================== */
import { MaterializedLifecycle } from './assetLifecycle';
import { upsertDevice } from './devices';
import { addVerification } from './deviceVerifications';
import { updateEvidenceItem } from './evidenceItems';
import { relinkAfterPhotosToDevice } from './fieldPhotos';
import { isOnline } from './offline/reportSync';
import { enqueueAssetLifecycle } from './offline/technicalBaseSync';

/** Aplica o plano materializado no banco (idempotente por ids fornecidos). */
export async function applyMaterialized(m: MaterializedLifecycle): Promise<void> {
  // 1) Antigo primeiro (substituído/removido) — libera o índice único p/ o novo.
  if (m.oldDeviceFull) await upsertDevice(m.oldDeviceFull);
  // 2) Novo ativo (substituição).
  if (m.newDevice) await upsertDevice(m.newDevice);
  // 3) Verificações (upsert por id → replay não duplica histórico).
  for (const v of m.verifications) await addVerification(v);
  // 4) Item: decisão + vínculo + carimbo de aplicação (idempotência).
  await updateEvidenceItem(m.itemPatch.id, m.itemPatch);
  // 5) Foto DEPOIS passa a referenciar o novo ativo (best-effort, §31).
  if (m.photoRelinkDeviceId) {
    try { await relinkAfterPhotosToDevice(m.evidenceItemId, m.photoRelinkDeviceId); } catch { /* não bloqueia */ }
  }
}

export interface PersistLifecycleResult { mode: 'online' | 'offline' }

/** Online: aplica já. Offline: enfileira (replay único, sem duplicar §24). */
export async function persistLifecycle(m: MaterializedLifecycle, ownerUserId?: string): Promise<PersistLifecycleResult> {
  if (isOnline()) { await applyMaterialized(m); return { mode: 'online' }; }
  await enqueueAssetLifecycle({ materialized: m, ownerUserId });
  return { mode: 'offline' };
}
