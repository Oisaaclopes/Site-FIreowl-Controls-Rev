import { describe, expect, it } from 'vitest';
import { greeting, isHomeEligibleEntry, MODULE_META, quickMenuTabs, shouldRenderMobileHome } from './modules';
import { allowedTabs } from './rbac';
import { UserRole } from './types';

const ROLES: UserRole[] = ['ADMINISTRATIVO', 'GESTOR', 'FINANCEIRO', 'TECNICO'];

describe('menu rápido / RBAC (Fase 4.1)', () => {
  it('todos os módulos permitidos têm metadados de exibição', () => {
    for (const role of ROLES) for (const tab of allowedTabs(role)) expect(MODULE_META[tab]).toBeTruthy();
  });

  it('cards do menu rápido = exatamente os módulos permitidos pelo RBAC (nenhum a mais)', () => {
    for (const role of ROLES) {
      const cards = quickMenuTabs(role);
      const allowed = allowedTabs(role);
      expect(new Set(cards)).toEqual(new Set(allowed));
      expect(cards.length).toBe(allowed.length);
      expect(new Set(cards).size).toBe(cards.length); // sem duplicatas
    }
  });

  it('FINANCEIRO nunca recebe Fotos de Campo; TECNICO nunca recebe módulos administrativos', () => {
    expect(quickMenuTabs('FINANCEIRO')).not.toContain('fotos-de-campo');
    expect(quickMenuTabs('FINANCEIRO')).not.toContain('conta');
    const tecnico = quickMenuTabs('TECNICO');
    expect(tecnico).not.toContain('conta');
    expect(tecnico).not.toContain('financas');
    expect(tecnico).not.toContain('clientes');
    // TECNICO tem acesso operacional a Fotos de Campo (Passada 4 anterior).
    expect(tecnico).toContain('fotos-de-campo');
  });

  it('ordem de UX: técnico prioriza Atendimentos; admin/gestor priorizam Painel', () => {
    expect(quickMenuTabs('TECNICO')[0]).toBe('relatorios');
    expect(quickMenuTabs('ADMINISTRATIVO')[0]).toBe('painel');
    expect(quickMenuTabs('GESTOR')[0]).toBe('painel');
  });

  it('saudação por horário', () => {
    expect(greeting(new Date('2026-08-31T08:00:00'))).toBe('Bom dia');
    expect(greeting(new Date('2026-08-31T13:00:00'))).toBe('Boa tarde');
    expect(greeting(new Date('2026-08-31T20:00:00'))).toBe('Boa noite');
  });

  it('start mobile: raiz ou aba de pouso → Home; deep link → destino', () => {
    const landing = allowedTabs('TECNICO')[0]; // 'painel'
    expect(isHomeEligibleEntry(undefined, landing)).toBe(true); // raiz
    expect(isHomeEligibleEntry('painel', landing)).toBe(true);  // start_url do PWA
    expect(isHomeEligibleEntry('relatorios', landing)).toBe(false); // deep link
    // Só renderiza no mobile
    expect(shouldRenderMobileHome(true, true)).toBe(true);
    expect(shouldRenderMobileHome(false, true)).toBe(false); // desktop preserva fluxo
    expect(shouldRenderMobileHome(true, false)).toBe(false);
  });
});
