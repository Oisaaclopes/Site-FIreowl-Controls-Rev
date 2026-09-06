/* ===================================================================
 * PLANO DE MANUTENÇÃO por período — visão de DOMÍNIO derivada (SEM tabela nova,
 * SEM maintenance_plans/maintenance_cycles). Deriva de:
 *   contrato + contract_routines + contract_routine_executions +
 *   asset_maintenance_policies + devices (Base canônica — nunca duplicada).
 *
 * Responsabilidades:
 *  - quais ativos precisam ser testados numa janela (programados);
 *  - qual rotina/template se aplica (contract_routines.area + template_codigo);
 *  - SEM_HISTORICO: 1º teste PLANEJADO só quando a rotina tem execução na janela
 *    (âncora REAL = contract_routine_executions.data_programada) — nunca inventa data;
 *  - separa PROGRAMADO / VENCIDO / PRÓXIMO / PRIMEIRO_TESTE / EXTRA via status
 *    técnico + status de planejamento (domínio calculado, não enum de banco);
 *  - conflito entre rotinas para o mesmo device → diagnóstico explícito (§11).
 *
 * Periodicidade e precedência: REUSA resolveEffectivePolicy + nextMaintenanceDate.
 * Membership por DATAS reais (period_start/period_end e data_programada), nunca
 * por igualdade de `competencia`.
 * =================================================================== */
import type {
  AssetMaintenancePolicy,
  ContractRoutine,
  ContractRoutineExecution,
  Device,
  MaintenancePeriodPlan,
  MaintenancePlanAsset,
  MaintenancePlanConflict,
  MaintenancePlanningReason,
  MaintenancePlanningStatus,
  MaintenanceAssetStatus,
} from './types';
import {
  assetContextFromDevice,
  maintenanceStatus,
  nextMaintenanceDate,
  resolveEffectivePolicy,
} from './maintenancePolicies';
import type { LastTestInfo } from './maintenanceAssets';

const dateOnly = (v?: string): string | undefined => (v ? String(v).slice(0, 10) : undefined);
const inWindow = (v: string | undefined, start: string, end: string): boolean => {
  const d = dateOnly(v);
  return d != null && d >= dateOnly(start)! && d <= dateOnly(end)!;
};

/** Ativos da Base aplicáveis a uma rotina (§4): por ÁREA canônica (único filtro
 *  disponível hoje em contract_routines) e status 'ativo'. area nula = todas.
 *  NÃO duplica taxonomia; usa devices.sistema. */
export function resolveRoutineAssets(routine: ContractRoutine, devices: Device[]): Device[] {
  return devices.filter(
    (d) => d.status === 'ativo' && (routine.area == null || d.sistema === routine.area)
  );
}

export interface MaintenancePlanInput {
  contractId: string;
  periodStart: string;
  periodEnd: string;
  routines: ContractRoutine[];
  executions: ContractRoutineExecution[];
  devices: Device[];
  policies: AssetMaintenancePolicy[];
  lastTests: Map<string, LastTestInfo>;
  proximoWindowDays?: number;
}

interface RoutineCtx {
  routine: ContractRoutine;
  scheduledInPeriod: boolean;
  executionIds: string[];
  plannedDate?: string;   // menor data_programada na janela (âncora do 1º teste)
}

/**
 * NÚCLEO PURO: monta o plano do período. Determinístico; sem I/O.
 */
export function buildMaintenancePeriodPlan(input: MaintenancePlanInput): MaintenancePeriodPlan {
  const active = input.routines.filter((r) => r.ativo !== false);

  // Contexto de agenda por rotina (execuções na janela).
  const routineCtx = new Map<string, RoutineCtx>();
  for (const routine of active) {
    const execs = input.executions.filter(
      (e) => e.routineId === routine.id && inWindow(e.dataProgramada, input.periodStart, input.periodEnd)
    );
    const datas = execs.map((e) => dateOnly(e.dataProgramada)!).filter(Boolean).sort();
    routineCtx.set(routine.id, {
      routine,
      scheduledInPeriod: execs.length > 0,
      executionIds: execs.map((e) => e.id),
      plannedDate: datas[0],
    });
  }

  // Aplicabilidade device → rotinas (por área).
  const deviceRoutines = new Map<string, RoutineCtx[]>();
  for (const routine of active) {
    const ctx = routineCtx.get(routine.id)!;
    for (const d of resolveRoutineAssets(routine, input.devices)) {
      const arr = deviceRoutines.get(d.id);
      if (arr) arr.push(ctx); else deviceRoutines.set(d.id, [ctx]);
    }
  }

  const deviceById = new Map(input.devices.map((d) => [d.id, d] as const));
  const assets: MaintenancePlanAsset[] = [];
  const conflicts: MaintenancePlanConflict[] = [];

  for (const [deviceId, ctxs] of deviceRoutines) {
    const device = deviceById.get(deviceId)!;

    // Status técnico (reusa periodicidade/precedência), na virada do fim do período.
    const effective = resolveEffectivePolicy(assetContextFromDevice(device), input.contractId, input.policies);
    const lastTestAt = input.lastTests.get(deviceId)?.verifiedAt;
    const nextTestAt = effective && lastTestAt ? nextMaintenanceDate(lastTestAt, effective) : undefined;
    let technicalStatus: MaintenanceAssetStatus;
    if (!effective) technicalStatus = 'SEM_POLITICA';
    else if (!nextTestAt) technicalStatus = 'SEM_HISTORICO';
    else technicalStatus = maintenanceStatus(nextTestAt, input.periodEnd, effective.janelaToleranciaDias, input.proximoWindowDays);

    const scheduled = ctxs.filter((c) => c.scheduledInPeriod);
    const conflict = scheduled.length > 1;
    if (conflict) conflicts.push({ deviceId, routineIds: scheduled.map((c) => c.routine.id) });

    // Rotina associada (contexto/template): 1 agendada, senão 1 aplicável, senão nenhuma.
    const chosen = scheduled.length === 1 ? scheduled[0] : (ctxs.length === 1 ? ctxs[0] : undefined);
    const routineId = conflict ? undefined : chosen?.routine.id;
    const templateCodigo = conflict ? undefined : chosen?.routine.templateCodigo;

    let planningStatus: MaintenancePlanningStatus;
    let reason: MaintenancePlanningReason;
    let plannedFirstTest: string | undefined;

    if (!effective) {
      planningStatus = 'NAO_PROGRAMADO'; reason = 'SEM_POLITICA';
    } else if (technicalStatus === 'SEM_HISTORICO') {
      if (scheduled.length >= 1) {
        planningStatus = 'PROGRAMADO_PRIMEIRO_TESTE'; reason = 'PRIMEIRO_TESTE_PLANEJADO';
        plannedFirstTest = scheduled.map((c) => c.plannedDate).filter(Boolean).sort()[0];
      } else {
        planningStatus = 'PRIMEIRO_TESTE_PENDENTE'; reason = 'ROTINA_NAO_PROGRAMADA_NO_PERIODO';
      }
    } else {
      // Tem histórico → decide por vencimento + agenda da rotina.
      const dueByEnd = !!nextTestAt && dateOnly(nextTestAt)! <= dateOnly(input.periodEnd)!;
      if (dueByEnd && scheduled.length >= 1) {
        planningStatus = 'PROGRAMADO_PERIODO';
        reason = dateOnly(nextTestAt)! < dateOnly(input.periodStart)! ? 'JA_VENCIDO_ANTES_DO_PERIODO' : 'PERIODICIDADE_VENCE_NO_PERIODO';
      } else if (dueByEnd) {
        planningStatus = 'NAO_PROGRAMADO'; reason = 'ROTINA_NAO_PROGRAMADA_NO_PERIODO';
      } else {
        planningStatus = 'NAO_PROGRAMADO'; reason = 'FORA_DA_JANELA';
      }
    }

    assets.push({
      deviceId, sistema: device.sistema, routineId, templateCodigo,
      effectivePolicyId: effective?.policyId, technicalStatus, planningStatus,
      lastTestAt, nextTestAt, plannedFirstTest, reason, conflict: conflict || undefined,
    });
  }

  const programadosDeviceIds = assets
    .filter((a) => a.planningStatus === 'PROGRAMADO_PERIODO' || a.planningStatus === 'PROGRAMADO_PRIMEIRO_TESTE')
    .map((a) => a.deviceId);

  const routines = active.map((r) => {
    const ctx = routineCtx.get(r.id)!;
    return {
      routineId: r.id, area: r.area, templateCodigo: r.templateCodigo, frequencia: r.frequencia,
      scheduledInPeriod: ctx.scheduledInPeriod, executionIds: ctx.executionIds,
    };
  });

  return {
    contractId: input.contractId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    routines,
    devices: assets,
    conflicts,
    programadosDeviceIds,
  };
}

/**
 * WRAPPER de I/O: carrega rotinas + execuções + devices + políticas + últimos
 * testes e delega ao núcleo puro. Não cria base paralela; só lê e cruza.
 */
export async function fetchMaintenancePeriodPlan(input: {
  contractId: string;
  clienteId: string;
  periodStart: string;
  periodEnd: string;
  proximoWindowDays?: number;
}): Promise<MaintenancePeriodPlan> {
  const { fetchContractRoutines, fetchRoutineExecutions } = await import('./contractRoutines');
  const { fetchDevices } = await import('./devices');
  const { fetchActiveMaintenancePolicies } = await import('./assetMaintenancePolicies');
  const { fetchLatestVerificationsForDevices } = await import('./deviceVerifications');

  const [routines, executions, devices, policies] = await Promise.all([
    fetchContractRoutines(input.contractId),
    fetchRoutineExecutions(input.contractId),
    fetchDevices(input.clienteId),
    fetchActiveMaintenancePolicies(),
  ]);
  const lastVerifs = await fetchLatestVerificationsForDevices(devices.map((d) => d.id));
  const lastTests = new Map<string, LastTestInfo>();
  lastVerifs.forEach((v, deviceId) => lastTests.set(deviceId, { verifiedAt: v.verifiedAt, condicao: v.condicao }));

  return buildMaintenancePeriodPlan({
    contractId: input.contractId, periodStart: input.periodStart, periodEnd: input.periodEnd,
    routines, executions, devices, policies, lastTests, proximoWindowDays: input.proximoWindowDays,
  });
}
