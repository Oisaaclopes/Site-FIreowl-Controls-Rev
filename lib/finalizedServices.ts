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
  /** Chave estável para React (origem + id). */
  key: string;
  origin: FinalizedServiceOrigin;
  /** id da entidade de origem (report/attendance/survey). */
  sourceId: string;
  type: FinalizedServiceType;
  typeLabel: string;
  clienteId?: string;
  osId?: string;
  osNumero?: string;
  attendanceId?: string;
  surveyId?: string;
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
 * Constrói a lista unificada de serviços FINALIZADOS, ordenada por data desc.
 * Só entra o que está realmente finalizado (serviço em execução NUNCA aparece).
 *
 * Deduplicação (canônica, documentada — 5B.3): não há FK direta report↔atendimento;
 * a única relação real é a OS. Como a arquitetura documenta uma OS OU por
 * `report` (legado) OU por `service_attendances` (moderno), quando existe um
 * report finalizado para a MESMA OS de um atendimento, o report é o documento
 * canônico e o atendimento é omitido (evita contar o mesmo serviço duas vezes).
 * Atendimentos sem report para a OS entram normalmente. Levantamentos (survey)
 * não têm OS direta e entram sempre — corrige "Levantamentos = 0".
 */
export function buildFinalizedServiceItems(input: BuildFinalizedInput): FinalizedServiceItem[] {
  const reports = input.reports ?? [];
  const attendances = input.attendances ?? [];
  const surveys = input.surveys ?? [];
  const ordens = input.ordens ?? [];
  const osById = new Map(ordens.map((o) => [o.id, o] as const));

  const items: FinalizedServiceItem[] = [];

  // 1) Reports finalizados.
  const reportedOsIds = new Set<string>();
  for (const r of reports) {
    if (r.status !== 'finalizado') continue;
    if (r.osId) reportedOsIds.add(r.osId);
    const type = REPORT_TYPE_MAP[r.tipo] ?? 'OUTRO';
    items.push({
      key: `report-${r.id}`,
      origin: 'report',
      sourceId: r.id,
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

  // 2) Atendimentos finalizados — classificados pela OS; dedup contra report da mesma OS.
  for (const a of attendances) {
    if (a.status !== 'FINALIZADO') continue;
    if (a.workOrderId && reportedOsIds.has(a.workOrderId)) continue; // report é o documento canônico
    const os = a.workOrderId ? osById.get(a.workOrderId) : undefined;
    const type = os ? (OS_TYPE_MAP[os.tipo] ?? 'OUTRO') : 'OUTRO';
    items.push({
      key: `attendance-${a.id}`,
      origin: 'attendance',
      sourceId: a.id,
      type,
      typeLabel: FINALIZED_SERVICE_LABEL[type],
      clienteId: os?.clienteId,
      osId: a.workOrderId,
      osNumero: os?.numero,
      attendanceId: a.id,
      date: a.finishedAt || a.updatedAt,
      tecnicoId: a.technicianId,
      hasDocument: true, // Documentos da OS (relatório de atendimento/OS executada)
      documentSource: 'Documentos da OS',
    });
  }

  // 3) Levantamentos técnicos finalizados (motor 3D).
  for (const s of surveys) {
    if (s.status !== 'FINALIZADO') continue;
    items.push({
      key: `survey-${s.id}`,
      origin: 'survey',
      sourceId: s.id,
      type: 'LEVANTAMENTO_TECNICO',
      typeLabel: FINALIZED_SERVICE_LABEL.LEVANTAMENTO_TECNICO,
      clienteId: s.clienteId,
      surveyId: s.id,
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
