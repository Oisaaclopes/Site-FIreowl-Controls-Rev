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
import { createReport, updateReport, fetchAnswers, fetchReportsByAttendanceIds } from './reports';
import { fetchServiceAttendances } from './serviceAttendances';
import { fetchRoutineExecutions } from './contractRoutines';
import { fetchPendencias } from './pendencias';
import { fetchVerificationsInWindow } from './deviceVerifications';
import { fetchDevices } from './devices';
import { fetchSurveyRequirements } from './surveyRequirements';
import { listFieldPhotosForOs, type FieldPhoto } from './fieldPhotos';
import { classifyTestResult, fetchMaintenanceCoverage } from './maintenanceCoverage';
import type {
  ContractRoutineExecution,
  Device,
  DeviceVerification,
  MaintenanceAnswerSnapshot,
  MaintenanceAssetSnapshot,
  MaintenanceCoverage,
  MaintenanceMeasurementSnapshot,
  MaintenancePendenciaSnapshot,
  MaintenancePhotoSnapshot,
  MaintenanceReportSnapshot,
  MaintenanceTechnicalReportSnapshot,
  Pendencia,
  ReportAnswer,
  ReportInstance,
  ServiceAttendance,
  SurveyMeasurement,
  UserRole,
} from './types';

/* --------------------------- Reports técnicos por atendimento -------------- */

/** Documento técnico fonte + seus dados estruturados já carregados. */
export interface TechnicalReportSource {
  report: ReportInstance;
  answers: ReportAnswer[];
  measurements: SurveyMeasurement[];
}

/** Statuses documentais que podem alimentar o consolidado (documento válido). */
export const MAINTENANCE_SOURCE_STATUSES: ReadonlyArray<string> = ['finalizado'];

/**
 * Seleciona os relatórios técnicos VÁLIDOS para o consolidado (PURO/testável):
 *  - status documental válido (default: finalizado);
 *  - tipo técnico (exclui o próprio MANUTENCAO);
 *  - do contrato correto (quando `contractId` informado);
 *  - ligados a um atendimento do período (quando `validAttendanceIds` informado);
 *  - COLAPSA a série de supersessão: se R01 supersede R00 e ambos estão no
 *    conjunto, mantém só R01; R00→R01→R02 mantém só R02. Nunca duas revisões da
 *    mesma série. Identidade por report_id/service_attendance_id — nunca os_id.
 */
export function resolveLatestValidReports(
  reports: ReportInstance[],
  opts?: { contractId?: string; validAttendanceIds?: Iterable<string>; validStatuses?: ReadonlyArray<string> }
): ReportInstance[] {
  const validStatuses = opts?.validStatuses ?? MAINTENANCE_SOURCE_STATUSES;
  const attSet = opts?.validAttendanceIds ? new Set(opts.validAttendanceIds) : null;

  const eligible = reports.filter((r) =>
    validStatuses.includes(r.status) &&
    r.tipo !== 'MANUTENCAO' &&
    (opts?.contractId == null || r.contratoId === opts.contractId) &&
    (attSet == null || (r.serviceAttendanceId != null && attSet.has(r.serviceAttendanceId)))
  );

  // Colapsa supersessão: descarta quem foi superseditado por outro do conjunto.
  const superseded = new Set(
    eligible.map((r) => r.supersedesReportId).filter((x): x is string => !!x)
  );
  const seen = new Set<string>();
  return eligible.filter((r) => {
    if (superseded.has(r.id) || seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

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
  snapshot: MaintenanceReportSnapshot,
  fechadoEm?: string
): Promise<ReportInstance> {
  if (!snapshot) throw new Error('snapshot obrigatório para fechar MANUTENCAO');
  // snapshot vazio (sem membership) não fecha (§10): protege de emissão em branco.
  const m = snapshot.membership;
  const vazio = !m || (m.attendanceIds.length + m.executionIds.length + m.deviceVerificationIds.length + m.pendenciaIds.length) === 0;
  if (vazio) throw new Error('snapshot sem conteúdo (membership vazio) — nada a consolidar no período');
  const now = fechadoEm || new Date().toISOString();
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
  /** Documentos técnicos por atendimento (revisão vigente) + answers/measurements. */
  technicalReports: TechnicalReportSource[];
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
  const attendanceIds = attendances.map((a) => a.id);

  // 2b) Documentos técnicos por atendimento (revisão vigente) → answers/measurements.
  //     Membership por report_id/service_attendance_id; NUNCA por os_id.
  const rawReports = await fetchReportsByAttendanceIds(attendanceIds);
  const validReports = resolveLatestValidReports(rawReports, {
    contractId: input.contratoId,
    validAttendanceIds: attendanceIds,
  });
  const technicalReports: TechnicalReportSource[] = await Promise.all(
    validReports.map(async (report) => {
      const [answers, req] = await Promise.all([fetchAnswers(report.id), fetchSurveyRequirements(report.id)]);
      return { report, answers, measurements: req.measurements };
    })
  );

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
    technicalReports,
    pendencias,
    fotos,
    membership: {
      attendanceIds,
      executionIds: execs.map((e) => e.id),
      osIds,
    },
  };
}

/* --------------------------- Snapshot documental (§5–§9) ------------------- */

const dedupe = <T,>(xs: T[]): T[] => Array.from(new Set(xs));

/** Deduplica por identidade real (chave), preservando a 1ª ocorrência (§6). */
function dedupeBy<T>(xs: T[], key: (x: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of xs) { const k = key(x); if (!seen.has(k)) { seen.add(k); out.push(x); } }
  return out;
}

function toPendenciaSnap(p: Pendencia): MaintenancePendenciaSnapshot {
  return {
    id: p.id, descricao: p.descricao, grupo: p.grupo, local: p.local,
    acaoRecomendada: p.acaoRecomendada, deviceId: p.deviceId,
    status: p.status, criadaEm: p.criadaEm, resolvidaEm: p.resolvidaEm,
  };
}

function toPhotoSnap(f: FieldPhoto): MaintenancePhotoSnapshot {
  return {
    fieldPhotoId: f.id,
    storagePath: f.storagePathOriginal,
    storagePathEvidencia: f.storagePathEvidencia,
    capturadoEm: f.capturadoEm,
    deviceId: f.deviceId,
    attendanceId: f.serviceAttendanceId,
    pendenciaId: f.pendenciaId,
    momento: f.evidenceMoment,
    descricao: f.notaRapida,
  };
}

/** Cópia profunda simples do valor bruto de uma answer (imunidade §11). */
function cloneValor(v: unknown): unknown {
  try { return structuredClone(v); } catch { return v == null ? null : JSON.parse(JSON.stringify(v)); }
}

function toAnswerSnap(a: ReportAnswer): MaintenanceAnswerSnapshot {
  return { fieldKey: a.fieldKey, secao: a.secao, valor: cloneValor(a.valor), deviceId: a.deviceId, observacao: a.observacao };
}

function toMeasurementSnap(m: SurveyMeasurement, report: ReportInstance): MaintenanceMeasurementSnapshot {
  return {
    id: m.id, reportId: m.reportId, categoria: m.categoria, descricao: m.descricao,
    quantidade: m.quantidade, unidade: m.unidade, local: m.local, observacao: m.observacao,
    attendanceId: report.serviceAttendanceId, data: report.finalizadoEm ?? report.iniciadoEm, tecnicoId: report.tecnicoId,
  };
}

/** Sistema do documento (best-effort §9): sistema ÚNICO dos devices citados nas
 *  answers; ambíguo/ausente → undefined (não força/inventa). */
function reportSistema(answers: ReportAnswer[], deviceMap: Map<string, Device>): string | undefined {
  const sis = dedupe(
    answers.map((a) => a.deviceId).filter((x): x is string => !!x)
      .map((id) => deviceMap.get(id)?.sistema as string | undefined)
      .filter((s): s is string => !!s)
  );
  return sis.length === 1 ? sis[0] : undefined;
}

function toTechnicalReportSnap(src: TechnicalReportSource, deviceMap: Map<string, Device>): MaintenanceTechnicalReportSnapshot {
  return {
    reportId: src.report.id,
    numero: src.report.numero,
    tipo: src.report.tipo,
    templateCodigo: src.report.templateCodigo,
    templateVersion: src.report.templateVersion,
    revisao: src.report.revisao,
    serviceAttendanceId: src.report.serviceAttendanceId,
    tecnicoId: src.report.tecnicoId,
    sistema: reportSistema(src.answers, deviceMap),
    answers: src.answers.map(toAnswerSnap),
    measurements: src.measurements.map((m) => toMeasurementSnap(m, src.report)),
  };
}

/** Última verificação (por verified_at) de cada device dentro dos testes. */
function latestTestByDevice(testes: DeviceVerification[]): Map<string, DeviceVerification> {
  const m = new Map<string, DeviceVerification>();
  for (const v of testes) {
    const cur = m.get(v.deviceId);
    if (!cur || (v.verifiedAt ?? '') > (cur.verifiedAt ?? '')) m.set(v.deviceId, v);
  }
  return m;
}

/** Congela um Device no MOMENTO da emissão (§6/§16). Preserva nome/localização
 *  atuais para que renomear depois NÃO altere o documento fechado. */
function toAssetSnap(d: Device, test?: DeviceVerification): MaintenanceAssetSnapshot {
  return {
    deviceId: d.id,
    sistema: d.sistema,
    central: d.central,
    laco: d.laco,
    endereco: d.endereco,
    codigo: d.technicalIdentifier,
    tipo: d.tipoAtivo || d.tipoDispositivo,
    fabricante: d.fabricante,
    modelo: d.modelo,
    descricao: d.localizacao,
    condicao: test?.condicao ?? d.condicao,
    resultadoTeste: test ? classifyTestResult(test.condicao) : undefined,
    dataTeste: test?.verifiedAt,
  };
}

/**
 * BUILDER PURO do snapshot documental. Congela os dados do MOMENTO (§9): nomes
 * de ativos, testes, pendências (3 grupos), fotos (só referências §7), cobertura
 * e membership. Não inventa conclusão (§5). Depois de gravado é imutável (0106).
 */
export function buildMaintenanceReportSnapshot(params: {
  consolidation: MaintenanceConsolidation;
  devices: Device[];
  coverage: MaintenanceCoverage;
  revisao: string;
  fechadoEm: string;
  competencia?: string;
  conclusao?: string;
}): MaintenanceReportSnapshot {
  const { consolidation: c, devices, coverage } = params;
  const deviceMap = new Map(devices.map((d) => [d.id, d] as const));
  const latestTest = latestTestByDevice(c.testes);

  const technicalReports = c.technicalReports.map((src) => toTechnicalReportSnap(src, deviceMap));

  // Ativos incluídos = citados por teste OU foto OU answer de report técnico (§8).
  const answerDeviceIds = c.technicalReports.flatMap((src) =>
    src.answers.map((a) => a.deviceId).filter((x): x is string => !!x)
  );
  const assetIds = dedupe([
    ...c.testes.map((t) => t.deviceId),
    ...(c.fotos.map((f) => f.deviceId).filter(Boolean) as string[]),
    ...answerDeviceIds,
  ]);
  const ativos: MaintenanceAssetSnapshot[] = assetIds
    .map((id) => deviceMap.get(id))
    .filter((d): d is Device => !!d)
    .map((d) => toAssetSnap(d, latestTest.get(d.id)));

  // Evidência deduplicada pela identidade real (field_photo_id), nunca por os_id (§6).
  const fotosUnicas = dedupeBy(c.fotos, (f) => f.id);
  const pendAll = [
    ...c.pendencias.abertasNoPeriodo,
    ...c.pendencias.anterioresAbertas,
    ...c.pendencias.resolvidasNoPeriodo,
  ];

  // Alterações de Base derivadas das verificações com reconciliação relevante
  // (dado real disponível; rename com antes/depois textual é lacuna — ver entrega).
  const alteracoesBase = c.testes
    .filter((t) => t.reconciliation && ['ALTERADO', 'NOVO', 'NAO_LOCALIZADO', 'DUPLICADO'].includes(t.reconciliation))
    .map((t) => ({ deviceId: t.deviceId, tipo: t.reconciliation as string, em: t.verifiedAt }));

  return {
    contratoId: c.contratoId,
    clienteId: c.clienteId,
    periodStart: c.periodStart,
    periodEnd: c.periodEnd,
    competencia: params.competencia,
    revisao: params.revisao,
    fechadoEm: params.fechadoEm,
    sistemas: c.sistemas,
    atendimentos: c.attendances.map((a) => ({
      id: a.id, tecnicoId: a.technicianId, data: a.startedAt, resultado: a.result, osId: a.workOrderId,
    })),
    routineExecutions: c.executions.map((e) => ({
      id: e.id, competencia: e.competencia, routineId: e.routineId, dataProgramada: e.dataProgramada, status: e.status,
    })),
    ativos,
    testes: c.testes.map((t) => ({
      deviceVerificationId: t.id, deviceId: t.deviceId, condicao: t.condicao,
      resultado: classifyTestResult(t.condicao), verifiedAt: t.verifiedAt, serviceAttendanceId: t.serviceAttendanceId,
    })),
    technicalReports,
    cobertura: { ...coverage },   // cópia → imune a recálculo/mutação posterior (§4/§9)
    pendencias: {
      novasNoPeriodo: c.pendencias.abertasNoPeriodo.map(toPendenciaSnap),
      anterioresAbertas: c.pendencias.anterioresAbertas.map(toPendenciaSnap),
      resolvidasNoPeriodo: c.pendencias.resolvidasNoPeriodo.map(toPendenciaSnap),
    },
    fotos: fotosUnicas.map(toPhotoSnap),
    alteracoesBase,
    conclusao: params.conclusao,
    membership: {
      // cópias (não referências) → snapshot imune a mutações futuras da origem (§9/§11).
      attendanceIds: [...c.membership.attendanceIds],
      executionIds: [...c.membership.executionIds],
      technicalReportIds: technicalReports.map((t) => t.reportId),
      deviceVerificationIds: c.testes.map((t) => t.id),
      pendenciaIds: dedupe(pendAll.map((p) => p.id)),
      fieldPhotoIds: fotosUnicas.map((f) => f.id),
      deviceIds: [...assetIds],
    },
  };
}

/**
 * Integra CONSOLIDAÇÃO → SNAPSHOT → FECHAMENTO ATÔMICO (§10). Monta a visão
 * dinâmica por (contrato + janela), congela no snapshot e finaliza numa única
 * gravação (status+snapshot+fechado_em). O `fechado_em` é o mesmo no snapshot e
 * na linha. Não fecha com snapshot vazio.
 */
export async function assembleAndFinalizeMaintenanceReport(input: {
  report: ReportInstance;
  role?: UserRole;
  conclusao?: string;
}): Promise<ReportInstance> {
  const r = input.report;
  if (r.tipo !== 'MANUTENCAO') throw new Error('fechamento consolidado só para MANUTENCAO');
  if (!r.contratoId || !r.periodStart || !r.periodEnd) {
    throw new Error('MANUTENCAO exige contrato + período para consolidar');
  }
  const consolidation = await buildMaintenanceConsolidation({
    contratoId: r.contratoId, clienteId: r.clienteId,
    periodStart: r.periodStart, periodEnd: r.periodEnd, role: input.role,
  });
  const [devices, coverage] = await Promise.all([
    r.clienteId ? fetchDevices(r.clienteId) : Promise.resolve([] as Device[]),
    r.clienteId
      ? fetchMaintenanceCoverage(r.clienteId, { contractId: r.contratoId, periodStart: r.periodStart, periodEnd: r.periodEnd })
      : Promise.resolve(emptyCoverage(r.periodStart, r.periodEnd)),
  ]);
  const fechadoEm = new Date().toISOString();
  const snapshot = buildMaintenanceReportSnapshot({
    consolidation, devices, coverage,
    revisao: r.revisao || 'R00', fechadoEm, competencia: r.competencia, conclusao: input.conclusao,
  });
  return finalizeMaintenanceReport(r.id, snapshot, fechadoEm);
}

function emptyCoverage(periodStart: string, periodEnd: string): MaintenanceCoverage {
  return {
    periodStart, periodEnd, totalBase: 0, totalComPolitica: 0, semPolitica: 0, semHistorico: 0,
    primeiroTestePendente: 0, programadosPeriodo: 0, testadosProgramadosPeriodo: 0, naoTestadosPeriodo: 0,
    testadosExtrasPeriodo: 0, testadosTotaisPeriodo: 0, aprovadosPeriodo: 0, falharamPeriodo: 0,
    coberturaProgramadaPct: null, taxaAprovacaoPct: null,
  };
}
