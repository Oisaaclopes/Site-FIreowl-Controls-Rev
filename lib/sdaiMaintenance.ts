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

/** Ordenação numérica quando ambos são números (1,2,10 — não 1,10,2); senão
 *  lexical estável. Endereço/laço são texto no schema; §2/§18 exigem ordem real. */
export function compareNumericThenText(a: string, b: string): number {
  const sa = String(a).trim(), sb = String(b).trim();
  const na = Number(sa), nb = Number(sb);
  const aNum = sa !== '' && Number.isFinite(na);
  const bNum = sb !== '' && Number.isFinite(nb);
  if (aNum && bNum) return na - nb;
  if (aNum) return -1;
  if (bNum) return 1;
  return sa.localeCompare(sb, 'pt-BR');
}

/** Devices que pertencem à central (parent explícito OU mesmo nº de central).
 *  NUNCA cruza centrais diferentes. Base é a fonte — sem texto livre. */
export function siblingsOfCentral(central: Pick<Device, 'id' | 'sistema' | 'central' | 'parentDeviceId'>, devices: Device[]): Device[] {
  return devices.filter((d) =>
    d.sistema === central.sistema && d.id !== central.id && (
      d.parentDeviceId === central.id ||
      (central.parentDeviceId == null && d.parentDeviceId === central.id) ||
      (central.central != null && String(central.central).trim() !== '' && d.central === central.central)
    )
  );
}

/**
 * Laços de uma central derivados da Base: valores distintos de `laco` entre os
 * devices da central. Sem info suficiente → [] (lacuna: entrada manual segura,
 * sem inventar). Ordenado NUMERICAMENTE (§2).
 */
export function resolveCentralLoops(central: Device, devices: Device[]): string[] {
  const lacos = new Set<string>();
  for (const d of siblingsOfCentral(central, devices)) {
    if (d.laco != null && String(d.laco).trim() !== '') lacos.add(String(d.laco).trim());
  }
  return Array.from(lacos).sort(compareNumericThenText);
}

/**
 * Endereços REALMENTE cadastrados em um laço da central (§3/§18). NUNCA assume
 * 1..N por contagem: retorna só os endereços existentes, distintos, numéricos-
 * ordenados. Restrito a cliente/central/laço (não usa devices de outro laço).
 */
export function resolveLoopAddresses(central: Device, loop: string, devices: Device[]): string[] {
  const alvoLaco = String(loop).trim();
  const enderecos = new Set<string>();
  for (const d of siblingsOfCentral(central, devices)) {
    if (String(d.laco ?? '').trim() !== alvoLaco) continue;
    const e = String(d.endereco ?? '').trim();
    if (e !== '') enderecos.add(e);
  }
  return Array.from(enderecos).sort(compareNumericThenText);
}

/**
 * Device canônico por (central, laço, endereço) — §4. Só retorna quando o
 * casamento é INEQUÍVOCO (exatamente 1). Ambiguidade/ausência → undefined
 * (a UI cai para entrada manual, sem alterar a Base).
 */
export function resolveDeviceByLoopAddress(central: Device, loop: string, address: string, devices: Device[]): Device | undefined {
  const alvoLaco = String(loop).trim();
  const alvoEnd = String(address).trim();
  const matches = siblingsOfCentral(central, devices).filter((d) =>
    String(d.laco ?? '').trim() === alvoLaco && String(d.endereco ?? '').trim() === alvoEnd
  );
  return matches.length === 1 ? matches[0] : undefined;
}

/* --------------------------- Baterias da central (§10/§11/§16) ------------- */

/** Classificação canônica de bateria. ATENÇÃO: a taxonomia SDAI (technicalBase)
 *  NÃO possui grupo 'Bateria' hoje (só 'Fonte / Alimentação'); 'Bateria' existe
 *  em ALARME. Prioriza o grupo canônico quando existir; fallback ao tipo do ativo
 *  (legado) — SEM texto do nome do produto. Ver lacuna reportada. */
export function isBatteryDevice(d: Pick<Device, 'grupo' | 'tipoAtivo' | 'tipoDispositivo' | 'status'>): boolean {
  if (d.status && d.status !== 'ativo') return false;
  const g = (d.grupo || '').trim().toUpperCase();
  if (g === 'BATERIA') return true;
  const tipo = (d.tipoAtivo || d.tipoDispositivo || '').trim().toUpperCase();
  return tipo === 'BATERIA';
}

/** Baterias vinculadas à central na Base (§11/§16). Sem bateria vinculada → []
 *  (a UI NÃO faz fallback para dispositivos de campo; usa catálogo/manual). */
export function resolveCentralBatteries(central: Device, devices: Device[]): Device[] {
  return siblingsOfCentral(central, devices).filter(isBatteryDevice);
}

/** Item de catálogo mínimo (produtos do Estoque) para o seletor de bateria. */
export interface BatteryCatalogItem { id: string; name?: string; category?: string; subcategory?: string; model?: string; brand?: string }

/**
 * Produtos de bateria do catálogo existente (§13). Filtra por categoria/
 * subcategoria/nome contendo "bateria/battery" — catálogo é texto livre, não há
 * taxonomia canônica de categoria; NÃO cria catálogo paralelo. Ordenado por nome.
 */
export function resolveBatteryCatalog(items: BatteryCatalogItem[]): BatteryCatalogItem[] {
  return items
    .filter((i) => /bateria|battery/i.test(`${i.category || ''} ${i.subcategory || ''} ${i.name || ''} ${i.model || ''}`))
    .sort((a, b) => `${a.brand || ''} ${a.model || a.name || ''}`.localeCompare(`${b.brand || ''} ${b.model || b.name || ''}`, 'pt-BR'));
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
