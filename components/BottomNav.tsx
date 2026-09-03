'use client';

import React from 'react';
import { TabPath, UserRole } from '@/lib/types';
import { MODULE_META, quickMenuTabs } from '@/lib/modules';

/* Barra de navegação inferior — mobile (lg:hidden), TODOS os perfis (Fase 4.1).
   Slot 1 = Início (volta ao Menu Rápido); demais = módulos permitidos pelo RBAC. */

interface BottomNavProps {
  currentTab: TabPath;
  onSelectTab: (t: TabPath) => void;
  userRole: UserRole;
  /** Home Mobile ativa (Menu Rápido em foco). */
  homeActive: boolean;
  onGoHome: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab, userRole, homeActive, onGoHome }) => {
  // Até 4 módulos permitidos (a fonte é o RBAC via quickMenuTabs) + o Início.
  const tabs = quickMenuTabs(userRole).slice(0, 4);

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-navy border-t border-white/10 shadow-[0_-4px_12px_rgba(0,0,0,0.18)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navegação principal"
    >
      <div className="flex items-stretch justify-around">
        <button
          onClick={onGoHome}
          aria-current={homeActive ? 'page' : undefined}
          className={`flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 transition-colors ${homeActive ? 'text-white' : 'text-white/60 hover:text-white/90'}`}
        >
          <span className={`material-symbols-outlined text-[22px] ${homeActive ? 'text-primary' : ''}`}>home</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide">Início</span>
        </button>
        {tabs.map((t) => {
          const active = !homeActive && currentTab === t;
          return (
            <button
              key={t}
              onClick={() => onSelectTab(t)}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 transition-colors ${active ? 'text-white' : 'text-white/60 hover:text-white/90'}`}
            >
              <span className={`material-symbols-outlined text-[22px] ${active ? 'text-primary' : ''}`}>{MODULE_META[t].icon}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide truncate max-w-[68px]">{MODULE_META[t].short || MODULE_META[t].label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
