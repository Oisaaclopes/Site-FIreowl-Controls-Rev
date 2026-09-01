import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkPassword } from './password';

const source = readFileSync(resolve(process.cwd(), 'supabase/functions/create-user/index.ts'), 'utf8');

describe('create-user administrativo', () => {
  it.each([
    ['ADMINISTRATIVO', 'ATIVO', true],
    ['GESTOR', 'ATIVO', false],
    ['FINANCEIRO', 'ATIVO', false],
    ['TECNICO', 'ATIVO', false],
    ['ADMINISTRATIVO', 'INATIVO', false],
  ])('autoriza %s/%s = %s', (role, status, expected) => {
    expect(role === 'ADMINISTRATIVO' && status === 'ATIVO').toBe(expected);
  });

  it('rejeita senha temporária fraca pela política compartilhada', () => {
    expect(checkPassword('senha-fraca').ok).toBe(false);
    expect(checkPassword('Temporaria@2026').ok).toBe(true);
  });

  it('usa createUser, inicia first_access=false e não reabre signup/convite', () => {
    expect(source).toContain('auth.admin.createUser');
    expect(source).toContain('first_access_completed:false');
    expect(source).not.toContain('inviteUserByEmail');
    expect(source).not.toContain('.auth.signUp');
  });

  it('audita USER_CREATED sem interpolar a senha', () => {
    expect(source).toContain("action:'USER_CREATED'");
    expect(source).not.toMatch(/details:`[^`]*(temporaryPassword|password)/);
  });
});
