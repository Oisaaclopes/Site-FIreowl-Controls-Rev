import { getSupabaseClient } from './supabaseClient';
import { Client } from './types';

const TABLE = 'clients';

function rowToClient(r: any): Client {
  return {
    id: String(r.id),
    code: r.code || '',
    name: r.name || '',
    cnpj: r.cnpj || '',
    segment: r.segment || '',
    contractStatus: (r.contract_status || 'EM DIA') as Client['contractStatus'],
    lastOSDate: r.last_os_date || '',
    lastOSType: r.last_os_type || '',
    address: r.address || '',
    contacts: Array.isArray(r.contacts) ? r.contacts : [],
    totalContractsValue: Number(r.total_contracts_value ?? 0),
    pendenteValidacao: r.pendente_validacao ?? undefined,
    createdByRole: r.created_by_role ?? undefined,
    fachadaPath: r.fachada_path ?? undefined,
  };
}

function clientToRow(c: Client): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: c.id,
    code: c.code,
    name: c.name,
    cnpj: c.cnpj,
    segment: c.segment,
    contract_status: c.contractStatus,
    last_os_date: c.lastOSDate,
    last_os_type: c.lastOSType,
    address: c.address,
    contacts: c.contacts ?? [],
    total_contracts_value: c.totalContractsValue ?? 0,
    updated_at: new Date().toISOString(),
  };
  // Campos de cliente provisório: só enviados quando presentes (compatível
  // com bancos sem a migração 0028_clients_provisional aplicada).
  if (c.pendenteValidacao !== undefined) row.pendente_validacao = c.pendenteValidacao;
  if (c.createdByRole !== undefined) row.created_by_role = c.createdByRole;
  // Só envia quando presente (compatível com bancos sem a migração 0039).
  if (c.fachadaPath !== undefined) row.fachada_path = c.fachadaPath || null;
  return row;
}

/**
 * Verifica se já existe cliente com o mesmo CNPJ (checagem de duplicata em
 * campo, antes de criar cliente provisório). Ignora pontuação do CNPJ.
 */
export async function findClientsByCnpj(cnpj: string): Promise<Client[]> {
  const digits = (cnpj || '').replace(/\D/g, '');
  if (!digits) return [];
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).select('*');
  if (error) throw error;
  return (data || [])
    .map(rowToClient)
    .filter((c: Client) => (c.cnpj || '').replace(/\D/g, '') === digits);
}

export async function fetchClients(): Promise<Client[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToClient);
}

export async function upsertClient(c: Client): Promise<Client> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).upsert(clientToRow(c), { onConflict: 'id' }).select().single();
  if (error) throw error;
  return rowToClient(data);
}

export async function deleteClient(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
