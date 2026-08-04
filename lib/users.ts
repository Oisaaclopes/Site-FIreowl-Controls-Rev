import { createClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';
import { UserRole } from './types';

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

// Lista os usuários (perfis). Requer que o solicitante seja ADMINISTRATIVO (RLS).
export async function listUsers(): Promise<ManagedUser[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, role')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((r: any) => ({
    id: String(r.id),
    email: r.email || '',
    name: r.name || (r.email || '').split('@')[0],
    role: r.role as UserRole,
  }));
}

// Cria um usuário de login (Supabase Auth) + perfil (via trigger, com name/role).
// Usa um cliente temporário para NÃO substituir a sessão do admin logado.
export async function createUser(
  email: string,
  password: string,
  name: string,
  role: UserRole
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const tmp = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await tmp.auth.signUp({
    email,
    password,
    options: { data: { name, role } },
  });
  if (error) throw error;
}

// Altera o nível de acesso (papel) de um usuário.
export async function updateUserRole(id: string, role: UserRole): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
  if (error) throw error;
}

// Remove o perfil do usuário — revoga o acesso ao sistema.
// (A conta de login em si só é excluída pelo painel do Supabase.)
export async function deleteUserProfile(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from('profiles').delete().eq('id', id);
  if (error) throw error;
}
