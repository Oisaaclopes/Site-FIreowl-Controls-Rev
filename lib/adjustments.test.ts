import { beforeEach, describe, expect, it, vi } from 'vitest';

// Supabase falso: captura o payload do insert e a sessão autenticada.
const h = vi.hoisted(() => {
  const state = { authUserId: 'auth-user-123' as string | null, insertPayload: null as any };
  const fake = {
    auth: { getUser: vi.fn(async () => ({ data: { user: state.authUserId ? { id: state.authUserId } : null } })) },
    from: () => ({
      insert: (payload: any) => {
        state.insertPayload = payload;
        return { select: () => ({ single: async () => ({ data: { id: 'new-id', ...payload }, error: null }) }) };
      },
    }),
  };
  return { state, fake };
});
vi.mock('./supabaseClient', () => ({ getSupabaseClient: () => h.fake }));

import { createAdjustment, hasRequestedTime } from './adjustments';

beforeEach(() => {
  h.state.authUserId = 'auth-user-123';
  h.state.insertPayload = null;
});

describe('hasRequestedTime — horário obrigatório', () => {
  it.each([
    ['08:01', true],
    ['08:01:00', true],
    ['', false],
    ['   ', false],
    [undefined, false],
    [null, false],
  ])('hasRequestedTime(%s) = %s', (value, expected) => {
    expect(hasRequestedTime(value as string | null | undefined)).toBe(expected);
  });
});

describe('createAdjustment — persistência de user_id', () => {
  const base = { employeeName: 'Rhuan M. Romeiro', refDate: '2026-09-01', type: 'ENTRADA' as const, requestedTime: '08:01', reason: 'x' };

  it('9. envia user_id da sessão explicitamente', async () => {
    await createAdjustment(base);
    expect(h.state.insertPayload.user_id).toBe('auth-user-123');
    expect(h.state.insertPayload.requested_time).toBe('08:01');
    expect(h.state.insertPayload.employee_name).toBe('Rhuan M. Romeiro');
  });

  it('usa userId explícito quando informado (sobrepõe a sessão)', async () => {
    await createAdjustment({ ...base, userId: 'forced-id' });
    expect(h.state.insertPayload.user_id).toBe('forced-id');
  });

  it('não envia user_id quando desconhecido (mantém default do banco)', async () => {
    h.state.authUserId = null;
    await createAdjustment(base);
    expect('user_id' in h.state.insertPayload).toBe(false);
  });

  it('envia original_punch_id quando há batida vinculada', async () => {
    await createAdjustment({ ...base, originalPunchId: 'punch-1' });
    expect(h.state.insertPayload.original_punch_id).toBe('punch-1');
  });
});
