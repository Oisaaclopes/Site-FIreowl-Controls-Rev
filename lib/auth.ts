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
  firstAccessCompleted: boolean;
}

const VALID_STATUS: UserStatus[] = ['ATIVO', 'INATIVO', 'DESLIGADO'];
// Tolerante à migration 0061 ainda não aplicada: sem coluna → ATIVO.
const normalizeStatus = (s: unknown): UserStatus =>
  VALID_STATUS.includes(s as UserStatus) ? (s as UserStatus) : 'ATIVO';

const VALID_ROLES: UserRole[] = ['ADMINISTRATIVO', 'TECNICO', 'GESTOR', 'FINANCEIRO'];
const normalizeRole = (r: unknown): UserRole =>
  VALID_ROLES.includes(r as UserRole) ? (r as UserRole) : 'TECNICO';

const SNAPSHOT_KEY = 'fireowl_auth_snapshot';
// Snapshot mínimo do último acesso verificado ONLINE. Serve só como dica de UX
// para permitir a shell offline; a autorização real dos dados continua na RLS.
function saveSnapshot(user: AuthUser): void {
  try { window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(user)); } catch { /* storage indisponível */ }
}
function readSnapshot(userId: string): AuthUser | null {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as AuthUser;
    return snap && snap.id === userId ? snap : null;
  } catch { return null; }
}
export function clearAuthSnapshot(): void {
  try { window.localStorage.removeItem(SNAPSHOT_KEY); } catch { /* noop */ }
}

// Lê o perfil distinguindo três casos, essencial para não confundir "sem rede"
// com "revogado" (Fase 4.1 §6/§8): 'ok' | 'absent' (removido) | 'error' (offline).
async function readProfileState(supabase: any, user: any): Promise<{ state: 'ok'; user: AuthUser } | { state: 'absent' } | { state: 'error' }> {
  // select('*') é tolerante a colunas ainda ausentes (status/cargo antes da 0061).
  const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) return { state: 'error' };
  if (!profile) return { state: 'absent' };
  const name = profile.name || (user.email || '').split('@')[0] || 'Operador';
  return {
    state: 'ok',
    user: {
      id: user.id,
      email: user.email || '',
      name,
      role: normalizeRole(profile.role),
      status: normalizeStatus(profile.status),
      cargo: profile.cargo ?? undefined,
      schedule: profile.schedule ? normalizeSchedule(profile.schedule) : undefined,
      firstAccessCompleted: profile.first_access_completed !== false,
    },
  };
}

// Faz login com e-mail e senha; retorna o usuário autenticado + perfil
export async function signIn(email: string, password: string): Promise<AuthUser> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const res = await readProfileState(supabase, data.user);
  // Login é uma ação online: qualquer coisa que não seja um perfil válido derruba a sessão.
  if (res.state !== 'ok') {
    await supabase.auth.signOut();
    clearAuthSnapshot();
    throw new Error('PROFILE_NOT_AUTHORIZED');
  }
  // Bloqueio de ciclo de vida: apenas ATIVO entra.
  if (res.user.status !== 'ATIVO') {
    await supabase.auth.signOut();
    clearAuthSnapshot();
    throw new Error(res.user.status === 'DESLIGADO' ? 'PROFILE_DESLIGADO' : 'PROFILE_INATIVO');
  }
  if (res.user.firstAccessCompleted) saveSnapshot(res.user);
  else clearAuthSnapshot();
  return res.user;
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient() as any;
  clearAuthSnapshot();
  await supabase.auth.signOut();
}

/**
 * Observa mudanças de sessão do Supabase (logout em outra aba, token expirado
 * que não renovou). Chama `onSignedOut` quando não há mais sessão válida, para
 * o gate voltar ao login sem deixar a tela anterior acessível (Fase 4.1 §6).
 * Retorna uma função de cancelamento.
 */
export function onSessionLost(onSignedOut: () => void): () => void {
  try {
    const supabase = getSupabaseClient() as any;
    const { data } = supabase.auth.onAuthStateChange((event: string, session: any) => {
      if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) onSignedOut();
    });
    return () => { try { data?.subscription?.unsubscribe?.(); } catch { /* noop */ } };
  } catch {
    return () => {};
  }
}

/** Mensagem inline (PT) para o card de login — nunca expõe erro técnico do Supabase (§19). */
export function authErrorMessage(err: unknown): string {
  const msg = String((err as { message?: string })?.message || err || '');
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha inválidos.';
  if (/email not confirmed/i.test(msg)) return 'E-mail ainda não confirmado. Confirme o cadastro ou peça ao administrador.';
  if (/PROFILE_INATIVO/.test(msg)) return 'Seu acesso está temporariamente inativo. Entre em contato com o administrador.';
  if (/PROFILE_DESLIGADO/.test(msg)) return 'Este usuário não possui mais acesso ao sistema.';
  if (/PROFILE_NOT_AUTHORIZED/.test(msg)) return 'Acesso não autorizado. Fale com o administrador do sistema.';
  if (/network|fetch|Failed to fetch/i.test(msg)) return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';
  return 'Não foi possível entrar. Tente novamente.';
}

// Recupera a sessão atual (persistida no navegador), se houver.
// Política offline (Fase 4.1 §8): a entrada exige uma sessão Supabase válida.
// - perfil OK + ATIVO  → entra e atualiza o snapshot;
// - perfil ausente/revogado OU inativo/desligado → derruba a sessão (bloqueia);
// - erro de rede (offline): NÃO desloga. Se houver snapshot ATIVO do mesmo
//   usuário, permite a shell offline (a RLS segue sendo o gate real dos dados).
export async function getSessionUser(): Promise<AuthUser | null> {
  const supabase = getSupabaseClient() as any;
  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user;
  if (!user) return null;
  const res = await readProfileState(supabase, user);
  if (res.state === 'ok') {
    if (res.user.status !== 'ATIVO') {
      await supabase.auth.signOut();
      clearAuthSnapshot();
      return null;
    }
    if (res.user.firstAccessCompleted) saveSnapshot(res.user);
    else clearAuthSnapshot();
    return res.user;
  }
  if (res.state === 'absent') {
    // Perfil removido/revogado (confirmado online): derruba a sessão restaurada.
    await supabase.auth.signOut();
    clearAuthSnapshot();
    return null;
  }
  // res.state === 'error' → sem rede para validar. Mantém a sessão e usa o
  // snapshot do último acesso online, se e somente se estava ATIVO.
  const snap = readSnapshot(user.id);
  return snap && snap.status === 'ATIVO' ? snap : null;
}
