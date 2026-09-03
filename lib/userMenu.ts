import { UserRole } from './types';
import { isTabAllowed } from './rbac';

/**
 * Regras de visibilidade do MENU DO USUÁRIO (avatar).
 *
 * Conceito (refino de navegação §6/§13/§14): a sidebar é da EMPRESA (módulos);
 * o menu do avatar é da PESSOA logada (conta, preferências, sessão). Estes
 * helpers puros decidem quais itens pessoais aparecem — testáveis sem DOM.
 *
 * Importante: nada aqui move configuração ADMINISTRATIVA para usuários comuns.
 * "Configurações" (aba 'conta') e "Simular perfil" só aparecem para quem já
 * tem esse acesso pela autenticação/RBAC.
 */

export interface UserMenuContext {
  role: UserRole;
  usesTimeClock: boolean;
  /** Papel real é ADMINISTRATIVO (pode simular perfis / abrir Configurações). */
  canSwitchRole: boolean;
}

/** "Meu Ponto" — só para quem usa controle de ponto (profiles.uses_time_clock). */
export function showMeuPonto(ctx: Pick<UserMenuContext, 'usesTimeClock'>): boolean {
  return ctx.usesTimeClock === true;
}

/** "Configurações" (aba administrativa 'conta') — só para quem tem a aba no RBAC. */
export function showConfiguracoes(ctx: Pick<UserMenuContext, 'role'>): boolean {
  return isTabAllowed(ctx.role, 'conta');
}

/** "Simular perfil" (pré-visualização de acesso) — só para o admin real. */
export function showSimularPerfil(ctx: Pick<UserMenuContext, 'canSwitchRole'>): boolean {
  return ctx.canSwitchRole === true;
}

export interface UserMenuVisibility {
  meuPonto: boolean;
  aparencia: boolean;
  configuracoes: boolean;
  simularPerfil: boolean;
  trocarUsuario: boolean;
  sair: boolean;
}

/** Visibilidade consolidada de todos os itens do menu do usuário. */
export function userMenuVisibility(ctx: UserMenuContext): UserMenuVisibility {
  return {
    meuPonto: showMeuPonto(ctx),
    aparencia: true, // preferência pessoal disponível a todos
    configuracoes: showConfiguracoes(ctx),
    simularPerfil: showSimularPerfil(ctx),
    trocarUsuario: true, // logout → login (troca segura de conta)
    sair: true,
  };
}
