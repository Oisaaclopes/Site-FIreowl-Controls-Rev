'use client';

import React from 'react';
import { TabPath, UserRole } from '@/lib/types';
import { allowedTabs } from '@/lib/rbac';

/* Barra de navegação inferior — apenas TÉCNICO, apenas mobile (lg:hidden).
   Substitui a sidebar como navegação primária no celular do técnico de campo. */

const META: Record<string, { label: string; icon: string }> = {
  painel: { label: 'Início', icon: 'home' },
  agenda: { label: 'Agenda', icon: 'calendar_today' },
  relatorios: { label: 'Relatórios', icon: 'assignment' },
  ponto: { label: 'Ponto', icon: 'schedule' },
  pedidos: { label: 'Pedidos', icon: 'receipt_long' },
};

// Ordem no bottom bar (Início, e Relatórios em destaque — foco do técnico).
const TECH_ORDER: TabPath[] = ['painel', 'agenda', 'relatorios', 'ponto'];

interface BottomNavProps {
  currentTab: TabPath;
  onSelectTab: (t: TabPath) => void;
  userRole: UserRole;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab, userRole }) => {
  if (userRole !== 'TECNICO') return null;
  const permitted = allowedTabs(userRole);
  const items = TECH_ORDER.filter((t) => permitted.includes(t) && META[t]);
  if (items.length === 0) return null;

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#1A1A72] border-t border-white/10 shadow-[0_-4px_12px_rgba(0,0,0,0.18)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navegação principal"
    >
      <div className="flex items-stretch justify-around">
        {items.map((t) => {
          const active = currentTab === t;
          return (
            <button
              key={t}
              onClick={() => onSelectTab(t)}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? 'text-white' : 'text-white/60 hover:text-white/90'
              }`}
            >
              <span className={`material-symbols-outlined text-[22px] ${active ? 'text-[#E63946]' : ''}`}>
                {META[t].icon}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide">{META[t].label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
