import { getSupabaseClient } from './supabaseClient';
import { CicloAmostragem } from './types';

/* ---------------------------------------------------------------------------
 * Amostragem rotativa da preventiva (Fase 3c). Cada visita testa uma fatia do
 * parque (percentual_por_visita); ao longo do período do ciclo todos os
 * dispositivos são cobertos. O ciclo acumula quantos já foram testados.
 * ------------------------------------------------------------------------- */

const TABLE = 'ciclos_amostragem';

function rowToCiclo(r: any): CicloAmostragem {
  return {
    id: String(r.id),
    clienteId: r.cliente_id ?? undefined,
    contratoId: r.contrato_id ?? undefined,
    periodoInicio: r.periodo_inicio ?? undefined,
    periodoFim: r.periodo_fim ?? undefined,
    percentualPorVisita: r.percentual_por_visita ?? undefined,
    dispositivosTotais: r.dispositivos_totais ?? 0,
    dispositivosTestados: r.dispositivos_testados ?? 0,
  };
}

/** Cobertura acumulada do ciclo (0..1). */
export function coberturaCiclo(c: CicloAmostragem): number {
  const total = c.dispositivosTotais || 0;
  if (total <= 0) return 0;
  return Math.min(1, (c.dispositivosTestados || 0) / total);
}

/** Quota de dispositivos a testar nesta visita a partir do percentual do ciclo. */
export function quotaPorVisita(c: CicloAmostragem): number {
  const total = c.dispositivosTotais || 0;
  const pct = c.percentualPorVisita || 0;
  if (total <= 0 || pct <= 0) return total; // sem amostragem definida: testa tudo
  return Math.max(1, Math.ceil((total * pct) / 100));
}

/** Ciclo vigente do cliente (período cobre hoje) ou o mais recente. */
export async function fetchCicloAtivo(clienteId: string): Promise<CicloAmostragem | null> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('cliente_id', clienteId)
    .order('periodo_inicio', { ascending: false });
  if (error) throw error;
  const ciclos = (data || []).map(rowToCiclo);
  if (ciclos.length === 0) return null;
  const hoje = new Date().toISOString().slice(0, 10);
  const vigente = ciclos.find(
    (c: CicloAmostragem) =>
      (!c.periodoInicio || c.periodoInicio <= hoje) && (!c.periodoFim || c.periodoFim >= hoje)
  );
  return vigente || ciclos[0];
}

/**
 * Garante um ciclo vigente: se não houver, cria um trimestral cobrindo hoje
 * com percentual padrão (25% por visita) e o total de dispositivos informado.
 */
export async function ensureCicloAtivo(
  clienteId: string,
  dispositivosTotais: number,
  opts?: { percentualPorVisita?: number; contratoId?: string }
): Promise<CicloAmostragem> {
  const existente = await fetchCicloAtivo(clienteId);
  if (existente) {
    // Mantém o total sincronizado com o parque atual.
    if ((existente.dispositivosTotais || 0) !== dispositivosTotais) {
      await updateCiclo(existente.id, { dispositivosTotais });
      return { ...existente, dispositivosTotais };
    }
    return existente;
  }
  const hoje = new Date();
  const fim = new Date(hoje);
  fim.setMonth(fim.getMonth() + 3);
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      cliente_id: clienteId,
      contrato_id: opts?.contratoId ?? null,
      periodo_inicio: hoje.toISOString().slice(0, 10),
      periodo_fim: fim.toISOString().slice(0, 10),
      percentual_por_visita: opts?.percentualPorVisita ?? 25,
      dispositivos_totais: dispositivosTotais,
      dispositivos_testados: 0,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToCiclo(data);
}

export async function updateCiclo(
  id: string,
  patch: Partial<Pick<CicloAmostragem, 'dispositivosTotais' | 'dispositivosTestados' | 'percentualPorVisita' | 'periodoFim'>>
): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const row: Record<string, unknown> = {};
  if (patch.dispositivosTotais !== undefined) row.dispositivos_totais = patch.dispositivosTotais;
  if (patch.dispositivosTestados !== undefined) row.dispositivos_testados = patch.dispositivosTestados;
  if (patch.percentualPorVisita !== undefined) row.percentual_por_visita = patch.percentualPorVisita;
  if (patch.periodoFim !== undefined) row.periodo_fim = patch.periodoFim;
  if (Object.keys(row).length === 0) return;
  const { error } = await supabase.from(TABLE).update(row).eq('id', id);
  if (error) throw error;
}

/**
 * Contabiliza dispositivos testados nesta visita. Se a cobertura fechar o
 * ciclo, reinicia o contador para a próxima rodada (rotação contínua).
 */
export async function registrarTestesNoCiclo(ciclo: CicloAmostragem, novosTestados: number): Promise<void> {
  if (novosTestados <= 0) return;
  const total = ciclo.dispositivosTotais || 0;
  let acumulado = (ciclo.dispositivosTestados || 0) + novosTestados;
  if (total > 0 && acumulado >= total) acumulado = 0; // fecha o ciclo e reinicia
  await updateCiclo(ciclo.id, { dispositivosTestados: acumulado });
}
