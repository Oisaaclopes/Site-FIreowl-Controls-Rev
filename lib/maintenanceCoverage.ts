/* ===================================================================
 * MANUTENÇÃO CONTRATUAL (0106) — COBERTURA do período (§19). PURO/testável.
 * Fonte: devices (Base) + política efetiva + device_verifications + intervalo.
 * NUNCA números digitados. "Total da Base" ≠ "programados no período".
 *
 * Programado no período = o ativo (com política) era PREVISTO para teste até o
 * fim da janela — vencia até period_end (a partir do último teste ANTES da
 * janela) OU teve alguma verificação DENTRO da janela (foi visitado). Assim,
 * testar cedo/ad-hoc não distorce, e cobertura = testados/programados ≤ 1.
 * =================================================================== */
import type {
  AssetConditionValue,
  AssetMaintenancePolicy,
  Device,
  DeviceVerification,
  MaintenanceCoverage,
  TestResultClass,
} from './types';
import { assetContextFromDevice, nextMaintenanceDate, resolveEffectivePolicy } from './maintenancePolicies';

/**
 * Normaliza device_verifications.condicao (enum REAL da 0095, sem inventar) na
 * classe de resultado do domínio:
 *  - APROVADO  ← NORMAL
 *  - FALHA     ← COM_AVARIA | INOPERANTE | INADEQUADO
 *  - NAO_TESTADO ← NAO_TESTADO | NAO_LOCALIZADO (não houve teste conclusivo)
 * NAO_LOCALIZADO é agrupado em NAO_TESTADO de propósito: não é aprovação nem
 * falha do equipamento — é ausência de teste conclusivo (lacuna documentada).
 */
export function classifyTestResult(condicao: AssetConditionValue | string | undefined): TestResultClass {
  switch (condicao) {
    case 'NORMAL':
      return 'APROVADO';
    case 'COM_AVARIA':
    case 'INOPERANTE':
    case 'INADEQUADO':
      return 'FALHA';
    case 'NAO_TESTADO':
    case 'NAO_LOCALIZADO':
    default:
      return 'NAO_TESTADO';
  }
}

const dateOnly = (v?: string): string | undefined => (v ? String(v).slice(0, 10) : undefined);

export interface CoverageInput {
  contractId?: string | null;
  periodStart: string;
  periodEnd: string;
  /** Filtro de área opcional (ex.: cobertura só de SDAI). */
  area?: string;
  includeInactiveAssets?: boolean;
}

/** Última verificação (por verified_at) de uma lista, ou undefined. */
function latest(verifs: DeviceVerification[]): DeviceVerification | undefined {
  let best: DeviceVerification | undefined;
  for (const v of verifs) {
    if (!best || (v.verifiedAt ?? '') > (best.verifiedAt ?? '')) best = v;
  }
  return best;
}

/**
 * NÚCLEO PURO da cobertura. `verificationsByDevice` deve conter as verificações
 * conhecidas de cada ativo (idealmente todas com verified_at ≤ period_end).
 */
export function computeMaintenanceCoverage(
  devices: Device[],
  policies: AssetMaintenancePolicy[],
  verificationsByDevice: Map<string, DeviceVerification[]>,
  input: CoverageInput
): MaintenanceCoverage {
  const start = dateOnly(input.periodStart)!;
  const end = dateOnly(input.periodEnd)!;

  const scope = devices.filter(
    (d) => (input.includeInactiveAssets || d.status === 'ativo') && (!input.area || d.sistema === input.area)
  );

  let totalComPolitica = 0;
  let semPolitica = 0;
  let semHistorico = 0;
  let programados = 0;
  let testados = 0;
  let aprovados = 0;
  let falharam = 0;

  for (const d of scope) {
    const effective = resolveEffectivePolicy(assetContextFromDevice(d), input.contractId ?? null, policies);
    if (!effective) { semPolitica++; continue; }
    totalComPolitica++;

    const verifs = verificationsByDevice.get(d.id) ?? [];
    if (verifs.length === 0) semHistorico++;

    const before = verifs.filter((v) => { const dd = dateOnly(v.verifiedAt); return dd != null && dd < start; });
    const inPeriod = verifs.filter((v) => { const dd = dateOnly(v.verifiedAt); return dd != null && dd >= start && dd <= end; });

    // Vencia até o fim do período? (a partir do último teste ANTES da janela;
    // sem histórico prévio → precisa de teste-base = considerado previsto.)
    const lastBefore = latest(before);
    const due = lastBefore
      ? nextMaintenanceDate(lastBefore.verifiedAt!, effective) <= end
      : true;
    const visited = inPeriod.length > 0;
    const programado = due || visited;
    if (programado) programados++;

    // Resultado conclusivo = última verificação DENTRO da janela com APROVADO/FALHA.
    const latestIn = latest(inPeriod);
    const resultado = latestIn ? classifyTestResult(latestIn.condicao) : undefined;
    if (resultado === 'APROVADO') { testados++; aprovados++; }
    else if (resultado === 'FALHA') { testados++; falharam++; }
    // NAO_TESTADO (ou sem verificação na janela) não conta como testado.
  }

  const totalBase = scope.length;
  const naoTestados = Math.max(0, programados - testados);
  const pct = (num: number, den: number): number | null => (den > 0 ? num / den : null);

  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    totalBase,
    totalComPolitica,
    semPolitica,
    semHistorico,
    programadosPeriodo: programados,
    testadosPeriodo: testados,
    aprovadosPeriodo: aprovados,
    falharamPeriodo: falharam,
    naoTestadosPeriodo: naoTestados,
    coberturaProgramadosPct: pct(testados, programados),
    coberturaBasePct: pct(testados, totalComPolitica),
    aprovacaoPct: pct(aprovados, testados),
  };
}

/** Agrupa verificações por deviceId (helper para montar o input do núcleo). */
export function groupVerificationsByDevice(verifs: DeviceVerification[]): Map<string, DeviceVerification[]> {
  const map = new Map<string, DeviceVerification[]>();
  for (const v of verifs) {
    const arr = map.get(v.deviceId);
    if (arr) arr.push(v); else map.set(v.deviceId, [v]);
  }
  return map;
}

/**
 * WRAPPER de I/O: carrega devices (Base) + políticas ativas + verificações até
 * o fim da janela e delega ao núcleo puro. Aceita a mesma janela do consolidado
 * (mensal) ou uma janela maior (acumulado do ano/contrato) — sem hard-code de
 * "ano": quem chama passa [periodStart, periodEnd] explícito.
 */
export async function fetchMaintenanceCoverage(
  clienteId: string,
  input: CoverageInput
): Promise<MaintenanceCoverage> {
  const { fetchDevices } = await import('./devices');
  const { fetchActiveMaintenancePolicies } = await import('./assetMaintenancePolicies');
  const { fetchVerificationsForDevicesUpTo } = await import('./deviceVerifications');
  const devices = await fetchDevices(clienteId);
  const scope = devices.filter(
    (d) => (input.includeInactiveAssets || d.status === 'ativo') && (!input.area || d.sistema === input.area)
  );
  const [policies, verifs] = await Promise.all([
    fetchActiveMaintenancePolicies(),
    fetchVerificationsForDevicesUpTo(scope.map((d) => d.id), input.periodEnd),
  ]);
  return computeMaintenanceCoverage(devices, policies, groupVerificationsByDevice(verifs), input);
}
