/* ===================================================================
 * MANUTENÇÃO CONTRATUAL (0106) — camada de domínio dos RELATÓRIOS.
 *  - vínculo documento técnico ↔ atendimento (reports.service_attendance_id);
 *  - fechamento ATÔMICO do consolidado MANUTENCAO (status+snapshot+fechado_em);
 *  - revisões R00→R01→R02 (nova linha supersede; nunca edita finalizado);
 *  - consolidado por (contrato + janela de datas) — NÃO usa `competencia` como
 *    fonte de verdade e NÃO cria maintenance_cycles.
 * Reaproveita reports/pendencias/service_attendances/device_verifications/
 * field_photos/contract_routine_executions existentes. Helpers de janela e de
 * revisão são PUROS/testáveis.
 * =================================================================== */
import { getSupabaseClient } from './supabaseClient';
import { createReport, updateReport } from './reports';
import { fetchServiceAttendances } from './serviceAttendances';
import { fetchRoutineExecutions } from './contractRoutines';
import { fetchPendencias } from './pendencias';
import { fetchVerificationsInWindow } from './deviceVerifications';
import { fetchDevices } from './devices';
import { listFieldPhotosForOs } from './fieldPhotos';
import type {
  ContractRoutineExecution,
  MaintenanceReportSnapshot,
  Pendencia,
  ReportInstance,
  ServiceAttendance,
  UserRole,
} from './types';

/* --------------------------- Helpers PUROS de revisão ---------------------- */

/** 'R00' → 0, 'R01' → 1, 'R10' → 10. Lança se o formato for inválido. */
export function parseRevisao(revisao: string): number {
  if (!/^R\d{2,}$/.test(revisao)) throw new Error(`revisão inválida: ${revisao}`);
  return parseInt(revisao.slice(1), 10);
}

/** Formata um número de revisão como R + mínimo 2 dígitos (R00, R09, R10, R100). */
export function formatRevisao(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new Error(`revisão inválida: ${n}`);
  return `R${String(n).padStart(2, '0')}`;
}

/** Próximo rótulo de revisão a partir do anterior (R00 → R01). */
export function nextRevisaoLabel(previous: string): string {
  return formatRevisao(parseRevisao(previous) + 1);
}

/* --------------------------- Helpers PUROS de janela ----------------------- */

const dateOnly = (v?: string): string | undefined => (v ? String(v).slice(0, 10) : undefined);

/** d ∈ [start, end] comparando só a parte de data (determinístico). */
export function inWindow(value: string | undefined, periodStart: string, periodEnd: string): boolean {
  const d = dateOnly(value);
  if (!d) return false;
  return d >= dateOnly(periodStart)! && d <= dateOnly(periodEnd)!;
}

/** Execuções de rotina que pertencem à janela (âncora = data_programada). */
export function executionsInWindow(
  executions: ContractRoutineExecution[],
  periodStart: string,
  periodEnd: string
): ContractRoutineExecution[] {
  return executions.filter((e) => inWindow(e.dataProgramada, periodStart, periodEnd));
}

/** Atendimentos que ocorreram na janela (âncora = started_at). */
export function attendancesInWindow(
  attendances: ServiceAttendance[],
  periodStart: string,
  periodEnd: string
): ServiceAttendance[] {
  return attendances.filter((a) => inWindow(a.startedAt, periodStart, periodEnd));
}

export interface PendenciaBuckets {
  abertasNoPeriodo: Pendencia[];
  anterioresAbertas: Pendencia[];
  resolvidasNoPeriodo: Pendencia[];
}

/**
 * Separa pendências (entidade persistente — §17; NUNCA duplicada por mês) nas
 * três lentes do consolidado. Uma pendência aberta E resolvida na mesma janela
 * aparece tanto em abertasNoPeriodo quanto em resolvidasNoPeriodo (correto).
 */
export function bucketPendencias(
  pendencias: Pendencia[],
  periodStart: string,
  periodEnd: string
): PendenciaBuckets {
  const startD = dateOnly(periodStart)!;
  const endD = dateOnly(periodEnd)!;
  const abertasNoPeriodo: Pendencia[] = [];
  const anterioresAbertas: Pendencia[] = [];
  const resolvidasNoPeriodo: Pendencia[] = [];
  for (const p of pendencias) {
    if (p.status === 'cancelada') continue; // cancelada não conta como pendência viva
    const criada = dateOnly(p.criadaEm);
    const resolvida = dateOnly(p.resolvidaEm);
    // Aberta no período: criada dentro da janela.
    if (criada && criada >= startD && criada <= endD) abertasNoPeriodo.push(p);
    // Anterior ainda aberta: criada antes do início e sem resolução até o fim.
    if (criada && criada < startD && (!resolvida || resolvida > endD)) anterioresAbertas.push(p);
    // Resolvida no período: resolvidaEm dentro da janela.
    if (resolvida && resolvida >= startD && resolvida <= endD) resolvidasNoPeriodo.push(p);
  }
  return { abertasNoPeriodo, anterioresAbertas, resolvidasNoPeriodo };
}

/* --------------------------- I/O: vínculo e fechamento --------------------- */

/** Vincula (ou desvincula) um documento técnico a um atendimento. Sem unique. */
export async function linkReportToAttendance(reportId: string, attendanceId: string | null): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from('reports')
    .update({ service_attendance_id: attendanceId, updated_at: new Date().toISOString() })
    .eq('id', reportId);
  if (error) throw error;
}

/**
 * Fecha um consolidado MANUTENCAO ATOMICAMENTE (uma linha):
 * status=finalizado + snapshot + fechado_em. Nunca finaliza sem snapshot (o
 * CHECK reports_manutencao_close_check da 0106 é o backstop). O trigger de
 * congelamento (0075+0106) torna o snapshot imutável a partir daqui.
 */
export async function finalizeMaintenanceReport(
  reportId: string,
  snapshot: MaintenanceReportSnapshot
): Promise<ReportInstance> {
  if (!snapshot) throw new Error('snapshot obrigatório para fechar MANUTENCAO');
  const now = new Date().toISOString();
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from('reports')
    .update({ status: 'finalizado', snapshot, fechado_em: now, data_fim: now, updated_at: now })
    .eq('id', reportId)
    .eq('tipo', 'MANUTENCAO')
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Cria a próxima revisão (R01, R02…) de um consolidado finalizado, como NOVA
 * linha em rascunho que supersede a anterior. NÃO edita o finalizado (imutável).
 * A mesma série (contrato/tipo/período) é validada pelo trigger da 0106.
 */
export async function createMaintenanceRevision(previous: ReportInstance): Promise<ReportInstance> {
  if (previous.tipo !== 'MANUTENCAO') throw new Error('revisão só se aplica a MANUTENCAO');
  const revisao = nextRevisaoLabel(previous.revisao || 'R00');
  return createReport({
    templateCodigo: previous.templateCodigo,
    tipo: 'MANUTENCAO',
    clienteId: previous.clienteId,
    contratoId: previous.contratoId,
    titulo: previous.titulo,
    local: previous.local,
    status: 'rascunho',
    periodStart: previous.periodStart,
    periodEnd: previous.periodEnd,
    competencia: previous.competencia,
    revisao,
    supersedesReportId: previous.id,
  } as ReportInstance);
}

/** Cria o consolidado inicial (R00) em rascunho para um contrato+período. */
export async function createMaintenanceReportDraft(input: {
  contratoId: string;
  clienteId?: string;
  periodStart: string;
  periodEnd: string;
  competencia?: string;
  templateCodigo?: string;
  titulo?: string;
}): Promise<ReportInstance> {
  return createReport({
    templateCodigo: input.templateCodigo || 'MANUTENCAO',
    tipo: 'MANUTENCAO',
    clienteId: input.clienteId,
    contratoId: input.contratoId,
    titulo: input.titulo,
    status: 'rascunho',
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    competencia: input.competencia,
    revisao: 'R00',
  } as ReportInstance);
}

export { updateReport };

/* --------------------------- I/O: consolidado por período ------------------ */

export interface MaintenanceConsolidation {
  contratoId: string;
  clienteId?: string;
  periodStart: string;
  periodEnd: string;
  executions: ContractRoutineExecution[];
  attendances: ServiceAttendance[];
  sistemas: string[];
  testes: Awaited<ReturnType<typeof fetchVerificationsInWindow>>;
  pendencias: PendenciaBuckets;
  fotos: Awaited<ReturnType<typeof listFieldPhotosForOs>>;
  membership: { attendanceIds: string[]; executionIds: string[]; osIds: string[] };
}

/**
 * Monta a VISÃO DINÂMICA do consolidado por (contrato + janela de datas). Puro
 * de duplicação: só lê e cruza as entidades reais. A membership (execuções/
 * atendimentos incluídos) é derivada por DATA — não por `competencia` (§9). Ao
 * fechar, esta visão vira o snapshot imutável (montado pela UI/serviço).
 */
export async function buildMaintenanceConsolidation(input: {
  contratoId: string;
  clienteId?: string;
  periodStart: string;
  periodEnd: string;
  role?: UserRole;
}): Promise<MaintenanceConsolidation> {
  const role: UserRole = input.role || 'GESTOR';

  // 1) Execuções de rotina do contrato dentro da janela (âncora = data_programada).
  const allExec = await fetchRoutineExecutions(input.contratoId);
  const execs = executionsInWindow(allExec, input.periodStart, input.periodEnd);
  const osIds = Array.from(new Set(execs.map((e) => e.ordemServicoId).filter(Boolean) as string[]));

  // 2) Atendimentos dessas OS que ocorreram na janela (evidência real de execução).
  const attArrays = await Promise.all(osIds.map((osId) => fetchServiceAttendances({ workOrderId: osId })));
  const attendances = attendancesInWindow(attArrays.flat(), input.periodStart, input.periodEnd);

  // 3) Pendências do cliente, separadas em abertas/anteriores/resolvidas.
  const pendencias = input.clienteId
    ? bucketPendencias(await fetchPendencias(role, { clienteId: input.clienteId }), input.periodStart, input.periodEnd)
    : { abertasNoPeriodo: [], anterioresAbertas: [], resolvidasNoPeriodo: [] };

  // 4) Testes (device_verifications) na janela, para os ativos do cliente.
  let testes: MaintenanceConsolidation['testes'] = [];
  let sistemas: string[] = [];
  if (input.clienteId) {
    const devices = await fetchDevices(input.clienteId);
    sistemas = Array.from(new Set(devices.map((d) => d.sistema)));
    testes = await fetchVerificationsInWindow(devices.map((d) => d.id), input.periodStart, input.periodEnd);
  }

  // 5) Fotos/evidências vinculadas às OS do período (reusa field_photos; sem galeria nova).
  const fotoArrays = await Promise.all(osIds.map((osId) => listFieldPhotosForOs(osId)));
  const fotos = fotoArrays.flat();

  return {
    contratoId: input.contratoId,
    clienteId: input.clienteId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    executions: execs,
    attendances,
    sistemas,
    testes,
    pendencias,
    fotos,
    membership: {
      attendanceIds: attendances.map((a) => a.id),
      executionIds: execs.map((e) => e.id),
      osIds,
    },
  };
}
