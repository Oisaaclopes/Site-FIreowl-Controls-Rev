/* ===================================================================
 * MANUTENÇÃO CONTRATUAL (0106) — camada de DADOS de asset_maintenance_policies.
 * Só I/O + mapeamento; a REGRA (resolução/precedência) vive em
 * lib/maintenancePolicies.ts (pura). §8: alterar periodicidade NÃO sobrescreve
 * — desativa a vigente e insere nova linha (histórico via ativa=false).
 * =================================================================== */
import { getSupabaseClient } from './supabaseClient';
import type { AssetMaintenancePolicy } from './types';

const TABLE = 'asset_maintenance_policies';

function rowToPolicy(r: any): AssetMaintenancePolicy {
  return {
    id: String(r.id),
    escopo: r.escopo,
    area: r.area ?? undefined,
    grupo: r.grupo ?? undefined,
    tipoAtivo: r.tipo_ativo ?? undefined,
    clienteId: r.cliente_id ?? undefined,
    contractId: r.contract_id ?? undefined,
    deviceId: r.device_id ?? undefined,
    periodicidadeValor: Number(r.periodicidade_valor),
    periodicidadeUnidade: r.periodicidade_unidade,
    obrigatorioNoCiclo: r.obrigatorio_no_ciclo ?? false,
    janelaToleranciaDias: r.janela_tolerancia_dias ?? undefined,
    ativa: r.ativa !== false,
    observacao: r.observacao ?? undefined,
    createdAt: r.created_at ?? undefined,
    updatedAt: r.updated_at ?? undefined,
  };
}

function policyToRow(p: AssetMaintenancePolicy): Record<string, unknown> {
  const row: Record<string, unknown> = {
    escopo: p.escopo,
    area: p.area ?? null,
    grupo: p.grupo ?? null,
    tipo_ativo: p.tipoAtivo ?? null,
    cliente_id: p.clienteId ?? null,
    contract_id: p.contractId ?? null,
    device_id: p.deviceId ?? null,
    periodicidade_valor: p.periodicidadeValor,
    periodicidade_unidade: p.periodicidadeUnidade,
    obrigatorio_no_ciclo: p.obrigatorioNoCiclo ?? false,
    janela_tolerancia_dias: p.janelaToleranciaDias ?? null,
    ativa: p.ativa ?? true,
    observacao: p.observacao ?? null,
  };
  if (p.id) row.id = p.id;
  return row;
}

/**
 * Todas as políticas ATIVAS. Config pequena; carregar tudo é simples e
 * offline-friendly — a resolução (pura) filtra por contexto. A RLS já restringe
 * leitura a ADMIN/GESTOR/TECNICO.
 */
export async function fetchActiveMaintenancePolicies(): Promise<AssetMaintenancePolicy[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).select('*').eq('ativa', true);
  if (error) throw error;
  return (data || []).map(rowToPolicy);
}

/** Todas as políticas (inclui inativas) — para a tela de configuração/histórico. */
export async function fetchAllMaintenancePolicies(): Promise<AssetMaintenancePolicy[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToPolicy);
}

export async function insertMaintenancePolicy(p: AssetMaintenancePolicy): Promise<AssetMaintenancePolicy> {
  const supabase = getSupabaseClient() as any;
  const { id, ...rest } = policyToRow(p);
  void id;
  const { data, error } = await supabase.from(TABLE).insert(rest).select().single();
  if (error) throw error;
  return rowToPolicy(data);
}

/** Desativa (histórico preservado). Não deleta. */
export async function deactivateMaintenancePolicy(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(TABLE).update({ ativa: false }).eq('id', id);
  if (error) throw error;
}

/**
 * Altera a periodicidade SEM sobrescrever (§8): desativa a política atual e cria
 * uma nova linha ativa com os mesmos seletores e o novo valor. Devolve a nova.
 */
export async function replaceMaintenancePolicy(
  current: AssetMaintenancePolicy,
  changes: Pick<AssetMaintenancePolicy, 'periodicidadeValor' | 'periodicidadeUnidade'> &
    Partial<Pick<AssetMaintenancePolicy, 'obrigatorioNoCiclo' | 'janelaToleranciaDias' | 'observacao'>>
): Promise<AssetMaintenancePolicy> {
  if (current.id) await deactivateMaintenancePolicy(current.id);
  const { id: _omit, createdAt: _c, updatedAt: _u, ...base } = current;
  void _omit; void _c; void _u;
  return insertMaintenancePolicy({ ...base, ...changes, ativa: true } as AssetMaintenancePolicy);
}
