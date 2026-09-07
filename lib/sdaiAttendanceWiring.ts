/* ===================================================================
 * WIRING OPERACIONAL DO ATENDIMENTO SDAI — orquestra o motor já pronto ao fluxo
 * real. PURO onde decide; I/O FINO onde persiste (reusa addVerification/
 * insertPendencia — ambos upsert por id → idempotentes). NÃO cria estrutura
 * paralela; a Base é `devices`, os dispositivos vêm do MaintenancePeriodPlan.
 * =================================================================== */
import type {
  ContractRoutine,
  Device,
  DeviceVerification,
  MaintenancePeriodPlan,
  Pendencia,
} from './types';
import {
  PREVENTIVA_SDAI_CONTRATO_CODIGO,
  SdaiDeviceResult,
  buildDeviceVerificationFromResult,
  findEquivalentOpenPendencia,
  mapDeviceResultToCondicao,
  resultFromLabel,
  resultOpensPendencia,
  shouldCreatePendencia,
} from './sdaiMaintenance';
import { classifyTestResult } from './maintenanceCoverage';

/* --------------------------- Resolução de contexto (§2/§3) ----------------- */

/** Código de template do atendimento: o da rotina; fallback ao SDAI contratual
 *  quando a rotina é SDAI e nada foi configurado. undefined se indeterminado. */
export function resolveAttendanceTemplateCodigo(routine?: Pick<ContractRoutine, 'templateCodigo' | 'area'>): string | undefined {
  if (routine?.templateCodigo) return routine.templateCodigo;
  if (routine?.area === 'SDAI') return PREVENTIVA_SDAI_CONTRATO_CODIGO;
  return undefined;
}

/**
 * Rotina preventiva SDAI contratual aplicável: ativa, área SDAI, tipo preventiva
 * e que resolve para PREVENTIVA_SDAI_CONTRATO. NÃO casa corretiva/inspeção nem
 * outro template (evita classificar corretiva como preventiva). PURO.
 */
export function resolveSdaiPreventiveRoutine<T extends Pick<ContractRoutine, 'area' | 'tipo' | 'ativo' | 'templateCodigo'>>(
  routines: T[]
): T | undefined {
  return routines.find((r) =>
    r.ativo !== false &&
    r.area === 'SDAI' &&
    (r.tipo || 'preventiva') === 'preventiva' &&
    resolveAttendanceTemplateCodigo(r) === PREVENTIVA_SDAI_CONTRATO_CODIGO
  );
}

/**
 * O CTA de manutenção preventiva SDAI deve aparecer? Só quando: SDAI, com
 * contrato/cliente, a OS NÃO é corretiva/instalação, e existe rotina preventiva
 * contratual aplicável (§2). Um atendimento corretivo SDAI NÃO ativa o CTA só
 * por ser SDAI. PURO/testável.
 */
export function sdaiPreventiveApplies(input: {
  isSdai: boolean;
  osTipo?: string;
  contratoId?: string | null;
  clienteId?: string | null;
  routines: Array<Pick<ContractRoutine, 'area' | 'tipo' | 'ativo' | 'templateCodigo'>>;
}): boolean {
  if (!input.isSdai || !input.contratoId || !input.clienteId) return false;
  if (input.osTipo && input.osTipo !== 'preventiva') return false; // corretiva/instalação/outro → não
  return !!resolveSdaiPreventiveRoutine(input.routines);
}

/* --------------------------- Idempotência (§10/§16) ------------------------ */

/**
 * Id ESTÁVEL da verificação = 1 ato técnico (atendimento × device). Autosave,
 * reabertura e replay offline reusam o MESMO id → addVerification faz upsert e
 * nunca duplica. (Trocar o resultado do device no mesmo atendimento sobrescreve
 * a mesma linha — é o mesmo ato, corrigido.)
 */
export function stableVerificationId(serviceAttendanceId: string, deviceId: string): string {
  return `av:${serviceAttendanceId}:${deviceId}`;
}

/** Id estável da pendência auto-gerada por (atendimento × device × grupo) —
 *  evita duplicar no MESMO atendimento em re-salvamentos. O dedupe ENTRE
 *  atendimentos/meses usa findEquivalentOpenPendencia. */
export function stableAutoPendenciaId(serviceAttendanceId: string, deviceId: string, grupo: string): string {
  return `ap:${serviceAttendanceId}:${deviceId}:${grupo}`;
}

/* --------------------------- Persistência de resultado (§10/§11) ----------- */

/**
 * Constrói a verificação a persistir para um resultado de device, com id ESTÁVEL
 * (idempotente). Retorna null para REMOVIDO (ciclo de vida, não verificação).
 * PURO — a persistência (addVerification) é feita pela camada de dados/offline.
 */
export function buildAttendanceVerification(input: {
  serviceAttendanceId: string;
  deviceId: string;
  clienteId?: string;
  result: SdaiDeviceResult;
  notes?: string;
  verifiedAt?: string;
}): (Omit<DeviceVerification, 'id'> & { id: string }) | null {
  const base = buildDeviceVerificationFromResult({
    deviceId: input.deviceId, result: input.result, clienteId: input.clienteId,
    serviceAttendanceId: input.serviceAttendanceId, notes: input.notes, verifiedAt: input.verifiedAt,
  });
  if (!base) return null;
  return { ...base, id: stableVerificationId(input.serviceAttendanceId, input.deviceId) };
}

/** Persiste a verificação (I/O fino idempotente). Retorna a verificação ou null. */
export async function persistDeviceResult(input: Parameters<typeof buildAttendanceVerification>[0]): Promise<DeviceVerification | null> {
  const v = buildAttendanceVerification(input);
  if (!v) return null; // REMOVIDO → tratar por reconciliação/ciclo de vida
  const { addVerification } = await import('./deviceVerifications');
  return addVerification(v);
}

/* --------------------------- Pendências (§12) ------------------------------ */

export interface AutoPendenciaInput {
  clienteId?: string;
  contratoId?: string;
  serviceAttendanceId: string;
  reportOrigemId?: string;
  deviceId?: string;
  grupo?: string;
  descricao?: string;
  acaoRecomendada?: Pendencia['acaoRecomendada'];
  local?: string;
}

/**
 * Cria a pendência SÓ se não houver equivalente ABERTA (§12); senão devolve a
 * existente (relacionar/reutilizar, sem duplicar mês a mês). I/O fino sobre a
 * entidade Pendências existente. Id estável evita duplicar em re-salvamento.
 */
export async function createOrReuseDevicePendencia(input: AutoPendenciaInput): Promise<Pendencia> {
  const { fetchPendencias, insertPendencia } = await import('./pendencias');
  const existentes = await fetchPendencias('GESTOR', { clienteId: input.clienteId });
  const equivalente = findEquivalentOpenPendencia(existentes, {
    clienteId: input.clienteId, deviceId: input.deviceId, grupo: input.grupo,
    acaoRecomendada: input.acaoRecomendada, descricao: input.descricao,
  });
  if (equivalente) return equivalente; // reutiliza a aberta — não duplica
  const nova: Pendencia = {
    id: input.deviceId && input.grupo ? stableAutoPendenciaId(input.serviceAttendanceId, input.deviceId, input.grupo) : (undefined as unknown as string),
    clienteId: input.clienteId, deviceId: input.deviceId, grupo: input.grupo,
    descricao: input.descricao, acaoRecomendada: input.acaoRecomendada, local: input.local,
    status: 'aberta',
  };
  return insertPendencia(nova);
}

/* --------------------------- Cobertura em andamento (§17) ------------------ */

export interface AttendanceCoverageLive {
  planejados: number;
  testadosProgramados: number;
  naoTestados: number;
  testadosExtras: number;
  aprovados: number;
  falharam: number;
}

/** Conclusivo = APROVADO|FALHA (mesma regra do consolidado, via classify). */
function isConclusive(result: SdaiDeviceResult): boolean {
  const c = mapDeviceResultToCondicao(result);
  if (!c) return false;
  const cls = classifyTestResult(c);
  return cls === 'APROVADO' || cls === 'FALHA';
}

/**
 * Cobertura DERIVADA em tempo real do plano + resultados reais do atendimento
 * (nunca digitada §17). `resultsByDevice`: device_id → resultado escolhido.
 * Consistente com computeMaintenanceCoverage (mesma classificação).
 */
export function coverageInProgress(
  plan: Pick<MaintenancePeriodPlan, 'programadosDeviceIds'>,
  resultsByDevice: Map<string, SdaiDeviceResult>
): AttendanceCoverageLive {
  const planned = new Set(plan.programadosDeviceIds);
  let testadosProgramados = 0, testadosExtras = 0, aprovados = 0, falharam = 0;
  for (const [deviceId, result] of resultsByDevice) {
    if (!isConclusive(result)) continue;
    const cls = classifyTestResult(mapDeviceResultToCondicao(result)!);
    if (planned.has(deviceId)) testadosProgramados++; else testadosExtras++;
    if (cls === 'APROVADO') aprovados++; else falharam++;
  }
  return {
    planejados: planned.size,
    testadosProgramados,
    naoTestados: Math.max(0, planned.size - testadosProgramados),
    testadosExtras,
    aprovados,
    falharam,
  };
}

/* --------------------------- Finalização (§18/§19) ------------------------- */

export type FinalizationIssueCode =
  | 'CENTRAL_CHECKLIST_PENDENTE'
  | 'FOTO_GERAL_OBRIGATORIA'
  | 'ASSINATURA_OBRIGATORIA'
  | 'PLANEJADO_SEM_ESTADO';

export interface FinalizationIssue { code: FinalizationIssueCode; deviceId?: string }

/**
 * Portão de finalização (§18/§19): NÃO exige tudo aprovado — falhas/pendências
 * são resultado válido. Bloqueia só o essencial: checklist da central quando
 * exigido, foto geral, assinatura, e todo device PLANEJADO precisa ter ALGUM
 * estado (resultado — inclusive "não testado", que já carrega o motivo). Um
 * planejado com resultado NAO_* (com motivo) NÃO bloqueia → 79/82 finaliza.
 */
export function finalizationGate(input: {
  plan: Pick<MaintenancePeriodPlan, 'programadosDeviceIds'>;
  resultsByDevice: Map<string, SdaiDeviceResult>;
  centralRequired: boolean;
  centralChecklistDone: boolean;
  fotoGeralPresent: boolean;
  assinaturaPresent: boolean;
}): { canFinalize: boolean; issues: FinalizationIssue[] } {
  const issues: FinalizationIssue[] = [];
  if (input.centralRequired && !input.centralChecklistDone) issues.push({ code: 'CENTRAL_CHECKLIST_PENDENTE' });
  if (!input.fotoGeralPresent) issues.push({ code: 'FOTO_GERAL_OBRIGATORIA' });
  if (!input.assinaturaPresent) issues.push({ code: 'ASSINATURA_OBRIGATORIA' });
  for (const deviceId of input.plan.programadosDeviceIds) {
    if (!input.resultsByDevice.has(deviceId)) issues.push({ code: 'PLANEJADO_SEM_ESTADO', deviceId });
  }
  return { canFinalize: issues.length === 0, issues };
}

/** Devices (Base) a injetar no checklist_dispositivos = só os planejados (§4). */
export function attendancePlanDevices(plan: MaintenancePeriodPlan, devices: Device[]): Device[] {
  const planned = new Set(plan.programadosDeviceIds);
  return devices.filter((d) => planned.has(d.id));
}

/* --------------------------- Parse do checklist do form -------------------- */

/** Card do checklist_dispositivos do template SDAI (campos que interessam). */
export interface SdaiChecklistCard {
  device_id?: string;
  resultado?: string;     // rótulo (SDAI_DEVICE_RESULT_OPCOES)
  observacao?: string;
  renomear?: string;
  endereco_confere?: string;
  descricao_confere?: string;
  [k: string]: unknown;
}

export interface ParsedDeviceResult { deviceId: string; result: SdaiDeviceResult; notes?: string; renomear?: boolean; divergencia?: boolean }

/**
 * Extrai resultados por device dos cards do checklist (PURO). Só cards com
 * device_id e resultado reconhecível entram (rótulo → SdaiDeviceResult). Marca
 * divergência (endereço/descrição não confere) e pedido de renome — SEM alterar
 * a Base (§13): fica como dado do atendimento/reconciliação.
 */
export function parseSdaiChecklistResults(cards: SdaiChecklistCard[]): ParsedDeviceResult[] {
  const out: ParsedDeviceResult[] = [];
  for (const c of cards) {
    const deviceId = c.device_id ? String(c.device_id) : '';
    if (!deviceId || !c.resultado) continue;
    const result = resultFromLabel(String(c.resultado));
    if (!result) continue;
    out.push({
      deviceId, result,
      notes: c.observacao ? String(c.observacao) : undefined,
      renomear: c.renomear === 'Sim',
      divergencia: c.endereco_confere === 'Não' || c.descricao_confere === 'Não',
    });
  }
  return out;
}

/* --------------------------- Finalização do atendimento SDAI --------------- */

export interface MaintenanceAttendanceContext {
  serviceAttendanceId: string;
  clienteId?: string;
  contratoId?: string;
  reportOrigemId?: string;
  plan?: Pick<MaintenancePeriodPlan, 'programadosDeviceIds'>;
}

export interface MaintenanceFinalizeSummary {
  verifications: number;
  pendencias: number;
  coverage?: AttendanceCoverageLive;
}

/**
 * Orquestra a persistência de manutenção ao finalizar o atendimento SDAI (§5/§6/
 * §7/§17): grava device_verifications idempotentes por device e cria/reutiliza
 * pendências (sem duplicar), devolvendo a cobertura. Só para o template
 * contratual — o chamador gateia por template_codigo. I/O fino; reusa o motor.
 */
export async function finalizeMaintenanceAttendance(
  ctx: MaintenanceAttendanceContext,
  results: ParsedDeviceResult[]
): Promise<MaintenanceFinalizeSummary> {
  let verifications = 0;
  let pendencias = 0;
  const resultsByDevice = new Map<string, SdaiDeviceResult>();
  for (const r of results) {
    resultsByDevice.set(r.deviceId, r.result);
    const v = await persistDeviceResult({
      serviceAttendanceId: ctx.serviceAttendanceId, deviceId: r.deviceId, clienteId: ctx.clienteId,
      result: r.result, notes: r.notes,
    });
    if (v) verifications++;
    if (resultOpensPendencia(r.result)) {
      await createOrReuseDevicePendencia({
        clienteId: ctx.clienteId, contratoId: ctx.contratoId, serviceAttendanceId: ctx.serviceAttendanceId,
        reportOrigemId: ctx.reportOrigemId, deviceId: r.deviceId, grupo: 'SDAI',
        descricao: r.notes, acaoRecomendada: 'investigar',
      });
      pendencias++;
    }
  }
  const coverage = ctx.plan ? coverageInProgress(ctx.plan, resultsByDevice) : undefined;
  return { verifications, pendencias, coverage };
}
