import { getSupabaseClient } from './supabaseClient';
import { CatalogoProvisorio } from './types';

/* ---------------------------------------------------------------------------
 * Homologação (§6.3 & §9): registros criados em campo nascem provisórios e são
 * consolidados pelo Administrativo antes de virarem propostas/produtos oficiais.
 * Clientes provisórios vivem em `clients` (pendente_validacao=true); marcas e
 * itens ficam em `catalogo_provisorio`.
 * ------------------------------------------------------------------------- */

const CLIENTS = 'clients';
const CATALOGO = 'catalogo_provisorio';

/** Promove um cliente provisório a oficial. */
export async function aprovarClienteProvisorio(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase
    .from(CLIENTS)
    .update({ pendente_validacao: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** Mescla o provisório num cliente oficial (reatribui referências no servidor). */
export async function mesclarClienteProvisorio(provId: string, oficialId: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.rpc('merge_provisional_client', {
    p_prov: provId,
    p_oficial: oficialId,
  });
  if (error) throw error;
}

/* --------------------------- catalogo_provisorio -------------------------- */

function rowToCatalogo(r: any): CatalogoProvisorio {
  return {
    id: String(r.id),
    tipo: r.tipo,
    dados: r.dados || {},
    reportOrigemId: r.report_origem_id ?? undefined,
    criadoPor: r.criado_por ?? undefined,
    status: r.status || 'pendente',
    registroFinalId: r.registro_final_id ?? undefined,
  };
}

export async function fetchCatalogoProvisorio(filter?: {
  tipo?: CatalogoProvisorio['tipo'];
  status?: CatalogoProvisorio['status'];
}): Promise<CatalogoProvisorio[]> {
  const supabase = getSupabaseClient() as any;
  let query = supabase.from(CATALOGO).select('*').order('created_at', { ascending: false });
  if (filter?.tipo) query = query.eq('tipo', filter.tipo);
  if (filter?.status) query = query.eq('status', filter.status);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(rowToCatalogo);
}

/** Atualiza status/dados de um registro provisório do catálogo. */
export async function atualizarCatalogoProvisorio(
  id: string,
  patch: {
    status?: CatalogoProvisorio['status'];
    registroFinalId?: string;
    dados?: Record<string, unknown>;
  }
): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.registroFinalId !== undefined) row.registro_final_id = patch.registroFinalId;
  if (patch.dados !== undefined) row.dados = patch.dados;
  const { error } = await supabase.from(CATALOGO).update(row).eq('id', id);
  if (error) throw error;
}
