import { TabPath, UserRole } from './types';

// Abas permitidas por perfil (RBAC). ADMINISTRATIVO = todas.
export const ROLE_TABS: Record<UserRole, TabPath[]> = {
  ADMINISTRATIVO: [
    'painel',
    'pedidos',
    'contratos',
    'receitas',
    'despesas',
    'financas',
    'agenda',
    'clientes',
    'fornecedores',
    'estoque',
    'catalogo',
    'servicos',
    'relatorios',
    'fotos-de-campo',
    'ponto',
    'conta',
  ],
  TECNICO: ['painel', 'agenda', 'pedidos', 'relatorios', 'fotos-de-campo', 'ponto'],
  GESTOR: ['painel', 'pedidos', 'contratos', 'agenda', 'clientes', 'servicos', 'estoque', 'catalogo', 'relatorios', 'fotos-de-campo', 'ponto'],
  FINANCEIRO: ['painel', 'pedidos', 'contratos', 'receitas', 'despesas', 'financas', 'clientes', 'fornecedores'],
};

export const allowedTabs = (role: UserRole): TabPath[] => ROLE_TABS[role] || ROLE_TABS.ADMINISTRATIVO;

/** Redefinir a senha de outro usuário é exclusivo do ADMINISTRATIVO (Fase B). */
export const canResetUserPassword = (role: UserRole): boolean => role === 'ADMINISTRATIVO';

export const isTabAllowed = (role: UserRole, tab: TabPath): boolean => allowedTabs(role).includes(tab);
