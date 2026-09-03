import { getSupabaseClient } from './supabaseClient';
import { Contract } from './types';

const TABLE = 'contracts';

/**
 * Referência amigável do contrato exibida ao cliente. Usa o número estruturado
 * (`numero`, ex.: CTR-FWL-103) quando houver; senão deriva um código curto e
 * ESTÁVEL a partir do id — sem revelar ordem/sequência (nada de "001") e sem
 * expor o id interno (CTR-FOWL-<timestamp>).
 */
export function friendlyContractRef(c: Pick<Contract, 'id' | 'numero'>): string {
  const n = (c.numero || '').trim();
  if (n) return n;
  let h = 0;
  for (let i = 0; i < c.id.length; i++) h = (h * 31 + c.id.charCodeAt(i)) >>> 0;
  return `CTR-FWL-${100 + (h % 900)}`; // 3 dígitos, estável por contrato
}

/**
 * Próximo número sequencial para um NOVO contrato no padrão CTR-FWL-NNN,
 * a partir do maior número já usado nesse padrão; começa em 101.
 */
export function nextContractNumero(contracts: Pick<Contract, 'numero'>[]): string {
  let max = 100;
  for (const c of contracts) {
    const m = (c.numero || '').match(/CTR-FWL-(\d+)/i);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `CTR-FWL-${max + 1}`;
}

function rowToContract(r: any): Contract {
  return {
    id: String(r.id),
    clientName: r.client_name || '',
    unit: r.unit || '',
    monthlyValue: Number(r.monthly_value ?? 0),
    renewalDate: r.renewal_date || '',
    readjustmentIndex: r.readjustment_index || '',
    contractedHours: Number(r.contracted_hours ?? 0),
    usedHours: Number(r.used_hours ?? 0),
    status: (r.status || 'ATIVO') as Contract['status'],
    responsibleTech: r.responsible_tech || '',
    artDocumentRef: r.art_document_ref || '',
    clientId: r.client_id ?? undefined,
    startDate: r.start_date ?? undefined,
    contractType: r.contract_type ?? undefined,
    paymentDay: r.payment_day ?? undefined,
    sourcePedidoId: r.source_pedido_id ?? undefined,
    // ETAPA 3 (0056)
    numero: r.numero ?? undefined,
    responsavelComercial: r.responsavel_comercial ?? undefined,
    renovacaoAutomatica: r.renovacao_automatica ?? undefined,
    avisoAntecedenciaDias: r.aviso_antecedencia_dias ?? undefined,
    reajustePeriodicidadeMeses: r.reajuste_periodicidade_meses ?? undefined,
    faturamento: r.faturamento ?? undefined,
    impostosObs: r.impostos_obs ?? undefined,
    observacoesFinanceiras: r.observacoes_financeiras ?? undefined,
    areasCobertas: Array.isArray(r.areas_cobertas) ? r.areas_cobertas : undefined,
    tiposAtendimento: Array.isArray(r.tipos_atendimento) ? r.tipos_atendimento : undefined,
    incluso: Array.isArray(r.incluso) ? r.incluso : undefined,
    naoIncluso: Array.isArray(r.nao_incluso) ? r.nao_incluso : undefined,
    respContratada: Array.isArray(r.resp_contratada) ? r.resp_contratada : undefined,
    respContratante: Array.isArray(r.resp_contratante) ? r.resp_contratante : undefined,
    entregaveis: Array.isArray(r.entregaveis) ? r.entregaveis : undefined,
    materiaisPolitica: r.materiais_politica ?? undefined,
    materiaisObs: r.materiais_obs ?? undefined,
    sla: Array.isArray(r.sla) ? r.sla : undefined,
    observacoesOperacionais: r.observacoes_operacionais ?? undefined,
  };
}

function contractToRow(c: Contract): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: c.id,
    client_name: c.clientName,
    unit: c.unit,
    monthly_value: c.monthlyValue ?? 0,
    renewal_date: c.renewalDate,
    readjustment_index: c.readjustmentIndex,
    contracted_hours: c.contractedHours ?? 0,
    used_hours: c.usedHours ?? 0,
    status: c.status,
    responsible_tech: c.responsibleTech,
    art_document_ref: c.artDocumentRef,
    updated_at: new Date().toISOString(),
  };
  // Campos estendidos: só enviados quando presentes (compatível com bancos
  // sem a migração 0022 aplicada).
  if (c.clientId !== undefined) row.client_id = c.clientId;
  if (c.startDate !== undefined) row.start_date = c.startDate;
  if (c.contractType !== undefined) row.contract_type = c.contractType;
  if (c.paymentDay !== undefined) row.payment_day = c.paymentDay;
  if (c.sourcePedidoId !== undefined) row.source_pedido_id = c.sourcePedidoId;
  // ETAPA 3 (0056) — só envia quando presente (compatível com banco sem 0056).
  if (c.numero !== undefined) row.numero = c.numero;
  if (c.responsavelComercial !== undefined) row.responsavel_comercial = c.responsavelComercial;
  if (c.renovacaoAutomatica !== undefined) row.renovacao_automatica = c.renovacaoAutomatica;
  if (c.avisoAntecedenciaDias !== undefined) row.aviso_antecedencia_dias = c.avisoAntecedenciaDias;
  if (c.reajustePeriodicidadeMeses !== undefined) row.reajuste_periodicidade_meses = c.reajustePeriodicidadeMeses;
  if (c.faturamento !== undefined) row.faturamento = c.faturamento;
  if (c.impostosObs !== undefined) row.impostos_obs = c.impostosObs;
  if (c.observacoesFinanceiras !== undefined) row.observacoes_financeiras = c.observacoesFinanceiras;
  if (c.areasCobertas !== undefined) row.areas_cobertas = c.areasCobertas;
  if (c.tiposAtendimento !== undefined) row.tipos_atendimento = c.tiposAtendimento;
  if (c.incluso !== undefined) row.incluso = c.incluso;
  if (c.naoIncluso !== undefined) row.nao_incluso = c.naoIncluso;
  if (c.respContratada !== undefined) row.resp_contratada = c.respContratada;
  if (c.respContratante !== undefined) row.resp_contratante = c.respContratante;
  if (c.entregaveis !== undefined) row.entregaveis = c.entregaveis;
  if (c.materiaisPolitica !== undefined) row.materiais_politica = c.materiaisPolitica;
  if (c.materiaisObs !== undefined) row.materiais_obs = c.materiaisObs;
  if (c.sla !== undefined) row.sla = c.sla;
  if (c.observacoesOperacionais !== undefined) row.observacoes_operacionais = c.observacoesOperacionais;
  return row;
}

export async function fetchContracts(): Promise<Contract[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToContract);
}

export async function upsertContract(c: Contract): Promise<Contract> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).upsert(contractToRow(c), { onConflict: 'id' }).select().single();
  if (error) throw error;
  return rowToContract(data);
}

export async function deleteContract(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
