/* ===================================================================
 * ETAPA 3D.4 — Ciclo de vida do ativo (motor PURO + orquestração).
 * A Base Técnica NÃO muda sozinha: o Atendimento gera EVIDÊNCIA e uma DECISÃO
 * confirmada pelo técnico (§2). Aqui o `planLifecycle` transforma a decisão em um
 * conjunto EXPLÍCITO e IDEMPOTENTE de operações (patch do ativo antigo, novo
 * ativo, verificações, patch do item). Determinístico dados os ids fornecidos —
 * o replay (online duplo/offline) produz o MESMO resultado (§23/§24).
 * Nunca infere substituição a partir de foto/status (§2).
 * =================================================================== */
import { Device, DeviceVerification, ServiceAttendanceEvidenceItem, AssetConditionValue } from './types';

export type AssetLifecycleDecision = 'MESMO' | 'SUBSTITUIDO' | 'REMOVIDO' | 'NAO_ALTERAR';

/** Sugere a decisão a partir da 0093 (equipamento substituído) — exige confirmação (§10). */
export function suggestDecision(item: Pick<ServiceAttendanceEvidenceItem, 'equipmentReplaced' | 'deviceId'>): AssetLifecycleDecision {
  if (item.equipmentReplaced) return 'SUBSTITUIDO';
  if (item.deviceId) return 'MESMO';
  return 'NAO_ALTERAR';
}

/** Identificadores NUNCA herdados sem confirmação (§15). */
export const NON_INHERITED_IDENTIFIER_ATTRS = ['ip', 'mac', 'canal', 'device_instance', 'modbus_id', 'zona', 'particao', 'porta', 'porta_controladora', 'descricao_programada'];

export interface ReplacementInput {
  newDeviceId: string;
  clienteId: string;
  finalCondition: AssetConditionValue;
  manufacturer?: string;
  model?: string;
  catalogItemId?: string;
  serial?: string;
  tipoAtivo?: string;
  grupo?: string;
  localizacao?: string;
  /** Identificadores CONFIRMADOS do novo ativo (§14): não são herdados às cegas. */
  central?: string;
  laco?: string;
  endereco?: string;
  technicalAttributes?: Record<string, unknown>;
}

/**
 * Constrói o NOVO ativo instalado (§13). Herda o que permanece aplicável
 * (cliente, sistema, pai, grupo/tipo, localização); NÃO herda serial nem
 * identificadores estruturais (§15) — esses vêm confirmados em `input`.
 */
export function buildReplacementDevice(oldDevice: Device, input: ReplacementInput): Device {
  return {
    id: input.newDeviceId,
    clienteId: input.clienteId,
    sistema: oldDevice.sistema,
    status: 'ativo',
    grupo: input.grupo ?? oldDevice.grupo,
    tipoAtivo: input.tipoAtivo ?? oldDevice.tipoAtivo,
    parentDeviceId: oldDevice.parentDeviceId,           // herda o pai (§15)
    localizacao: input.localizacao ?? oldDevice.localizacao,
    fabricante: input.manufacturer,
    modelo: input.model,
    itemCatalogoId: input.catalogItemId,
    serial: input.serial,                               // NÃO herda serial (§15)
    central: input.central,
    laco: input.laco,
    endereco: input.endereco,
    technicalAttributes: input.technicalAttributes || {},
    condicao: input.finalCondition,
    source: 'ATENDIMENTO',
  } as Device;
}

export interface LifecyclePlan {
  oldDevicePatch?: Partial<Device> & { id: string };
  newDevice?: Device;
  verifications: (Omit<DeviceVerification, 'id'> & { id: string })[];
  itemPatch: Partial<ServiceAttendanceEvidenceItem> & { id: string };
  /** Ativo cuja galeria/foto DEPOIS deve passar a referenciar (§31), quando houver. */
  photoRelinkDeviceId?: string;
}

export interface LifecycleInput {
  decision: AssetLifecycleDecision;
  item: Pick<ServiceAttendanceEvidenceItem, 'id' | 'deviceId'>;
  clienteId: string;
  oldDevice?: Device;                 // presente em MESMO/SUBSTITUIDO/REMOVIDO
  finalCondition: AssetConditionValue;
  serviceAttendanceId?: string;
  workOrderId?: string;
  timestampISO: string;
  verificationId: string;             // id de cliente (idempotência)
  notes?: string;
  replacement?: ReplacementInput;     // obrigatório quando SUBSTITUIDO
}

/**
 * Plano determinístico de atualização da Base a partir da decisão confirmada.
 * NAO_ALTERAR não muda nenhum ativo. Substituição desativa o antigo ANTES de
 * inserir o novo (o índice único parcial da 0029 exige isso).
 */
export function planLifecycle(input: LifecycleInput): LifecyclePlan {
  const base = {
    clienteId: input.clienteId,
    serviceAttendanceId: input.serviceAttendanceId,
    workOrderId: input.workOrderId,
    evidenceItemId: input.item.id,
    source: 'ATENDIMENTO' as const,
    verifiedAt: input.timestampISO,
  };
  const appliedItem = { id: input.item.id, baseUpdateDecision: input.decision, baseUpdateAppliedAt: input.timestampISO };

  if (input.decision === 'NAO_ALTERAR' || !input.oldDevice) {
    return { verifications: [], itemPatch: appliedItem };
  }

  if (input.decision === 'MESMO') {
    return {
      verifications: [{ ...base, id: input.verificationId, deviceId: input.oldDevice.id, condicao: input.finalCondition, reconciliation: 'ALTERADO', notes: input.notes }],
      itemPatch: appliedItem,
      photoRelinkDeviceId: undefined,
    };
  }

  if (input.decision === 'REMOVIDO') {
    return {
      oldDevicePatch: { id: input.oldDevice.id, status: 'removido', removedAt: input.timestampISO },
      verifications: [{ ...base, id: input.verificationId, deviceId: input.oldDevice.id, condicao: input.finalCondition, notes: input.notes || 'Removido sem substituição' }],
      itemPatch: appliedItem,
    };
  }

  // SUBSTITUIDO
  if (!input.replacement) throw new Error('Substituição requer os dados do novo ativo (replacement).');
  const newDevice = buildReplacementDevice(input.oldDevice, input.replacement);
  return {
    oldDevicePatch: { id: input.oldDevice.id, status: 'substituido', removedAt: input.timestampISO, replacedByDeviceId: newDevice.id },
    newDevice,
    verifications: [{ ...base, id: input.verificationId, deviceId: newDevice.id, condicao: input.replacement.finalCondition, reconciliation: 'NOVO', notes: input.notes }],
    itemPatch: { ...appliedItem, replacementDeviceId: newDevice.id },
    photoRelinkDeviceId: newDevice.id,
  };
}

/** Já aplicado? (idempotência §23): item com carimbo de aplicação não reprocessa. */
export function alreadyApplied(item: Pick<ServiceAttendanceEvidenceItem, 'baseUpdateAppliedAt'>): boolean {
  return !!item.baseUpdateAppliedAt;
}

/**
 * Plano MATERIALIZADO: o patch do ativo antigo vira um Device COMPLETO (merge
 * sobre o atual) para o upsert não zerar colunas. Fica serializável (offline).
 */
export interface MaterializedLifecycle {
  evidenceItemId: string;
  oldDeviceFull?: Device;
  newDevice?: Device;
  verifications: (Omit<DeviceVerification, 'id'> & { id: string })[];
  itemPatch: Partial<ServiceAttendanceEvidenceItem> & { id: string };
  photoRelinkDeviceId?: string;
}

export function materializePlan(plan: LifecyclePlan, oldDevice?: Device): MaterializedLifecycle {
  const oldDeviceFull = plan.oldDevicePatch && oldDevice
    ? { ...oldDevice, ...plan.oldDevicePatch }
    : undefined;
  return {
    evidenceItemId: plan.itemPatch.id,
    oldDeviceFull,
    newDevice: plan.newDevice,
    verifications: plan.verifications,
    itemPatch: plan.itemPatch,
    photoRelinkDeviceId: plan.photoRelinkDeviceId,
  };
}
