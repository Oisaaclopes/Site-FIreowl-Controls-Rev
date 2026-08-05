import { getSupabaseClient } from './supabaseClient';

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  type: string;
}

export async function fetchHolidays(): Promise<Holiday[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from('holidays')
    .select('ref_date, name, type')
    .order('ref_date', { ascending: true });
  if (error) throw error;
  return (data || []).map((r: any) => ({ date: r.ref_date, name: r.name, type: r.type }));
}
