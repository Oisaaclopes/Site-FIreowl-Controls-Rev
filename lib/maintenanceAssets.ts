/* ===================================================================
 * MANUTENÇÃO CONTRATUAL (0106) — SELEÇÃO DE ATIVOS para manutenção.
 * Os ativos vêm SEMPRE de `devices` (Base Técnica canônica) — NÃO há segunda
 * base, NÃO se copia ativo para tabela de manutenção. Cruza cada device com a
 * política EFETIVA (pura) e o ÚLTIMO TESTE (device_verifications) para derivar
 * próximo teste e status (EM_DIA/PROXIMO/VENCIDO/SEM_POLITICA).
 *
 * `computeMaintenanceRows` é PURO/testável; `selectMaintenanceAssets` é o
 * wrapper de I/O que carrega devices + políticas + verificações e delega.
 * =================================================================== */
import type {
  AssetConditionValue,
  AssetMaintenancePolicy,
  Device,
  MaintenanceAssetRow,
  TechAreaValue,
} from './types';
import {
  assetContextFromDevice,
  maintenanceStatus,
  nextMaintenanceDate,
  parseDateUTC,
  diffDays,
  resolveEffectivePolicy,
} from './maintenancePolicies';
import { fetchDevices } from './devices';
import { fetchActiveMaintenancePolicies } from './assetMaintenancePolicies';
import { fetchLatestVerificationsForDevices } from './deviceVerifications';

/** Último teste de um ativo (derivado de device_verifications). */
export interface LastTestInfo {
  verifiedAt?: string;
  condicao?: AssetConditionValue;
}

export interface MaintenanceAssetsInput {
  clienteId: string;
  contratoId?: string | null;
  area?: TechAreaValue;
  referenceDate: string;                 // 'YYYY-MM-DD'
  proximoWindowDays?: number;
  /** Incluir ativos não-'ativo' (inativo/substituido/removido). Padrão: false. */
  includeInactiveAssets?: boolean;
}

/**
 * NÚCLEO PURO: para cada device, resolve política efetiva + último/próximo teste
 * + status. Determinístico; sem I/O. `lastTests` é um Map deviceId→último teste.
 */
export function computeMaintenanceRows(
  devices: Device[],
  policies: AssetMaintenancePolicy[],
  lastTests: Map<string, LastTestInfo>,
  input: Pick<MaintenanceAssetsInput, 'contratoId' | 'area' | 'referenceDate' | 'proximoWindowDays' | 'includeInactiveAssets'>
): MaintenanceAssetRow[] {
  const rows: MaintenanceAssetRow[] = [];
  for (const device of devices) {
    if (!input.includeInactiveAssets && device.status !== 'ativo') continue;
    if (input.area && device.sistema !== input.area) continue;

    const effective = resolveEffectivePolicy(
      assetContextFromDevice(device),
      input.contratoId ?? null,
      policies
    );
    const last = lastTests.get(device.id);
    const ultimoTeste = last?.verifiedAt;

    let proximoTeste: string | undefined;
    if (effective && ultimoTeste) {
      proximoTeste = nextMaintenanceDate(ultimoTeste, effective);
    }

    // SEM_POLITICA: sem política. SEM_HISTORICO: com política mas sem teste-base
    // (não afirmamos "vencido" sem data-base §1). Só com ambos calculamos vencimento.
    let status: MaintenanceAssetRow['status'];
    if (!effective) status = 'SEM_POLITICA';
    else if (!proximoTeste) status = 'SEM_HISTORICO';
    else status = maintenanceStatus(proximoTeste, input.referenceDate, effective.janelaToleranciaDias, input.proximoWindowDays);

    const diasParaVencer = proximoTeste
      ? diffDays(parseDateUTC(input.referenceDate), parseDateUTC(proximoTeste))
      : undefined;

    rows.push({
      device,
      policy: effective,
      ultimoTeste,
      ultimaCondicao: last?.condicao,
      proximoTeste,
      status,
      diasParaVencer,
    });
  }
  return rows;
}

/** Ordem operacional útil: VENCIDO → PROXIMO → SEM_POLITICA → EM_DIA; dentro do
 *  grupo, os mais atrasados primeiro. Puro (não muda o array de entrada). */
const STATUS_ORDER = { VENCIDO: 0, PROXIMO: 1, SEM_HISTORICO: 2, SEM_POLITICA: 3, EM_DIA: 4 } as const;
export function sortMaintenanceRows(rows: MaintenanceAssetRow[]): MaintenanceAssetRow[] {
  return [...rows].sort((a, b) => {
    const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (s !== 0) return s;
    return (a.diasParaVencer ?? Infinity) - (b.diasParaVencer ?? Infinity);
  });
}

/**
 * WRAPPER de I/O: carrega devices (Base canônica) + políticas ativas + últimos
 * testes e delega ao núcleo puro. Não duplica ativos; só lê e cruza.
 */
export async function selectMaintenanceAssets(input: MaintenanceAssetsInput): Promise<MaintenanceAssetRow[]> {
  const devices = await fetchDevices(input.clienteId);
  const relevant = devices.filter(
    (d) => (input.includeInactiveAssets || d.status === 'ativo') && (!input.area || d.sistema === input.area)
  );
  const [policies, lastTests] = await Promise.all([
    fetchActiveMaintenancePolicies(),
    fetchLatestVerificationsForDevices(relevant.map((d) => d.id)),
  ]);
  const lastMap = new Map<string, LastTestInfo>();
  lastTests.forEach((v, deviceId) => lastMap.set(deviceId, { verifiedAt: v.verifiedAt, condicao: v.condicao }));
  return sortMaintenanceRows(computeMaintenanceRows(relevant, policies, lastMap, input));
}
