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
  };
}

function clientToRow(c: Client): Record<string, unknown> {
  return {
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
