import { TabPath, UserRole } from './types';
import { allowedTabs } from './rbac';

/* =====================================================================
 * Fonte ÚNICA de metadados de módulo (rótulo + ícone) para toda a
 * navegação: Sidebar, BottomNav e MobileQuickMenu leem daqui. Assim, se
 * uma permissão mudar no RBAC, os três continuam coerentes (Fase 4.1 §25).
 * A AUTORIZAÇÃO continua sendo exclusivamente do RBAC/RLS — este arquivo
 * só descreve como cada módulo permitido aparece.
 * ===================================================================== */
export interface ModuleMeta { label: string; icon: string; short?: string }

export const MODULE_META: Record<TabPath, ModuleMeta> = {
  painel: { label: 'Painel', icon: 'dashboard' },
  pedidos: { label: 'Pedidos', icon: 'receipt_long' },
  contratos: { label: 'Contratos', icon: 'description' },
  receitas: { label: 'Receitas', icon: 'trending_up' },
  despesas: { label: 'Despesas', icon: 'trending_down' },
  financas: { label: 'Finanças', icon: 'payments' },
  agenda: { label: 'Agenda', icon: 'calendar_today' },
  clientes: { label: 'Clientes', icon: 'group' },
  fornecedores: { label: 'Fornecedores', icon: 'local_shipping' },
  estoque: { label: 'Estoque', icon: 'inventory_2' },
  catalogo: { label: 'Catálogo', icon: 'account_tree' },
  servicos: { label: 'Serviço', icon: 'construction' },
  relatorios: { label: 'Atendimentos', icon: 'assignment', short: 'Atend.' },
  'fotos-de-campo': { label: 'Fotos de Campo', icon: 'photo_library', short: 'Fotos' },
  ponto: { label: 'Ponto', icon: 'schedule' },
  conta: { label: 'Conta & Log', icon: 'settings' },
};

/**
 * Ordem de INTENÇÃO de UX por perfil (Fase 4.1 §27). NÃO é autorização:
 * os cards do Menu Rápido são sempre `allowedTabs(role)`; esta lista só
 * define a ordem de exibição. Abas permitidas fora da intenção entram no fim.
 */
const QUICK_INTENT: Record<UserRole, TabPath[]> = {
  TECNICO: ['relatorios', 'agenda', 'fotos-de-campo', 'ponto', 'pedidos', 'painel'],
  GESTOR: ['painel', 'agenda', 'relatorios', 'fotos-de-campo', 'estoque', 'clientes', 'pedidos', 'contratos', 'servicos', 'ponto'],
  ADMINISTRATIVO: ['painel', 'pedidos', 'contratos', 'agenda', 'clientes', 'fotos-de-campo', 'relatorios', 'ponto', 'estoque', 'fornecedores', 'servicos', 'receitas', 'despesas', 'financas', 'conta'],
  FINANCEIRO: ['painel', 'pedidos', 'contratos', 'financas', 'receitas', 'despesas', 'clientes', 'fornecedores'],
};

/**
 * Módulos do Menu Rápido para o perfil: exatamente os permitidos pelo RBAC,
 * ordenados pela intenção de UX. Nunca inclui um módulo não autorizado (§26).
 */
export function quickMenuTabs(role: UserRole): TabPath[] {
  const allowed = allowedTabs(role);
  const allowedSet = new Set(allowed);
  const intent = (QUICK_INTENT[role] || []).filter((t) => allowedSet.has(t));
  const rest = allowed.filter((t) => !intent.includes(t));
  return [...intent, ...rest];
}

/** Saudação por horário (puro, testável). */
export function greeting(date: Date = new Date()): 'Bom dia' | 'Boa tarde' | 'Boa noite' {
  const h = date.getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

/**
 * Entrada elegível à Home Mobile: raiz (sem aba) OU a aba de pouso padrão do
 * perfil (painel). Um deep link para um módulo específico NÃO abre a Home,
 * preservando o destino (Fase 4.1 §33). `landing` = allowedTabs(role)[0].
 */
export function isHomeEligibleEntry(initialTab: TabPath | undefined, landing: TabPath): boolean {
  return !initialTab || initialTab === landing;
}

/** Decisão de renderização da Home Mobile: só no mobile e em entrada elegível. */
export function shouldRenderMobileHome(isMobile: boolean, homeActive: boolean): boolean {
  return isMobile && homeActive;
}
