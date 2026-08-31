import { getSupabaseClient } from './supabaseClient';
import { UserRole, UserStatus } from './types';
import { WorkSchedule, normalizeSchedule } from './schedule';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  cargo?: string;
  schedule?: WorkSchedule;
}

const VALID_STATUS: UserStatus[] = ['ATIVO', 'INATIVO', 'DESLIGADO'];
// Tolerante à migration 0061 ainda não aplicada: sem coluna → ATIVO.
const normalizeStatus = (s: unknown): UserStatus =>
  VALID_STATUS.includes(s as UserStatus) ? (s as UserStatus) : 'ATIVO';

const VALID_ROLES: UserRole[] = ['ADMINISTRATIVO', 'TECNICO', 'GESTOR', 'FINANCEIRO'];
const normalizeRole = (r: unknown): UserRole =>
  VALID_ROLES.includes(r as UserRole) ? (r as UserRole) : 'TECNICO';

// Monta o AuthUser a partir do perfil no banco. Sem perfil => sem acesso.
async function toAuthUser(supabase: any, user: any): Promise<AuthUser | null> {
  // select('*') é tolerante a colunas ainda ausentes (status/cargo antes da 0061).
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) return null; // perfil removido/inexistente = acesso revogado

  const name = profile.name || (user.email || '').split('@')[0] || 'Operador';
  return {
    id: user.id,
    email: user.email || '',
    name,
    role: normalizeRole(profile.role),
    status: normalizeStatus(profile.status),
    cargo: profile.cargo ?? undefined,
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
  // Bloqueio de ciclo de vida: apenas ATIVO entra.
  if (authUser.status !== 'ATIVO') {
    await supabase.auth.signOut();
    throw new Error(authUser.status === 'DESLIGADO' ? 'PROFILE_DESLIGADO' : 'PROFILE_INATIVO');
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
  if (!authUser || authUser.status !== 'ATIVO') {
    // Perfil revogado OU inativo/desligado: derruba a sessão restaurada.
    await supabase.auth.signOut();
    return null;
  }
  return authUser;
}
