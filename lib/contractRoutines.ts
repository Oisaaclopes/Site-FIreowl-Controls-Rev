import { getSupabaseClient } from './supabaseClient';
import { ContractRoutine, ContractRoutineExecution, ContractHourEntry, ContractAttachment, ContractExecutionStatus } from './types';

/* ===================================================================
 * ETAPA 3 — Rotinas contratuais, execuções por competência (agenda),
 * bolsa de horas rastreável e anexos. A recorrência NÃO cria OS
 * antecipadamente: materializa competências sob demanda, com idempotência.
 * =================================================================== */

// ----------------------------- Cálculo puro -----------------------------

const MESES_POR_FREQ: Record<string, number> = {
  mensal: 1, bimestral: 2, trimestral: 3, quadrimestral: 4, semestral: 6, anual: 12,
};

/** Passo em meses da rotina (intervaloMeses ganha, senão deriva da frequência). */
export function intervaloMesesRotina(r: Pick<ContractRoutine, 'intervaloMeses' | 'frequencia'>): number {
  if (r.intervaloMeses && r.intervaloMeses > 0) return r.intervaloMeses;
  const f = (r.frequencia || '').toLowerCase();
  return MESES_POR_FREQ[f] || 1;
}

/** Rótulo de competência a partir de uma data e do passo (mensal→YYYY-MM, tri→YYYY-Qn, anual→YYYY). */
export function competenciaDe(date: Date, intervaloMeses: number): string {
  const y = date.getFullYear();
  if (intervaloMeses >= 12) return String(y);
  if (intervaloMeses >= 3) return `${y}-Q${Math.floor(date.getMonth() / 3) + 1}`;
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

const ehFimDeSemana = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
function primeiroDiaUtil(y: number, m: number): Date {
  const d = new Date(y, m, 1);
  while (ehFimDeSemana(d)) d.setDate(d.getDate() + 1);
  return d;
}
function ultimoDiaUtil(y: number, m: number): Date {
  const d = new Date(y, m + 1, 0);
  while (ehFimDeSemana(d)) d.setDate(d.getDate() - 1);
  return d;
}
const DOW: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };
/** Primeira ocorrência de um dia da semana no mês (ex.: "primeira_segunda"). */
function primeiroDiaSemana(y: number, m: number, dow: number): Date {
  const d = new Date(y, m, 1);
  while (d.getDay() !== dow) d.setDate(d.getDate() + 1);
  return d;
}

/** Resolve a data programada de uma competência conforme a `diaRegra`. */
export function dataProgramadaDe(y: number, m: number, diaRegra?: string): Date {
  const regra = (diaRegra || 'primeiro_dia_util').toLowerCase();
  if (regra === 'ultimo_dia_util') return ultimoDiaUtil(y, m);
  if (regra.startsWith('dia_fixo:')) {
    const n = Math.max(1, Math.min(28, Number(regra.split(':')[1]) || 1));
    return new Date(y, m, n);
  }
  const mm = regra.match(/^primeira_(dom|seg|ter|qua|qui|sex|sab)$/);
  if (mm) return primeiroDiaSemana(y, m, DOW[mm[1]]);
  return primeiroDiaUtil(y, m); // default
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Próxima execução prevista de uma rotina a partir de uma data de referência
 * (default hoje) e da lista de competências já existentes. Não cria nada — só
 * calcula a próxima competência ainda não materializada + sua data programada.
 */
export function proximaExecucaoRotina(
  rotina: ContractRoutine,
  competenciasExistentes: string[],
  hoje: Date = new Date()
): { competencia: string; dataProgramada: string } | null {
  if (rotina.ativo === false) return null;
  const passo = intervaloMesesRotina(rotina);
  if ((rotina.frequencia || '').toLowerCase() === 'sob_demanda') return null;
  const existentes = new Set(competenciasExistentes);
  // Caminha mês a mês (no passo) a partir do início do mês corrente por até 24 passos.
  const cursor = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  for (let i = 0; i < 24; i++) {
    const comp = competenciaDe(cursor, passo);
    const data = dataProgramadaDe(cursor.getFullYear(), cursor.getMonth(), rotina.diaRegra);
    // Só considera se a data programada é hoje ou no futuro e a competência é nova.
    if (!existentes.has(comp) && iso(data) >= iso(hoje)) {
      return { competencia: comp, dataProgramada: iso(data) };
    }
    cursor.setMonth(cursor.getMonth() + passo);
  }
  return null;
}

// ----------------------------- Rotinas -----------------------------

const routineRow = (r: any): ContractRoutine => ({
  id: String(r.id), contractId: String(r.contract_id), tipo: r.tipo || 'preventiva',
  descricao: r.descricao ?? undefined, frequencia: r.frequencia ?? undefined,
  intervaloMeses: r.intervalo_meses ?? undefined, diaRegra: r.dia_regra ?? undefined,
  diasSemana: Array.isArray(r.dias_semana) ? r.dias_semana : undefined,
  horarioInicio: r.horario_inicio ?? undefined, horarioFim: r.horario_fim ?? undefined,
  qtdTecnicos: r.qtd_tecnicos ?? undefined, horasMensais: r.horas_mensais ?? undefined,
  visitasMes: r.visitas_mes ?? undefined, sla: r.sla ?? undefined, area: r.area ?? undefined,
  ativo: r.ativo ?? true, observacoes: r.observacoes ?? undefined,
});
const routineToRow = (r: ContractRoutine): Record<string, unknown> => ({
  id: r.id && r.id.length > 20 ? r.id : undefined, contract_id: r.contractId, tipo: r.tipo,
  descricao: r.descricao ?? null, frequencia: r.frequencia ?? null, intervalo_meses: r.intervaloMeses ?? null,
  dia_regra: r.diaRegra ?? null, dias_semana: r.diasSemana ?? [], horario_inicio: r.horarioInicio ?? null,
  horario_fim: r.horarioFim ?? null, qtd_tecnicos: r.qtdTecnicos ?? 1, horas_mensais: r.horasMensais ?? null,
  visitas_mes: r.visitasMes ?? null, sla: r.sla ?? null, area: r.area ?? null, ativo: r.ativo ?? true,
  observacoes: r.observacoes ?? null,
});

export async function fetchContractRoutines(contractId: string): Promise<ContractRoutine[]> {
  const sb = getSupabaseClient() as any;
  const { data, error } = await sb.from('contract_routines').select('*').eq('contract_id', contractId).order('created_at');
  if (error) throw error;
  return (data || []).map(routineRow);
}
export async function upsertContractRoutine(r: ContractRoutine): Promise<ContractRoutine> {
  const sb = getSupabaseClient() as any;
  const row = routineToRow(r);
  if (!row.id) delete row.id;
  const { data, error } = await sb.from('contract_routines').upsert(row).select().single();
  if (error) throw error;
  return routineRow(data);
}
export async function deleteContractRoutine(id: string): Promise<void> {
  const sb = getSupabaseClient() as any;
  const { error } = await sb.from('contract_routines').delete().eq('id', id);
  if (error) throw error;
}

// ----------------------------- Execuções (agenda) -----------------------------

const execRow = (r: any): ContractRoutineExecution => ({
  id: String(r.id), contractId: String(r.contract_id), routineId: String(r.routine_id),
  competencia: r.competencia, dataProgramada: r.data_programada ?? undefined,
  status: (r.status || 'previsto') as ContractExecutionStatus,
  ordemServicoId: r.ordem_servico_id ?? undefined, reportId: r.report_id ?? undefined,
  observacoes: r.observacoes ?? undefined,
});

export async function fetchRoutineExecutions(contractId: string): Promise<ContractRoutineExecution[]> {
  const sb = getSupabaseClient() as any;
  const { data, error } = await sb.from('contract_routine_executions').select('*').eq('contract_id', contractId).order('data_programada');
  if (error) throw error;
  return (data || []).map(execRow);
}

/** Materializa (idempotente) uma competência via RPC. Não cria OS. */
export async function ensureRoutineExecution(routineId: string, competencia: string, dataProgramada: string): Promise<{ id: string; competencia: string; status: string; alreadyExists: boolean }> {
  const sb = getSupabaseClient() as any;
  const { data, error } = await sb.rpc('ensure_routine_execution', { p_routine_id: routineId, p_competencia: competencia, p_data_programada: dataProgramada });
  if (error) throw error;
  return { id: data.id, competencia: data.competencia, status: data.status, alreadyExists: !!data.already_exists };
}

export async function updateExecutionStatus(id: string, status: ContractExecutionStatus, patch?: { ordemServicoId?: string; reportId?: string; observacoes?: string }): Promise<void> {
  const sb = getSupabaseClient() as any;
  const row: Record<string, unknown> = { status };
  if (patch?.ordemServicoId !== undefined) row.ordem_servico_id = patch.ordemServicoId;
  if (patch?.reportId !== undefined) row.report_id = patch.reportId;
  if (patch?.observacoes !== undefined) row.observacoes = patch.observacoes;
  const { error } = await sb.from('contract_routine_executions').update(row).eq('id', id);
  if (error) throw error;
}

// ----------------------------- Bolsa de horas -----------------------------

const hourRow = (r: any): ContractHourEntry => ({
  id: String(r.id), contractId: String(r.contract_id), tipo: r.tipo, horas: Number(r.horas || 0),
  referencia: r.referencia ?? undefined, ordemServicoId: r.ordem_servico_id ?? undefined, data: r.data,
});
export async function fetchHourLedger(contractId: string): Promise<ContractHourEntry[]> {
  const sb = getSupabaseClient() as any;
  const { data, error } = await sb.from('contract_hour_ledger').select('*').eq('contract_id', contractId).order('data', { ascending: false });
  if (error) throw error;
  return (data || []).map(hourRow);
}
export async function addHourEntry(e: Omit<ContractHourEntry, 'id'>): Promise<ContractHourEntry> {
  const sb = getSupabaseClient() as any;
  const { data, error } = await sb.from('contract_hour_ledger').insert({
    contract_id: e.contractId, tipo: e.tipo, horas: e.horas, referencia: e.referencia ?? null,
    ordem_servico_id: e.ordemServicoId ?? null, data: e.data,
  }).select().single();
  if (error) throw error;
  return hourRow(data);
}
/** Saldo rastreável: contratada + ajustes(+) − consumida. */
export function saldoBolsaHoras(entries: ContractHourEntry[]): { contratada: number; consumida: number; saldo: number } {
  let contratada = 0, consumida = 0, ajuste = 0;
  for (const e of entries) {
    if (e.tipo === 'contratada') contratada += e.horas;
    else if (e.tipo === 'consumida') consumida += Math.abs(e.horas);
    else ajuste += e.horas;
  }
  return { contratada: contratada + Math.max(0, ajuste), consumida, saldo: contratada + ajuste - consumida };
}

// ----------------------------- Anexos -----------------------------

const attRow = (r: any): ContractAttachment => ({
  id: String(r.id), contractId: String(r.contract_id), tipo: r.tipo || 'anexo', nome: r.nome ?? undefined,
  storagePath: r.storage_path, mime: r.mime ?? undefined, tamanho: r.tamanho ?? undefined, createdAt: r.created_at ?? undefined,
});
export async function fetchContractAttachments(contractId: string): Promise<ContractAttachment[]> {
  const sb = getSupabaseClient() as any;
  const { data, error } = await sb.from('contract_attachments').select('*').eq('contract_id', contractId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(attRow);
}
export async function addContractAttachment(a: Omit<ContractAttachment, 'id' | 'createdAt'>): Promise<ContractAttachment> {
  const sb = getSupabaseClient() as any;
  const { data, error } = await sb.from('contract_attachments').insert({
    contract_id: a.contractId, tipo: a.tipo, nome: a.nome ?? null, storage_path: a.storagePath,
    mime: a.mime ?? null, tamanho: a.tamanho ?? null,
  }).select().single();
  if (error) throw error;
  return attRow(data);
}
export async function deleteContractAttachment(id: string): Promise<void> {
  const sb = getSupabaseClient() as any;
  const { error } = await sb.from('contract_attachments').delete().eq('id', id);
  if (error) throw error;
}
