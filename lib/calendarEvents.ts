import { getSupabaseClient } from './supabaseClient';

/* ===================================================================
 * BLOCO 6 (QA) — Agenda corporativa: EVENTOS LIVRES (calendar_events).
 * Compromissos que NÃO exigem OS/Pedido/Cliente (reunião, visita, treinamento,
 * viagem, bloqueio de horário, compromisso pessoal…). Fonte separada das OS —
 * nunca cria OS para um evento livre. Degrada com segurança (lista vazia) se a
 * tabela ainda não existir (migration 0105 pendente em produção).
 * =================================================================== */

const TABLE = 'calendar_events';

export type CalendarEventCategory =
  | 'visita' | 'reuniao' | 'treinamento' | 'administrativo'
  | 'pessoal' | 'viagem' | 'bloqueio' | 'outro';

export const CALENDAR_CATEGORY_LABEL: Record<CalendarEventCategory, string> = {
  visita: 'Visita técnica',
  reuniao: 'Reunião',
  treinamento: 'Treinamento',
  administrativo: 'Administrativo',
  pessoal: 'Pessoal',
  viagem: 'Viagem',
  bloqueio: 'Bloqueio de horário',
  outro: 'Outro',
};

export interface CalendarEvent {
  id: string;
  title: string;
  category: CalendarEventCategory;
  /** yyyy-mm-dd (início). */
  eventDate: string;
  /** yyyy-mm-dd (fim; ausente = mesmo dia). */
  endDate?: string;
  /** HH:mm (ausente quando allDay). */
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  clientId?: string;
  location?: string;
  notes?: string;
  isPrivate: boolean;
  responsibles: string[];
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

function fromRow(r: any): CalendarEvent {
  return {
    id: String(r.id),
    title: r.title || '',
    category: (r.category || 'outro') as CalendarEventCategory,
    eventDate: r.event_date,
    endDate: r.end_date ?? undefined,
    startTime: r.start_time ? String(r.start_time).slice(0, 5) : undefined,
    endTime: r.end_time ? String(r.end_time).slice(0, 5) : undefined,
    allDay: !!r.all_day,
    clientId: r.client_id ?? undefined,
    location: r.location ?? undefined,
    notes: r.notes ?? undefined,
    isPrivate: !!r.is_private,
    responsibles: Array.isArray(r.responsibles) ? r.responsibles.map(String) : [],
    ownerId: r.owner_id ?? undefined,
    createdAt: r.created_at ?? undefined,
    updatedAt: r.updated_at ?? undefined,
  };
}

function toRow(e: Partial<CalendarEvent>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (e.id) row.id = e.id;
  if (e.title !== undefined) row.title = e.title;
  if (e.category !== undefined) row.category = e.category;
  if (e.eventDate !== undefined) row.event_date = e.eventDate;
  if (e.endDate !== undefined) row.end_date = e.endDate || null;
  if (e.allDay !== undefined) row.all_day = e.allDay;
  // Horários só quando NÃO é dia inteiro (evita gravar hora fantasma).
  if (e.allDay) { row.start_time = null; row.end_time = null; }
  else {
    if (e.startTime !== undefined) row.start_time = e.startTime || null;
    if (e.endTime !== undefined) row.end_time = e.endTime || null;
  }
  if (e.clientId !== undefined) row.client_id = e.clientId || null;
  if (e.location !== undefined) row.location = e.location || null;
  if (e.notes !== undefined) row.notes = e.notes || null;
  if (e.isPrivate !== undefined) row.is_private = e.isPrivate;
  if (e.responsibles !== undefined) row.responsibles = e.responsibles;
  row.updated_at = new Date().toISOString();
  return row;
}

/** Eventos livres num intervalo [fromDate, toDate] (yyyy-mm-dd). Degrada para
 *  lista vazia se a tabela não existir ainda (migration pendente). */
export async function fetchCalendarEvents(fromDate: string, toDate: string): Promise<CalendarEvent[]> {
  try {
    const supabase = getSupabaseClient() as any;
    // Intersecta o intervalo: evento começa antes/no fim E termina depois/no início.
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .lte('event_date', toDate)
      .or(`end_date.gte.${fromDate},and(end_date.is.null,event_date.gte.${fromDate})`)
      .order('event_date', { ascending: true });
    if (error) return [];
    return (data || []).map(fromRow);
  } catch {
    return [];
  }
}

/** Cria/atualiza um evento livre (RLS decide a permissão). */
export async function upsertCalendarEvent(event: Partial<CalendarEvent>): Promise<CalendarEvent> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).upsert(toRow(event)).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
