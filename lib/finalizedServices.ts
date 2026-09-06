import type { ReportInstance, ServiceAttendance, TechnicalSurvey, OrdemServico } from './types';

/* ===================================================================
 * BLOCO 5B (QA) — Modelo de LEITURA unificado de serviços técnicos FINALIZADOS.
 *
 * Um "serviço finalizado" pode vir de três entidades canônicas distintas:
 *   - reports (fluxo legado/documental): report.tipo, report.osId
 *   - service_attendances (fluxo moderno de campo): classificado pela OS.tipo,
 *     documentado pelos Documentos da OS (não gera linha em `reports`)
 *   - technical_surveys (motor 3D de Levantamento): sempre "Levantamento Técnico"
 *
 * Relações canônicas (auditadas — 5B.1):
 *   Pedido → OS: ordens_servico.source_pedido_id
 *   OS → Atendimento: service_attendances.work_order_id
 *   OS → Report: reports.os_id
 *   Survey: technical_surveys (cliente+área; sem OS direta)
 *
 * Este módulo é PURO (sem I/O) e só LÊ — nunca cria registro artificial em
 * `reports` para "fazer a tela funcionar" (§5B.4).
 * =================================================================== */

export type FinalizedServiceType =
  | 'INSTALACAO' | 'CORRETIVA' | 'PREVENTIVA' | 'LEVANTAMENTO_TECNICO' | 'OUTRO';

export const FINALIZED_SERVICE_LABEL: Record<FinalizedServiceType, string> = {
  INSTALACAO: 'Instalação',
  CORRETIVA: 'Manutenção Corretiva',
  PREVENTIVA: 'Manutenção Preventiva',
  LEVANTAMENTO_TECNICO: 'Levantamento Técnico',
  OUTRO: 'Outro',
};

export type FinalizedServiceOrigin = 'report' | 'attendance' | 'survey';

export interface FinalizedServiceItem {
  /** Chave estável para React e identidade DOCUMENTAL (origem + id da entidade).
   *  A identidade é da própria entidade (attendance/report/survey), NUNCA da OS —
   *  a OS é contexto/pai (1 OS → N atendimentos → N documentos). */
  key: string;
  origin: FinalizedServiceOrigin;
  /** id da entidade de origem (report/attendance/survey). */
  sourceId: string;
  type: FinalizedServiceType;
  typeLabel: string;
  clienteId?: string;
  /** OS de CONTEXTO (não identidade). */
  osId?: string;
  osNumero?: string;
  attendanceId?: string;
  surveyId?: string;
  reportId?: string;
  /** Área técnica (usada para abrir o documento de Levantamento). */
  area?: string;
  /** Data de finalização (para ordenação/rótulo). */
  date?: string;
  tecnicoId?: string;
  tecnicoNome?: string;
  /** Há documento/PDF técnico disponível para abrir. */
  hasDocument: boolean;
  /** Origem documental legível. */
  documentSource: 'Relatório técnico' | 'Documentos da OS' | 'Levantamento (3D)';
}

const REPORT_TYPE_MAP: Record<string, FinalizedServiceType> = {
  LEVANTAMENTO: 'LEVANTAMENTO_TECNICO',
  CORRETIVA: 'CORRETIVA',
  PREVENTIVA: 'PREVENTIVA',
};
const OS_TYPE_MAP: Record<string, FinalizedServiceType> = {
  instalacao: 'INSTALACAO',
  corretiva: 'CORRETIVA',
  preventiva: 'PREVENTIVA',
  outro: 'OUTRO',
};

export interface BuildFinalizedInput {
  reports?: ReportInstance[];
  attendances?: ServiceAttendance[];
  surveys?: TechnicalSurvey[];
  ordens?: OrdemServico[];
}

/**
 * Constrói a lista unificada de DOCUMENTOS técnicos de serviços FINALIZADOS,
 * ordenada por data desc. Só entra o que está realmente finalizado (serviço em
 * execução NUNCA aparece).
 *
 * IDENTIDADE DOCUMENTAL (§8/§9): cada documento é identificado pela SUA entidade
 * — report_id, attendance_id ou technical_survey_id — NUNCA pela OS. A OS é
 * contexto/pai: 1 OS pode ter N atendimentos finalizados = N documentos, e todos
 * aparecem. NÃO se esconde atendimento porque existe um `report` com o mesmo
 * os_id. Como finalizar um atendimento NÃO cria linha em `reports` (fontes
 * disjuntas — auditado), não há duplicação de um mesmo documento entre origens;
 * a dedução por id da própria entidade garante que o mesmo registro nunca conta
 * duas vezes.
 */
export function buildFinalizedServiceItems(input: BuildFinalizedInput): FinalizedServiceItem[] {
  const reports = input.reports ?? [];
  const attendances = input.attendances ?? [];
  const surveys = input.surveys ?? [];
  const ordens = input.ordens ?? [];
  const osById = new Map(ordens.map((o) => [o.id, o] as const));

  const items: FinalizedServiceItem[] = [];
  const seen = new Set<string>(); // guarda por identidade da entidade (não OS)

  // 1) Reports finalizados (documento = Relatório técnico).
  for (const r of reports) {
    if (r.status !== 'finalizado') continue;
    if (seen.has(`report-${r.id}`)) continue;
    seen.add(`report-${r.id}`);
    const type = REPORT_TYPE_MAP[r.tipo] ?? 'OUTRO';
    items.push({
      key: `report-${r.id}`,
      origin: 'report',
      sourceId: r.id,
      reportId: r.id,
      type,
      typeLabel: FINALIZED_SERVICE_LABEL[type],
      clienteId: r.clienteId,
      osId: r.osId,
      date: r.finalizadoEm || r.iniciadoEm,
      tecnicoId: r.tecnicoId,
      tecnicoNome: r.tecnicoNome,
      hasDocument: true,
      documentSource: 'Relatório técnico',
    });
  }

  // 2) Atendimentos finalizados — CADA UM é um documento (classificado pela OS).
  //    Múltiplos atendimentos da mesma OS geram múltiplos documentos (§9).
  for (const a of attendances) {
    if (a.status !== 'FINALIZADO') continue;
    if (seen.has(`attendance-${a.id}`)) continue;
    seen.add(`attendance-${a.id}`);
    const os = a.workOrderId ? osById.get(a.workOrderId) : undefined;
    const type = os ? (OS_TYPE_MAP[os.tipo] ?? 'OUTRO') : 'OUTRO';
    items.push({
      key: `attendance-${a.id}`,
      origin: 'attendance',
      sourceId: a.id,
      attendanceId: a.id,
      type,
      typeLabel: FINALIZED_SERVICE_LABEL[type],
      clienteId: os?.clienteId,
      osId: a.workOrderId,
      osNumero: os?.numero,
      date: a.finishedAt || a.updatedAt,
      tecnicoId: a.technicianId,
      hasDocument: true, // documento técnico do atendimento (Documentos da OS)
      documentSource: 'Documentos da OS',
    });
  }

  // 3) Levantamentos técnicos finalizados (motor 3D → documento de Levantamento).
  for (const s of surveys) {
    if (s.status !== 'FINALIZADO') continue;
    if (seen.has(`survey-${s.id}`)) continue;
    seen.add(`survey-${s.id}`);
    items.push({
      key: `survey-${s.id}`,
      origin: 'survey',
      sourceId: s.id,
      surveyId: s.id,
      type: 'LEVANTAMENTO_TECNICO',
      typeLabel: FINALIZED_SERVICE_LABEL.LEVANTAMENTO_TECNICO,
      clienteId: s.clienteId,
      area: s.area,
      date: s.finishedAt || s.updatedAt,
      tecnicoId: s.createdBy,
      hasDocument: true, // PDF do levantamento (3D)
      documentSource: 'Levantamento (3D)',
    });
  }

  const toTime = (d?: string) => (d ? new Date(d).getTime() : 0);
  return items.sort((a, b) => toTime(b.date) - toTime(a.date));
}

/** Contadores por tipo de serviço finalizado (para os cards da tela). */
export interface FinalizedServiceCounts {
  total: number;
  byType: Record<FinalizedServiceType, number>;
}
export function countFinalizedServices(items: FinalizedServiceItem[]): FinalizedServiceCounts {
  const byType: Record<FinalizedServiceType, number> = {
    INSTALACAO: 0, CORRETIVA: 0, PREVENTIVA: 0, LEVANTAMENTO_TECNICO: 0, OUTRO: 0,
  };
  for (const it of items) byType[it.type] += 1;
  return { total: items.length, byType };
}
