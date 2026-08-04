import { createClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';
import { UserRole } from './types';
import { WorkSchedule, normalizeSchedule } from './schedule';

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  fullName?: string;
  cpf?: string;
  birthDate?: string;
  phone?: string;
  schedule?: WorkSchedule;
  courses?: string[];
}

export interface NewUserInput {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  fullName?: string;
  cpf?: string;
  birthDate?: string;
  phone?: string;
  schedule?: WorkSchedule;
  courses?: string[];
}

function rowToUser(r: any): ManagedUser {
  return {
    id: String(r.id),
    email: r.email || '',
    name: r.name || (r.email || '').split('@')[0],
    role: r.role as UserRole,
    fullName: r.full_name ?? undefined,
    cpf: r.cpf ?? undefined,
    birthDate: r.birth_date ?? undefined,
    phone: r.phone ?? undefined,
    schedule: r.schedule ? normalizeSchedule(r.schedule) : undefined,
    courses: Array.isArray(r.courses) ? r.courses : undefined,
  };
}

// Só ADMINISTRATIVO enxerga (RLS). Traz os dados cadastrais dos funcionários.
export async function listUsers(): Promise<ManagedUser[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, role, full_name, cpf, birth_date, phone, schedule, courses')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToUser);
}

const profileFields = (u: Partial<NewUserInput>) => ({
  full_name: u.fullName || null,
  cpf: u.cpf || null,
  birth_date: u.birthDate || null,
  phone: u.phone || null,
  schedule: u.schedule ?? null,
  courses: u.courses ?? null,
});

// Cria o login (Auth, cliente temporário) + completa os dados do perfil.
export async function createUser(input: NewUserInput): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const tmp = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await tmp.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { name: input.name, role: input.role } },
  });
  if (error) throw error;

  // Completa os dados cadastrais do perfil (o admin logado tem update via RLS).
  const newId = data.user?.id;
  if (newId) {
    const supabase = getSupabaseClient() as any;
    await supabase.from('profiles').update({ name: input.name, ...profileFields(input) }).eq('id', newId);
  }
}

export async function updateUserRole(id: string, role: UserRole): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
  if (error) throw error;
}

// Atualiza os dados cadastrais de um funcionário existente
export async function updateUserProfile(id: string, u: Partial<NewUserInput>): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const payload: Record<string, unknown> = profileFields(u);
  if (u.name) payload.name = u.name;
  if (u.role) payload.role = u.role;
  const { error } = await supabase.from('profiles').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteUserProfile(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from('profiles').delete().eq('id', id);
  if (error) throw error;
}
