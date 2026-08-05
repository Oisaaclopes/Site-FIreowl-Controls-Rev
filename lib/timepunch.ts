import { getSupabaseClient } from './supabaseClient';
import { TimePunch } from './types';

const TABLE = 'time_punches';

const pad2 = (n: number) => n.toString().padStart(2, '0');
const fmtTimestamp = (d: Date) =>
  `${d.getDate()} ${d.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()} ${d.getFullYear()} | ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

function rowToPunch(r: any): TimePunch {
  const at = r.punched_at ? new Date(r.punched_at).getTime() : undefined;
  return {
    id: String(r.id),
    employeeName: r.employee_name || '',
    timestamp: at ? fmtTimestamp(new Date(at)) : '',
    type: r.type,
    locationStr:
      r.lat != null && r.lng != null && (Number(r.lat) || Number(r.lng))
        ? `${Number(r.lat).toFixed(6)}, ${Number(r.lng).toFixed(6)}`
        : 'Sem localização',
    lat: Number(r.lat ?? 0),
    lng: Number(r.lng ?? 0),
    status: r.status || 'APROVADO',
    at,
    accuracy: r.accuracy ?? undefined,
  };
}

// Lista os pontos que o usuário tem permissão de ver (RLS decide), mais recentes primeiro.
export async function fetchPunches(limit = 200): Promise<TimePunch[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('punched_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(rowToPunch);
}

// Registra uma batida (user_id é preenchido pelo default auth.uid() no banco).
export async function insertPunch(p: TimePunch): Promise<TimePunch> {
  const supabase = getSupabaseClient() as any;
  const row = {
    employee_name: p.employeeName,
    type: p.type,
    punched_at: new Date(p.at ?? Date.now()).toISOString(),
    lat: p.lat,
    lng: p.lng,
    accuracy: p.accuracy ?? null,
    status: p.status || 'APROVADO',
  };
  const { data, error } = await supabase.from(TABLE).insert(row).select().single();
  if (error) throw error;
  return rowToPunch(data);
}

// Cria uma batida para OUTRO funcionário (uso admin/gestor ao aprovar ajuste).
// Exige a política de insert 0017 (admin/gestor podem inserir para qualquer user_id).
export async function insertPunchForUser(input: {
  userId: string;
  employeeName: string;
  type: TimePunch['type'];
  atMs: number;
  status?: string;
}): Promise<TimePunch> {
  const supabase = getSupabaseClient() as any;
  const row = {
    user_id: input.userId,
    employee_name: input.employeeName,
    type: input.type,
    punched_at: new Date(input.atMs).toISOString(),
    lat: null,
    lng: null,
    accuracy: null,
    status: input.status || 'AJUSTADO',
  };
  const { data, error } = await supabase.from(TABLE).insert(row).select().single();
  if (error) throw error;
  return rowToPunch(data);
}

// Edita o horário/status de uma batida existente (uso admin/gestor). Exige a
// política de update 0017.
export async function updatePunchTime(id: string, atMs: number, status = 'AJUSTADO'): Promise<TimePunch> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from(TABLE)
    .update({ punched_at: new Date(atMs).toISOString(), status })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return rowToPunch(data);
}
