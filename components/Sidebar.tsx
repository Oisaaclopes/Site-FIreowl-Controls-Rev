'use client';

import React from 'react';
import { TabPath, UserRole } from '@/lib/types';
import { OfficialLogo } from '@/components/OfficialLogo';
import { allowedTabs } from '@/lib/rbac';

interface SidebarProps {
  currentTab: TabPath;
  onSelectTab: (tab: TabPath) => void;
  userRole: UserRole;
  onOpenAuthModal: () => void;
  onLogout?: () => void;
  canSwitchRole?: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  /** Modo mini-sidebar (apenas ícones) no desktop. */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  userRole,
  onOpenAuthModal,
  onLogout,
  canSwitchRole = false,
  mobileOpen = false,
  onCloseMobile,
  collapsed = false,
  onToggleCollapse,
}) => {
  const allNavItems: { path: TabPath; label: string; icon: string; count?: number }[] = [
    { path: 'painel', label: 'Painel', icon: 'dashboard' },
    { path: 'pedidos', label: 'Pedidos', icon: 'receipt_long', count: 4 },
    { path: 'contratos', label: 'Contratos', icon: 'description', count: 4 },
    { path: 'receitas', label: 'Receitas', icon: 'trending_up' },
    { path: 'despesas', label: 'Despesas', icon: 'trending_down' },
    { path: 'financas', label: 'Finanças', icon: 'payments' },
    { path: 'agenda', label: 'Agenda', icon: 'calendar_today' },
    { path: 'clientes', label: 'Clientes', icon: 'group' },
    { path: 'fornecedores', label: 'Fornecedores', icon: 'local_shipping' },
    { path: 'estoque', label: 'Estoque', icon: 'inventory_2' },
    { path: 'servicos', label: 'Serviço', icon: 'construction' },
    { path: 'ponto', label: 'Ponto', icon: 'schedule' },
    { path: 'conta', label: 'Conta & Log', icon: 'settings' },
  ];

  // RBAC: mostra apenas as abas permitidas ao perfil logado
  const permitted = allowedTabs(userRole);
  const navItems = allNavItems.filter((item) => permitted.includes(item.path));

  // No mobile a sidebar é sempre "cheia" (off-canvas). O modo recolhido só
  // vale no desktop, por isso as classes de largura usam o prefixo lg:.
  const isCollapsed = collapsed;

  return (
    <>
      {/* Backdrop (apenas mobile, quando aberto) */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-full w-64 max-w-[85%] bg-[#1A1A72] z-50 flex flex-col border-r border-white/10 shadow-xl transform transition-[width,transform] duration-300 ease-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        {/* Brand Header — logo oficial da Fireowl Controls */}
        <div className={`p-5 flex items-center gap-3 border-b border-white/10 ${isCollapsed ? 'lg:justify-center lg:px-0' : ''}`}>
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-md shrink-0">
            <OfficialLogo className="w-8 h-8" />
          </div>
          <div className={`flex flex-col ${isCollapsed ? 'lg:hidden' : ''}`}>
            <span className="font-display font-bold text-white tracking-wider uppercase text-lg leading-tight">
              FIREOWL<span className="text-[#E63946]">.</span>
            </span>
            <span className="font-label-caps text-white/60 text-[10px] tracking-widest mt-0.5">
              CONTROLS SYSTEMS
            </span>
          </div>
          {/* Fechar (apenas mobile) */}
          <button
            onClick={onCloseMobile}
            aria-label="Fechar menu"
            className="ml-auto lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

      {/* Navigation items */}
      <nav className={`flex-1 py-4 px-3 space-y-1 overflow-y-auto ${isCollapsed ? 'lg:overflow-visible' : ''}`}>
        {navItems.map((item) => {
          const isActive = currentTab === item.path;
          return (
            <button
              key={item.path}
              onClick={() => {
                onSelectTab(item.path);
                onCloseMobile?.();
              }}
              title={isCollapsed ? item.label : undefined}
              className={`group/nav relative w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg transition-all duration-150 text-left ${
                isCollapsed ? 'lg:justify-center lg:px-0' : ''
              } ${
                isActive
                  ? 'bg-[#E63946] text-white font-semibold shadow-sm'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <div className={`flex items-center min-w-0 ${isCollapsed ? 'lg:justify-center' : ''}`}>
                <span className={`material-symbols-outlined text-[20px] transition-transform group-hover/nav:scale-105 ${isCollapsed ? 'lg:mr-0 mr-3' : 'mr-3'} ${isActive ? 'text-white' : 'text-white/70 group-hover/nav:text-white'}`}>
                  {item.icon}
                </span>
                <span className={`text-xs uppercase tracking-wider font-semibold truncate ${isCollapsed ? 'lg:hidden' : ''}`}>
                  {item.label}
                </span>
              </div>
              {item.count ? (
                <span className={`font-data-mono text-[10px] px-2 py-0.5 rounded-full font-bold ${isCollapsed ? 'lg:hidden' : ''} ${isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70'}`}>
                  {item.count}
                </span>
              ) : null}

              {/* Tooltip (somente no modo recolhido, desktop) */}
              {isCollapsed && (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 hidden lg:flex items-center whitespace-nowrap rounded-md bg-slate-900 text-white text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1.5 shadow-lg opacity-0 -translate-x-1 transition-all duration-150 group-hover/nav:opacity-100 group-hover/nav:translate-x-0"
                >
                  {item.label}
                  {item.count ? (
                    <span className="ml-2 font-data-mono bg-white/15 rounded-full px-1.5 py-0.5 text-[10px]">
                      {item.count}
                    </span>
                  ) : null}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Botão de recolher/expandir (apenas desktop) */}
      {onToggleCollapse && (
        <div className={`hidden lg:block px-3 pb-2 ${isCollapsed ? 'lg:px-0' : ''}`}>
          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-expanded={!isCollapsed}
            className={`w-full flex items-center gap-2 rounded-lg py-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors ${
              isCollapsed ? 'justify-center px-0' : 'px-3.5 justify-start'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">
              {isCollapsed ? 'chevron_right' : 'chevron_left'}
            </span>
            {!isCollapsed && (
              <span className="font-label-caps text-[10px] uppercase tracking-wider">Recolher menu</span>
            )}
          </button>
        </div>
      )}

      {/* Footer System Status / Operator Info */}
      <div className={`p-4 border-t border-white/10 bg-black/15 flex flex-col gap-2.5 ${isCollapsed ? 'lg:items-center lg:px-2' : ''}`}>
        <div className={`flex items-center justify-between ${isCollapsed ? 'lg:justify-center' : ''}`}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></div>
            <span className={`font-data-mono text-[10px] text-emerald-300 uppercase font-semibold ${isCollapsed ? 'lg:hidden' : ''}`}>SISTEMA ONLINE</span>
          </div>
          {canSwitchRole && (
            <button
              onClick={onOpenAuthModal}
              className={`font-label-caps text-[10px] text-white/60 hover:text-white underline uppercase transition-colors ${isCollapsed ? 'lg:hidden' : ''}`}
            >
              Simular perfil
            </button>
          )}
        </div>
        <div className={`flex items-center justify-between bg-white/10 p-2.5 rounded-lg border border-white/10 ${isCollapsed ? 'lg:hidden' : ''}`}>
          <div className="flex flex-col">
            <span className="text-xs text-white font-bold">Admin Fireowl</span>
            <span className="font-label-caps text-[9px] text-white/60">{userRole}</span>
          </div>
          <span className="material-symbols-outlined text-white/60 text-base">badge</span>
        </div>
        {onLogout && (
          <button
            onClick={onLogout}
            title={isCollapsed ? 'Sair do Sistema' : undefined}
            className={`w-full flex items-center justify-center gap-1.5 mt-1 py-2 rounded-lg bg-white/10 hover:bg-[#E63946] text-white/80 hover:text-white transition-colors font-label-caps text-[10px] uppercase tracking-wider ${
              isCollapsed ? 'lg:px-0' : ''
            }`}
          >
            <span className="material-symbols-outlined text-base">logout</span>
            <span className={isCollapsed ? 'lg:hidden' : ''}>Sair do Sistema</span>
          </button>
        )}
      </div>
      </aside>
    </>
  );
};
