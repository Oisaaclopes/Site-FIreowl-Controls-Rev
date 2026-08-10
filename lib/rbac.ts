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
    'servicos',
    'relatorios',
    'ponto',
    'conta',
  ],
  TECNICO: ['agenda', 'pedidos', 'relatorios', 'ponto'],
  GESTOR: ['painel', 'pedidos', 'contratos', 'agenda', 'clientes', 'servicos', 'estoque', 'relatorios', 'ponto'],
  FINANCEIRO: ['painel', 'pedidos', 'contratos', 'receitas', 'despesas', 'financas', 'clientes', 'fornecedores'],
};

export const allowedTabs = (role: UserRole): TabPath[] => ROLE_TABS[role] || ROLE_TABS.ADMINISTRATIVO;

export const isTabAllowed = (role: UserRole, tab: TabPath): boolean => allowedTabs(role).includes(tab);
