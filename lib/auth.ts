import { getSupabaseClient } from './supabaseClient';
import { UserRole } from './types';
import { WorkSchedule, normalizeSchedule } from './schedule';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  schedule?: WorkSchedule;
}

const VALID_ROLES: UserRole[] = ['ADMINISTRATIVO', 'TECNICO', 'GESTOR', 'FINANCEIRO'];
const normalizeRole = (r: unknown): UserRole =>
  VALID_ROLES.includes(r as UserRole) ? (r as UserRole) : 'TECNICO';

// Monta o AuthUser a partir do perfil no banco. Sem perfil => sem acesso.
async function toAuthUser(supabase: any, user: any): Promise<AuthUser | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role, schedule')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) return null; // perfil removido/inexistente = acesso revogado

  const name = profile.name || (user.email || '').split('@')[0] || 'Operador';
  return {
    id: user.id,
    email: user.email || '',
    name,
    role: normalizeRole(profile.role),
    schedule: profile.schedule ? normalizeSchedule(profile.schedule) : undefined,
  };
}

// Faz login com e-mail e senha; retorna o usuário autenticado + perfil
export async function signIn(email: string, password: string): Promise<AuthUser> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const authUser = await toAuthUser(supabase, data.user);
  if (!authUser) {
    await supabase.auth.signOut();
    throw new Error('PROFILE_NOT_AUTHORIZED');
  }
  return authUser;
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient() as any;
  await supabase.auth.signOut();
}

// Recupera a sessão atual (persistida no navegador), se houver
export async function getSessionUser(): Promise<AuthUser | null> {
  const supabase = getSupabaseClient() as any;
  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user;
  if (!user) return null;
  const authUser = await toAuthUser(supabase, user);
  if (!authUser) {
    await supabase.auth.signOut();
    return null;
  }
  return authUser;
}
