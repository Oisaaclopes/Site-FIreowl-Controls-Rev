/* ===================================================================
 * MANUTENÇÃO PREVENTIVA SDAI — camada de DOMÍNIO do template operacional.
 * PURO/testável; sem I/O. Reaproveita FormEngine/report_answers/report_measurements/
 * device_verifications/pendencias/field_photos (nada de Base/galeria paralela).
 *  - resultado do teste por device → device_verifications.condicao canônico;
 *  - checklist da central UMA VEZ POR CENTRAL POR PERÍODO (derivado, sem tabela);
 *  - laços dinâmicos (N) derivados da Base;
 *  - injeção dos devices planejados a partir do MaintenancePeriodPlan;
 *  - pendências: dedupe de equivalente aberta (sem duplicar por mês).
 * =================================================================== */
import type {
  AssetConditionValue,
  Device,
  DeviceVerification,
  MaintenanceAssetStatus,
  MaintenancePeriodPlan,
  Pendencia,
} from './types';
import type { LastTestInfo } from './maintenanceAssets';

/** Código estável do template (convenção do repo: PREVENTIVA_<AREA>_<escopo>). */
export const PREVENTIVA_SDAI_CONTRATO_CODIGO = 'PREVENTIVA_SDAI_CONTRATO';

/* --------------------------- Resultado do teste (§10/§11) ------------------ */

export type SdaiDeviceResult =
  | 'TESTADO_APROVADO'
  | 'TESTADO_FALHOU'
  | 'NAO_LOCALIZADO'
  | 'NAO_FOI_POSSIVEL_TESTAR'
  | 'OBSTRUIDO'
  | 'DANIFICADO'
  | 'REMOVIDO';

export const SDAI_DEVICE_RESULTS: SdaiDeviceResult[] = [
  'TESTADO_APROVADO', 'TESTADO_FALHOU', 'NAO_LOCALIZADO',
  'NAO_FOI_POSSIVEL_TESTAR', 'OBSTRUIDO', 'DANIFICADO', 'REMOVIDO',
];

/** Rótulos legíveis (usados nas opções do template). */
export const SDAI_DEVICE_RESULT_LABEL: Record<SdaiDeviceResult, string> = {
  TESTADO_APROVADO: 'Testado e aprovado',
  TESTADO_FALHOU: 'Testado e reprovou',
  NAO_LOCALIZADO: 'Não localizado',
  NAO_FOI_POSSIVEL_TESTAR: 'Não foi possível testar',
  OBSTRUIDO: 'Obstruído',
  DANIFICADO: 'Danificado',
  REMOVIDO: 'Removido',
};
export const SDAI_DEVICE_RESULT_OPCOES: string[] = SDAI_DEVICE_RESULTS.map((r) => SDAI_DEVICE_RESULT_LABEL[r]);

/** Converte o rótulo escolhido no formulário de volta ao resultado canônico. */
export function resultFromLabel(label: string): SdaiDeviceResult | undefined {
  return SDAI_DEVICE_RESULTS.find((r) => SDAI_DEVICE_RESULT_LABEL[r] === label);
}
/** Rótulos que abrem pendência (para `abre_pendencia_se` do template). */
export const SDAI_DEVICE_RESULT_PENDENCIA_LABELS: string[] =
  SDAI_DEVICE_RESULTS.filter(resultOpensPendencia).map((r) => SDAI_DEVICE_RESULT_LABEL[r]);

/**
 * Mapeia o resultado operacional para device_verifications.condicao (enum REAL
 * da 0095 — sem novo enum). REMOVIDO não é condição de verificação: é ciclo de
 * vida (base_update_decision), então retorna null.
 */
export function mapDeviceResultToCondicao(result: SdaiDeviceResult): AssetConditionValue | null {
  switch (result) {
    case 'TESTADO_APROVADO': return 'NORMAL';
    case 'TESTADO_FALHOU': return 'INOPERANTE';
    case 'DANIFICADO': return 'COM_AVARIA';
    case 'OBSTRUIDO': return 'INADEQUADO';
    case 'NAO_LOCALIZADO': return 'NAO_LOCALIZADO';
    case 'NAO_FOI_POSSIVEL_TESTAR': return 'NAO_TESTADO';
    case 'REMOVIDO': return null;
  }
}

/** Resultado que caracteriza problema → abre pendência (§13). */
export function resultOpensPendencia(result: SdaiDeviceResult): boolean {
  return result === 'TESTADO_FALHOU' || result === 'NAO_LOCALIZADO'
    || result === 'OBSTRUIDO' || result === 'DANIFICADO';
}

/** Resultado que conta como "não testado" no consolidado (programado ≠ testado). */
export function resultIsNaoTestado(result: SdaiDeviceResult): boolean {
  return result === 'NAO_LOCALIZADO' || result === 'NAO_FOI_POSSIVEL_TESTAR' || result === 'OBSTRUIDO';
}

/**
 * Monta a verificação (device_verifications) a ser persistida NO MOMENTO da
 * execução (§11) — histórico do ativo não espera o relatório mensal. Retorna
 * null para REMOVIDO (tratar por ciclo de vida, não por verificação). `id`
 * opcional (gerado no cliente) → replay offline idempotente.
 */
export function buildDeviceVerificationFromResult(input: {
  deviceId: string;
  result: SdaiDeviceResult;
  clienteId?: string;
  serviceAttendanceId?: string;
  surveyId?: string;
  notes?: string;
  verifiedAt?: string;
  id?: string;
}): (Omit<DeviceVerification, 'id'> & { id?: string }) | null {
  const condicao = mapDeviceResultToCondicao(input.result);
  if (condicao == null) return null; // REMOVIDO → ciclo de vida, não verificação
  return {
    deviceId: input.deviceId,
    clienteId: input.clienteId,
    surveyId: input.surveyId,
    condicao,
    reconciliation: input.result === 'NAO_LOCALIZADO' ? 'NAO_LOCALIZADO' : undefined,
    notes: input.notes,
    serviceAttendanceId: input.serviceAttendanceId,
    source: 'ATENDIMENTO',
    verifiedAt: input.verifiedAt,
    id: input.id,
  };
}

/* --------------------------- Checklist da central (§3/§5) ------------------ */

/** Registro normalizado de "checklist da central" extraído de um relatório. */
export interface CentralChecklistRecord {
  reportId: string;
  centralDeviceId: string;
  done: boolean;            // checklist da central concluído neste relatório
  date?: string;            // data do atendimento/relatório
  tecnicoId?: string;
  refazer?: boolean;        // técnico/admin pediu refazer
}

const dOnly = (v?: string): string | undefined => (v ? String(v).slice(0, 10) : undefined);

/**
 * Situação do checklist da central NO PERÍODO (§3): há checklist concluído para
 * ESTA central dentro de [start,end]? Regra POR CENTRAL (não por atendimento nem
 * por cliente). Retorna o registro concluído mais recente do período, se houver.
 */
export function resolveCentralChecklist(
  records: CentralChecklistRecord[],
  centralDeviceId: string,
  periodStart: string,
  periodEnd: string
): { done: boolean; record?: CentralChecklistRecord } {
  const start = dOnly(periodStart)!;
  const end = dOnly(periodEnd)!;
  const doneInPeriod = records.filter(
    (r) => r.centralDeviceId === centralDeviceId && r.done && !r.refazer
      && dOnly(r.date) != null && dOnly(r.date)! >= start && dOnly(r.date)! <= end
  );
  if (doneInPeriod.length === 0) return { done: false };
  // mais recente por data
  const latest = doneInPeriod.reduce((a, b) => ((dOnly(b.date)! > dOnly(a.date)!) ? b : a));
  return { done: true, record: latest };
}

/**
 * O atendimento atual deve EXIGIR o checklist completo da central? Não exige se
 * já há checklist concluído no período para ESTA central — salvo "refazer"
 * explícito (§3). Determinístico.
 */
export function shouldRequireCentralChecklist(
  records: CentralChecklistRecord[],
  centralDeviceId: string,
  periodStart: string,
  periodEnd: string,
  opts?: { forceRefazer?: boolean }
): boolean {
  if (opts?.forceRefazer) return true;
  return !resolveCentralChecklist(records, centralDeviceId, periodStart, periodEnd).done;
}

/**
 * Adapter: extrai CentralChecklistRecord de relatórios + suas answers, usando as
 * chaves do template SDAI (central_device_id + checklist_central_concluido +
 * refazer_checklist_central). Só relatórios em status documental válido entram.
 */
export function extractCentralChecklistRecords(
  reports: Array<{ id: string; status: string; tecnicoId?: string; finalizadoEm?: string; iniciadoEm?: string }>,
  answersByReport: Map<string, Array<{ fieldKey: string; valor: unknown }>>,
  validStatuses: ReadonlyArray<string> = ['finalizado']
): CentralChecklistRecord[] {
  const out: CentralChecklistRecord[] = [];
  for (const r of reports) {
    if (!validStatuses.includes(r.status)) continue;
    const answers = answersByReport.get(r.id) ?? [];
    const get = (k: string) => answers.find((a) => a.fieldKey === k)?.valor;
    const central = get('central_device_id');
    if (central == null || central === '') continue;
    const done = get('checklist_central_concluido') === true || get('checklist_central_concluido') === 'Sim' || get('checklist_central_concluido') === 'Concluído';
    const refazer = get('refazer_checklist_central') === true || get('refazer_checklist_central') === 'Sim';
    out.push({
      reportId: r.id, centralDeviceId: String(central), done, refazer,
      date: dOnly(r.finalizadoEm ?? r.iniciadoEm), tecnicoId: r.tecnicoId,
    });
  }
  return out;
}

/* --------------------------- Laços dinâmicos (§8) -------------------------- */

/**
 * Laços de uma central derivados da Base: valores distintos de `laco` entre os
 * devices do mesmo cliente/sistema associados à central (por parentDeviceId OU
 * mesmo identificador de central). Sem info suficiente → [] (lacuna: entrada
 * manual segura, sem inventar). Ordenado e estável.
 */
export function resolveCentralLoops(central: Device, devices: Device[]): string[] {
  const irmaos = devices.filter((d) =>
    d.sistema === central.sistema && d.id !== central.id && (
      (central.parentDeviceId == null && d.parentDeviceId === central.id) ||
      (central.central != null && d.central === central.central) ||
      d.parentDeviceId === central.id
    )
  );
  const lacos = new Set<string>();
  for (const d of irmaos) if (d.laco != null && String(d.laco).trim() !== '') lacos.add(String(d.laco).trim());
  return Array.from(lacos).sort();
}

/* --------------------------- Devices planejados (§9) ----------------------- */

export interface ProgrammedDeviceCard {
  deviceId: string;
  tipo?: string;
  fabricante?: string;
  modelo?: string;
  central?: string;
  laco?: string;
  endereco?: string;
  codigo?: string;
  descricao?: string;
  lastTestAt?: string;
  nextTestAt?: string;
  technicalStatus?: MaintenanceAssetStatus;
  reason?: string;
  rotationSlot?: number;
}

/**
 * Cartões dos dispositivos PLANEJADOS a partir do MaintenancePeriodPlan (§9). A
 * lista NÃO é manual: vem de plan.programadosDeviceIds. Só campos reais dos
 * devices (Base canônica). O FormEngine consome como `dispositivosPadrao`.
 */
export function buildProgrammedDeviceCards(
  plan: MaintenancePeriodPlan,
  devices: Device[],
  lastTests?: Map<string, LastTestInfo>
): ProgrammedDeviceCard[] {
  const deviceById = new Map(devices.map((d) => [d.id, d] as const));
  const planById = new Map(plan.devices.map((a) => [a.deviceId, a] as const));
  const cards: ProgrammedDeviceCard[] = [];
  for (const deviceId of plan.programadosDeviceIds) {
    const d = deviceById.get(deviceId);
    if (!d) continue; // só Base real
    const a = planById.get(deviceId);
    cards.push({
      deviceId,
      tipo: d.tipoAtivo || d.tipoDispositivo,
      fabricante: d.fabricante,
      modelo: d.modelo,
      central: d.central,
      laco: d.laco,
      endereco: d.endereco,
      codigo: d.technicalIdentifier,
      descricao: d.localizacao,
      lastTestAt: a?.lastTestAt ?? lastTests?.get(deviceId)?.verifiedAt,
      nextTestAt: a?.nextTestAt,
      technicalStatus: a?.technicalStatus,
      reason: a?.reason,
      rotationSlot: a?.rotationSlot,
    });
  }
  return cards;
}

/* --------------------------- Pendências: dedupe (§13) ---------------------- */

const PENDENCIA_OPEN_STATUSES: ReadonlyArray<string> = ['aberta', 'orcada', 'aprovada', 'em_execucao'];

/**
 * Procura uma pendência ABERTA equivalente para o mesmo contexto, evitando
 * duplicar por mês (§13). Equivalência (forte→fraca):
 *  - mesmo cliente E mesmo device E (mesmo grupo OU mesma ação); ou
 *  - sem device: mesmo cliente E mesmo grupo E mesma descrição.
 * Sem contexto suficiente (sem device e sem grupo) → não deduplica (retorna
 * undefined) para não fundir pendências distintas por engano (lacuna registrada).
 */
export function findEquivalentOpenPendencia(
  existentes: Pendencia[],
  alvo: { clienteId?: string; deviceId?: string; grupo?: string; acaoRecomendada?: string; descricao?: string }
): Pendencia | undefined {
  const abertas = existentes.filter((p) => PENDENCIA_OPEN_STATUSES.includes(p.status));
  if (alvo.deviceId) {
    return abertas.find((p) =>
      p.deviceId === alvo.deviceId &&
      (alvo.clienteId == null || p.clienteId === alvo.clienteId) &&
      ((alvo.grupo != null && p.grupo === alvo.grupo) || (alvo.acaoRecomendada != null && p.acaoRecomendada === alvo.acaoRecomendada))
    );
  }
  if (alvo.grupo && alvo.descricao) {
    return abertas.find((p) =>
      p.grupo === alvo.grupo && p.descricao === alvo.descricao &&
      (alvo.clienteId == null || p.clienteId === alvo.clienteId)
    );
  }
  return undefined; // contexto insuficiente para dedupe seguro
}

/** Deve criar nova pendência? Só quando NÃO há equivalente aberta. */
export function shouldCreatePendencia(
  existentes: Pendencia[],
  alvo: Parameters<typeof findEquivalentOpenPendencia>[1]
): boolean {
  return findEquivalentOpenPendencia(existentes, alvo) === undefined;
}
