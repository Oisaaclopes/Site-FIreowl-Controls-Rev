import { getSupabaseClient } from './supabaseClient';

export type DayEntryKind = 'OBSERVACAO' | 'ATESTADO' | 'FERIADO' | 'FOLGA';

export interface DayEntry {
  id: string;
  userId: string;
  employeeName: string;
  refDate: string; // YYYY-MM-DD
  kind: DayEntryKind;
  note: string;
  certificatePath?: string;
  authorName?: string;
  authorRole?: string;
  createdAt?: string;
}

const TABLE = 'day_entries';

function rowToEntry(r: any): DayEntry {
  return {
    id: String(r.id),
    userId: r.user_id,
    employeeName: r.employee_name || '',
    refDate: r.ref_date || '',
    kind: (r.kind || 'OBSERVACAO') as DayEntryKind,
    note: r.note || '',
    certificatePath: r.certificate_path ?? undefined,
    authorName: r.author_name ?? undefined,
    authorRole: r.author_role ?? undefined,
    createdAt: r.created_at ?? undefined,
  };
}

// RLS: funcionário vê as próprias; admin/gestor veem todas
export async function fetchDayEntries(): Promise<DayEntry[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).select('*').order('ref_date', { ascending: false }).limit(200);
  if (error) throw error;
  return (data || []).map(rowToEntry);
}

export async function createDayEntry(input: {
  employeeName: string;
  refDate: string;
  kind: DayEntryKind;
  note: string;
  certificatePath?: string;
  authorName?: string;
  authorRole?: string;
}): Promise<DayEntry> {
  // user_id é preenchido pelo default auth.uid() no banco
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      employee_name: input.employeeName,
      ref_date: input.refDate,
      kind: input.kind,
      note: input.note || null,
      certificate_path: input.certificatePath || null,
      author_name: input.authorName || null,
      author_role: input.authorRole || null,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToEntry(data);
}

export async function deleteDayEntry(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
