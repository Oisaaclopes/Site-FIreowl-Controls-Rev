'use client';

import React from 'react';
import { TabPath, UserRole } from '@/lib/types';

interface SidebarProps {
  currentTab: TabPath;
  onSelectTab: (tab: TabPath) => void;
  userRole: UserRole;
  onOpenAuthModal: () => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  userRole,
  onOpenAuthModal,
  onLogout
}) => {
  const navItems: { path: TabPath; label: string; icon: string; count?: number }[] = [
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

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-[#0f172a] z-50 flex flex-col border-r border-slate-800 shadow-xl">
      {/* Brand Header */}
      <div className="p-5 flex items-center gap-3 border-b border-slate-800">
        <div className="w-9 h-9 rounded-lg bg-[#ba1a1a] flex items-center justify-center text-white shadow-md">
          <span className="material-symbols-outlined text-[22px]">
            local_fire_department
          </span>
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-white tracking-wider uppercase text-lg leading-tight">
            FIREOWL
          </span>
          <span className="font-label-caps text-slate-400 text-[10px] tracking-widest mt-0.5">
            CONTROLS SYSTEMS
          </span>
        </div>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto space-y-1">
        {navItems.map((item) => {
          const isActive = currentTab === item.path;
          return (
            <button
              key={item.path}
              onClick={() => onSelectTab(item.path)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg transition-all duration-150 group text-left ${
                isActive
                  ? 'bg-[#ba1a1a] text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center">
                <span className={`material-symbols-outlined mr-3 text-[20px] transition-transform group-hover:scale-105 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>
                  {item.icon}
                </span>
                <span className="text-xs uppercase tracking-wider font-semibold">
                  {item.label}
                </span>
              </div>
              {item.count ? (
                <span className={`font-data-mono text-[10px] px-2 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Footer System Status / Operator Info */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="font-data-mono text-[10px] text-emerald-400 uppercase font-semibold">SISTEMA ONLINE</span>
          </div>
          <button
            onClick={onOpenAuthModal}
            className="font-label-caps text-[10px] text-slate-400 hover:text-white underline uppercase transition-colors"
          >
            Trocar Perfil
          </button>
        </div>
        <div className="flex items-center justify-between bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/50">
          <div className="flex flex-col">
            <span className="text-xs text-white font-bold">Admin Fireowl</span>
            <span className="font-label-caps text-[9px] text-slate-400">{userRole}</span>
          </div>
          <span className="material-symbols-outlined text-slate-400 text-base">badge</span>
        </div>
        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-1.5 mt-1 py-2 rounded-lg bg-slate-800/60 hover:bg-[#ba1a1a] text-slate-300 hover:text-white transition-colors font-label-caps text-[10px] uppercase tracking-wider"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            Sair do Sistema
          </button>
        )}
      </div>
    </aside>
  );
};
