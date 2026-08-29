import { ClientEvent } from './types';
import { getSupabaseClient } from './supabaseClient';

const TABLE = 'client_events';
const fromRow = (row: any): ClientEvent => ({ id: String(row.id), clientId: String(row.client_id), type: row.event_type || 'nota', content: row.content || '', authorName: row.author_name || undefined, createdAt: row.created_at });

export async function fetchClientEvents(clientId: string): Promise<ClientEvent[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).select('*').eq('client_id', clientId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function insertClientEvent(event: ClientEvent): Promise<ClientEvent> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).insert({ id: event.id, client_id: event.clientId, event_type: event.type, content: event.content, author_name: event.authorName || null, created_at: event.createdAt }).select().single();
  if (error) throw error;
  return fromRow(data);
}
