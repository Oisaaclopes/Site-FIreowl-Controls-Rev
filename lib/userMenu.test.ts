import { describe, it, expect } from 'vitest';
import { userMenuVisibility, showMeuPonto, showConfiguracoes, showSimularPerfil } from './userMenu';

describe('userMenu — visibilidade de itens pessoais', () => {
  it('uses_time_clock=true → "Meu Ponto" aparece', () => {
    expect(showMeuPonto({ usesTimeClock: true })).toBe(true);
  });

  it('uses_time_clock=false → "Meu Ponto" não aparece (Isaac/Ingrid)', () => {
    expect(showMeuPonto({ usesTimeClock: false })).toBe(false);
  });

  it('usuário comum não recebe Configurações administrativas', () => {
    // TÉCNICO e GESTOR não têm a aba 'conta' no RBAC.
    expect(showConfiguracoes({ role: 'TECNICO' })).toBe(false);
    expect(showConfiguracoes({ role: 'GESTOR' })).toBe(false);
    expect(showConfiguracoes({ role: 'FINANCEIRO' })).toBe(false);
  });

  it('admin mantém acesso administrativo (Configurações + Simular perfil)', () => {
    expect(showConfiguracoes({ role: 'ADMINISTRATIVO' })).toBe(true);
    expect(showSimularPerfil({ canSwitchRole: true })).toBe(true);
    expect(showSimularPerfil({ canSwitchRole: false })).toBe(false);
  });

  it('GESTOR com ponto: vê Meu Ponto, não vê Configurações/Simular', () => {
    const v = userMenuVisibility({ role: 'GESTOR', usesTimeClock: true, canSwitchRole: false });
    expect(v.meuPonto).toBe(true);
    expect(v.aparencia).toBe(true);
    expect(v.configuracoes).toBe(false);
    expect(v.simularPerfil).toBe(false);
    expect(v.trocarUsuario).toBe(true);
    expect(v.sair).toBe(true);
  });

  it('ADMIN sem ponto: não vê Meu Ponto, vê Configurações/Simular', () => {
    const v = userMenuVisibility({ role: 'ADMINISTRATIVO', usesTimeClock: false, canSwitchRole: true });
    expect(v.meuPonto).toBe(false);
    expect(v.configuracoes).toBe(true);
    expect(v.simularPerfil).toBe(true);
  });
});
