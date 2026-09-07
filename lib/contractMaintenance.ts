/* ===================================================================
 * INÍCIO DO ATENDIMENTO CONTRATUAL (manutenção recorrente) — SEM OS manual.
 * O schema exige service_attendances.work_order_id (NOT NULL, 0083); a OS é
 * gerada AUTOMATICAMENTE e idempotente a partir da execução da rotina
 * (generate_os_from_execution, 0057). O usuário NÃO cria OS manualmente.
 *
 * Fluxo idempotente: rotina → ensureRoutineExecution(competência) →
 * generateOsFromExecution → reutiliza/cria service_attendance. Reusa entidades
 * existentes; NÃO cria maintenance_cycles. Sem migration.
 * =================================================================== */
import type { ContractRoutine, ServiceAttendance } from './types';
import { competenciaDe, intervaloMesesRotina, ensureRoutineExecution, generateOsFromExecution } from './contractRoutines';
import { fetchServiceAttendances, startServiceAttendance } from './serviceAttendances';

/** Data ISO (YYYY-MM-DD) local. */
function isoToday(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Atendimento reutilizável para uma OS (PURO): o EM_EXECUCAO existente daquela
 * OS (idempotência do "iniciar atendimento" — clicar 2x não duplica).
 */
export function pickReusableAttendance(attendances: ServiceAttendance[], workOrderId: string): ServiceAttendance | undefined {
  return attendances.find((a) => a.workOrderId === workOrderId && a.status === 'EM_EXECUCAO');
}

/**
 * Técnico responsável do atendimento (§2/§3): TÉCNICO inicia o PRÓPRIO; ADMIN/
 * GESTOR precisa SELECIONAR — NUNCA vira técnico automaticamente. Sem seleção →
 * undefined (a UI exige "Selecione o técnico responsável"). PURO/testável.
 */
export function resolveResponsibleTechnician(input: {
  userRole?: string;
  currentUserId?: string;
  selectedTechnicianId?: string;
}): string | undefined {
  if (input.userRole === 'TECNICO') return input.currentUserId || undefined;
  return input.selectedTechnicianId || undefined;
}

export interface StartContractualAttendanceResult {
  attendance: ServiceAttendance;
  workOrderId: string;
  executionId: string;
  competencia: string;
  reused: boolean;
}

/**
 * Inicia (ou continua) o atendimento da manutenção contratual da rotina no
 * período corrente. Idempotente em cada etapa. NÃO exige OS manual.
 */
export async function startContractualAttendance(input: {
  routine: ContractRoutine;
  technicianId: string;
  referenceDate?: Date;
}): Promise<StartContractualAttendanceResult> {
  const { routine, technicianId } = input;
  const hoje = input.referenceDate ?? new Date();
  const passo = intervaloMesesRotina(routine);
  const competencia = competenciaDe(hoje, passo);
  const dataProgramada = isoToday(hoje);

  // 1) Execução da competência (UNIQUE(routine, competencia) → nunca duplica).
  const exec = await ensureRoutineExecution(routine.id, competencia, dataProgramada);
  // 2) OS automática e idempotente a partir da execução.
  const os = await generateOsFromExecution(exec.id);
  const workOrderId = os.osId;

  // 3) Atendimento: reutiliza o EM_EXECUCAO da OS; senão cria.
  const existentes = await fetchServiceAttendances({ workOrderId });
  const reusavel = pickReusableAttendance(existentes, workOrderId);
  if (reusavel) {
    return { attendance: reusavel, workOrderId, executionId: exec.id, competencia, reused: true };
  }
  const attendance = await startServiceAttendance({ workOrderId, technicianId });
  return { attendance, workOrderId, executionId: exec.id, competencia, reused: false };
}
