import { getSupabaseClient } from './supabaseClient';
import { UserRole, UserStatus } from './types';
import { WorkSchedule, normalizeSchedule } from './schedule';

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  cargo?: string;
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
  status?: UserStatus;
  cargo?: string;
  fullName?: string;
  cpf?: string;
  birthDate?: string;
  phone?: string;
  schedule?: WorkSchedule;
  courses?: string[];
}

const VALID_STATUS: UserStatus[] = ['ATIVO', 'INATIVO', 'DESLIGADO'];
const normStatus = (s: unknown): UserStatus => (VALID_STATUS.includes(s as UserStatus) ? (s as UserStatus) : 'ATIVO');

function rowToUser(r: any): ManagedUser {
  return {
    id: String(r.id),
    email: r.email || '',
    name: r.name || (r.email || '').split('@')[0],
    role: r.role as UserRole,
    status: normStatus(r.status),
    cargo: r.cargo ?? undefined,
    fullName: r.full_name ?? undefined,
    cpf: r.cpf ?? undefined,
    birthDate: r.birth_date ?? undefined,
    phone: r.phone ?? undefined,
    schedule: r.schedule ? normalizeSchedule(r.schedule) : undefined,
    courses: Array.isArray(r.courses) ? r.courses : undefined,
  };
}

// Só ADMINISTRATIVO enxerga (RLS). select('*') tolera colunas ainda ausentes
// (status/cargo antes da migration 0061).
export async function listUsers(): Promise<ManagedUser[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToUser);
}

const profileFields = (u: Partial<NewUserInput>) => ({
  full_name: u.fullName || null,
  cpf: u.cpf || null,
  birth_date: u.birthDate || null,
  phone: u.phone || null,
  cargo: u.cargo || null,
  schedule: u.schedule ?? null,
  courses: u.courses ?? null,
});

// Trilha de auditoria (best-effort; nunca bloqueia; sem senha). user_id (actor)
// é preenchido pelo default auth.uid() no banco.
export async function logUserAudit(action: string, details: string): Promise<void> {
  try {
    const supabase = getSupabaseClient() as any;
    await supabase.from('audit_logs').insert({ action, module: 'usuarios', details });
  } catch {
    /* auditoria não deve quebrar a operação */
  }
}

// Diretório de técnicos ATRIBUÍVEIS a uma OS (status ATIVO + perfis operacionais).
// OBS: hoje a RLS de `profiles` só deixa ADMINISTRATIVO ler todos os perfis, então
// para GESTOR/TECNICO isto retorna [] (o diretório completo depende de uma policy
// de leitura mínima, prevista para a passada de RLS). Falha de acesso → [].
export async function fetchAssignableTechnicians(): Promise<ManagedUser[]> {
  try {
    const all = await listUsers();
    const OPERACIONAIS: UserRole[] = ['TECNICO', 'GESTOR', 'ADMINISTRATIVO'];
    return all
      .filter((u) => u.status === 'ATIVO' && OPERACIONAIS.includes(u.role))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } catch {
    return [];
  }
}

// Ativar / Inativar / Desligar — NUNCA deleta (preserva histórico).
export async function setUserStatus(id: string, status: UserStatus): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from('profiles').update({ status }).eq('id', id);
  if (error) throw error;
}

// Mensagens amigáveis (PT) por código de erro da Edge Function. Nunca expõe
// erro bruto do Supabase.
const CREATE_ERROR_MSG: Record<string, string> = {
  email_exists: 'Já existe um usuário com esse e-mail.',
  invalid_email: 'E-mail inválido.',
  weak_password: 'Senha inválida (mínimo de 6 caracteres).',
  invalid_role: 'Perfil de acesso inválido.',
  invalid_name: 'Informe o nome do usuário.',
  forbidden: 'Sem permissão: apenas o Administrativo pode criar usuários.',
  unauthorized: 'Sessão inválida. Faça login novamente.',
  profile_update_failed: 'Falha ao gravar os dados do usuário. Nenhuma conta foi criada.',
  create_failed: 'Não foi possível criar o usuário.',
  not_deployed: 'Serviço de criação de usuários indisponível. Verifique se a Edge Function "create-user" foi implantada.',
};

// Criação de usuário SERVER-SIDE via Edge Function (create-user). O browser
// NÃO chama mais auth.signUp — a service_role fica só na função. A sessão do
// admin (JWT) é enviada automaticamente pelo functions.invoke e validada lá.
export async function createUser(input: NewUserInput): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.functions.invoke('create-user', {
    body: {
      email: input.email,
      password: input.password,
      name: input.name,
      role: input.role,
      status: input.status ?? 'ATIVO',
      cargo: input.cargo ?? null,
      fullName: input.fullName ?? null,
      cpf: input.cpf ?? null,
      birthDate: input.birthDate ?? null,
      phone: input.phone ?? null,
      schedule: input.schedule ?? null,
      courses: input.courses ?? null,
    },
  });

  if (error) {
    // FunctionsHttpError expõe a Response em error.context; extrai o código.
    let code = '';
    try {
      const payload = await error.context?.json?.();
      code = payload?.error || '';
    } catch {
      /* corpo indisponível */
    }
    // Função ainda não implantada / rede: fecha o fluxo (não cai em signUp).
    if (!code && /not found|failed to (send|fetch)|404/i.test(error.message || '')) code = 'not_deployed';
    throw new Error(CREATE_ERROR_MSG[code] || CREATE_ERROR_MSG.create_failed);
  }
  if (data?.error) throw new Error(CREATE_ERROR_MSG[data.error] || CREATE_ERROR_MSG.create_failed);
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
  if (u.status) payload.status = u.status;
  const { error } = await supabase.from('profiles').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteUserProfile(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from('profiles').delete().eq('id', id);
  if (error) throw error;
}
