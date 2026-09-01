import { beforeEach, describe, expect, it, vi } from 'vitest';

// Estado controlável do Supabase falso (hoisted para o factory do vi.mock).
const h = vi.hoisted(() => {
  const state = {
    session: null as any,
    signInResponse: { data: { user: null as any }, error: null as any },
    profileResponse: { data: null as any, error: null as any },
  };
  const signOut = vi.fn(async () => { state.session = null; });
  const fake = {
    auth: {
      signInWithPassword: vi.fn(async () => state.signInResponse),
      getSession: vi.fn(async () => ({ data: { session: state.session } })),
      signOut,
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => state.profileResponse }) }) }),
  };
  return { state, fake, signOut };
});

vi.mock('./supabaseClient', () => ({ getSupabaseClient: () => h.fake }));

import { authErrorMessage, getSessionUser, signIn } from './auth';

const profile = (over: Record<string, unknown>) => ({ data: { name: 'Fulano', role: 'TECNICO', status: 'ATIVO', ...over }, error: null });

beforeEach(() => {
  h.state.session = null;
  h.state.signInResponse = { data: { user: { id: 'u1', email: 'a@fireowl.com' } }, error: null };
  h.state.profileResponse = profile({});
  h.signOut.mockClear();
});

describe('auth — gate de acesso (Fase 4.1)', () => {
  it('login ATIVO retorna o usuário e não desloga', async () => {
    const u = await signIn('a@fireowl.com', 'x');
    expect(u.role).toBe('TECNICO');
    expect(u.status).toBe('ATIVO');
    expect(h.signOut).not.toHaveBeenCalled();
  });

  it('login INATIVO é bloqueado e derruba a sessão', async () => {
    h.state.profileResponse = profile({ status: 'INATIVO' });
    await expect(signIn('a@fireowl.com', 'x')).rejects.toThrow(/PROFILE_INATIVO/);
    expect(h.signOut).toHaveBeenCalledTimes(1);
  });

  it('login DESLIGADO é bloqueado', async () => {
    h.state.profileResponse = profile({ status: 'DESLIGADO' });
    await expect(signIn('a@fireowl.com', 'x')).rejects.toThrow(/PROFILE_DESLIGADO/);
    expect(h.signOut).toHaveBeenCalledTimes(1);
  });

  it('login com senha temporária mantém sessão e sinaliza primeiro acesso pendente ao gate', async () => {
    h.state.profileResponse = profile({ first_access_completed: false });
    await expect(signIn('a@fireowl.com', 'x')).resolves.toMatchObject({ firstAccessCompleted: false });
    expect(h.signOut).not.toHaveBeenCalled();
  });

  it('primeiro acesso concluído libera o login', async () => {
    h.state.profileResponse = profile({ first_access_completed: true });
    await expect(signIn('a@fireowl.com', 'x')).resolves.toMatchObject({ firstAccessCompleted: true });
  });

  it('usuário histórico sem a coluna explícita continua liberado', async () => {
    await expect(signIn('a@fireowl.com', 'x')).resolves.toMatchObject({ firstAccessCompleted: true });
  });

  it('login sem perfil (revogado) não autoriza', async () => {
    h.state.profileResponse = { data: null, error: null };
    await expect(signIn('a@fireowl.com', 'x')).rejects.toThrow(/PROFILE_NOT_AUTHORIZED/);
    expect(h.signOut).toHaveBeenCalledTimes(1);
  });

  it('sessão ausente → sem usuário', async () => {
    h.state.session = null;
    expect(await getSessionUser()).toBeNull();
    expect(h.signOut).not.toHaveBeenCalled();
  });

  it('sessão válida ATIVA → restaura usuário', async () => {
    h.state.session = { user: { id: 'u1', email: 'a@fireowl.com' } };
    const u = await getSessionUser();
    expect(u?.status).toBe('ATIVO');
    expect(h.signOut).not.toHaveBeenCalled();
  });

  it('sessão restaurada com perfil inativo → derruba sessão', async () => {
    h.state.session = { user: { id: 'u1', email: 'a@fireowl.com' } };
    h.state.profileResponse = profile({ status: 'INATIVO' });
    expect(await getSessionUser()).toBeNull();
    expect(h.signOut).toHaveBeenCalledTimes(1);
  });

  it('deep link com sessão pendente permanece no estado obrigatório sem deslogar', async () => {
    h.state.session = { user: { id: 'u1', email: 'a@fireowl.com' } };
    h.state.profileResponse = profile({ first_access_completed: false });
    await expect(getSessionUser()).resolves.toMatchObject({ firstAccessCompleted: false });
    expect(h.signOut).not.toHaveBeenCalled();
  });

  it('perfil removido (confirmado online) → derruba sessão', async () => {
    h.state.session = { user: { id: 'u1', email: 'a@fireowl.com' } };
    h.state.profileResponse = { data: null, error: null };
    expect(await getSessionUser()).toBeNull();
    expect(h.signOut).toHaveBeenCalledTimes(1);
  });

  it('SEGURANÇA: erro de rede ao validar NÃO desloga (preserva a sessão para retry/offline)', async () => {
    h.state.session = { user: { id: 'u1', email: 'a@fireowl.com' } };
    h.state.profileResponse = { data: null, error: { message: 'Failed to fetch' } };
    // Sem snapshot em ambiente node → entra como não autenticado, mas a sessão é preservada.
    expect(await getSessionUser()).toBeNull();
    expect(h.signOut).not.toHaveBeenCalled();
  });

  it('mensagens de erro inline não expõem detalhe técnico', () => {
    expect(authErrorMessage(new Error('Invalid login credentials'))).toBe('E-mail ou senha inválidos.');
    expect(authErrorMessage(new Error('PROFILE_DESLIGADO'))).toMatch(/não possui mais acesso/);
    expect(authErrorMessage(new Error('Failed to fetch'))).toMatch(/Sem conexão/);
    expect(authErrorMessage(new Error('boom xyz'))).toBe('Não foi possível entrar. Tente novamente.');
  });
});
