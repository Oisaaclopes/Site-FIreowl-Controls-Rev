import { getSupabaseClient } from './supabaseClient';
import { UserRole } from './types';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

const VALID_ROLES: UserRole[] = ['ADMINISTRATIVO', 'TECNICO', 'GESTOR', 'FINANCEIRO'];
const normalizeRole = (r: unknown): UserRole =>
  VALID_ROLES.includes(r as UserRole) ? (r as UserRole) : 'TECNICO';

// Monta o AuthUser a partir do usuário do Supabase (perfil no banco > metadados > padrão)
async function toAuthUser(supabase: any, user: any): Promise<AuthUser> {
  let name = (user.email || '').split('@')[0] || 'Operador';
  let role: UserRole = 'TECNICO';

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, role')
      .eq('id', user.id)
      .single();
    if (profile) {
      if (profile.name) name = profile.name;
      role = normalizeRole(profile.role);
    } else {
      const meta = user.user_metadata || {};
      if (meta.name) name = meta.name;
      role = normalizeRole(meta.role);
    }
  } catch {
    const meta = user.user_metadata || {};
    if (meta.name) name = meta.name;
    role = normalizeRole(meta.role);
  }

  return { id: user.id, email: user.email || '', name, role };
}

// Faz login com e-mail e senha; retorna o usuário autenticado + perfil
export async function signIn(email: string, password: string): Promise<AuthUser> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return toAuthUser(supabase, data.user);
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
  return toAuthUser(supabase, user);
}
