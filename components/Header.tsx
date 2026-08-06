'use client';

import React, { useState, useEffect } from 'react';
import { UserRole } from '@/lib/types';
import { usePrivacy } from '@/lib/privacy';

interface HeaderProps {
  userRole: UserRole;
  onOpenAuthModal: () => void;
  onQuickSearchClick?: () => void;
  onOpenMenu?: () => void;
  canSwitchRole?: boolean;
  /** Recolhe o offset esquerdo do header quando a sidebar está minimizada. */
  sidebarCollapsed?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  userRole,
  onOpenAuthModal,
  onQuickSearchClick,
  onOpenMenu,
  canSwitchRole = false,
  sidebarCollapsed = false,
}) => {
  const { isPrivacyModeActive, togglePrivacy } = usePrivacy();
  const [currentDateTime, setCurrentDateTime] = useState('24 Mai 2024 | 14:30');
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const day = now.getDate().toString().padStart(2, '0');
      const months = ['Jan', 'Fev', 'Mai', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const month = months[now.getMonth()];
      const year = now.getFullYear();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setCurrentDateTime(`${day} ${month} ${year} | ${hours}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 h-16 bg-slate-50/70 backdrop-blur-md z-40 flex items-center justify-between px-4 md:px-8 transition-[left] duration-300 ease-out ${sidebarCollapsed ? 'lg:left-20' : 'lg:left-64'}`}>
      <div className="flex items-center gap-2 md:gap-4 min-w-0">
        {/* Menu hambúrguer — apenas mobile/tablet */}
        <button
          onClick={onOpenMenu}
          aria-label="Abrir menu"
          className="lg:hidden w-10 h-10 -ml-1 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200">
          <span className="material-symbols-outlined text-slate-500 text-base">event</span>
          <span className="font-data-mono text-slate-700 uppercase text-xs font-semibold whitespace-nowrap">
            {currentDateTime}
          </span>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Unidade Londrina/PR — Operacional</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications Icon with Popup */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600 flex items-center justify-center"
            title="Notificações do Sistema"
          >
            <span className="material-symbols-outlined">notifications</span>
            <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#E63946] rounded-full ring-2 ring-white"></div>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-4 text-xs">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-3">
                <span className="font-bold text-slate-800 uppercase text-xs">Notificações Críticas</span>
                <span className="font-data-mono text-[10px] bg-red-100 text-[#E63946] px-2 py-0.5 rounded-full font-bold">3 Alertas</span>
              </div>
              <div className="space-y-2.5">
                <div className="p-2.5 bg-red-50 border-l-4 border-[#E63946] rounded-r-md">
                  <p className="font-bold text-[#E63946] uppercase text-[11px]">OS Atrasada - Condomínio Solar</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Aferição de baterias 24V pendente há 10 dias.</p>
                </div>
                <div className="p-2.5 bg-slate-50 border-l-4 border-slate-800 rounded-r-md">
                  <p className="font-bold text-slate-900 uppercase text-[11px]">Preventiva Catuaí Shopping</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Agendada inspeção do laço 02 hoje às 14:30.</p>
                </div>
                <div className="p-2.5 bg-amber-50 border-l-4 border-amber-500 rounded-r-md">
                  <p className="font-bold text-amber-900 uppercase text-[11px]">Estoque Mínimo - Botoeiras</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Apenas 12 unidades em estoque. Reposição recomendada.</p>
                </div>
              </div>
              <button
                onClick={() => setShowNotifications(false)}
                className="w-full mt-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-center text-[11px]"
              >
                Marcar todas como lidas
              </button>
            </div>
          )}
        </div>

        {/* Modo Privacidade — oculta valores financeiros */}
        <button
          onClick={togglePrivacy}
          aria-pressed={isPrivacyModeActive}
          title={isPrivacyModeActive ? 'Modo Privacidade ativo — mostrar valores' : 'Ocultar valores financeiros'}
          className={`relative p-2 rounded-full transition-colors flex items-center justify-center ${
            isPrivacyModeActive
              ? 'bg-[#1A1A72] text-white hover:bg-[#13135A]'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span className="material-symbols-outlined">
            {isPrivacyModeActive ? 'visibility_off' : 'visibility'}
          </span>
        </button>

        {/* User Profile Info */}
        <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
          <div className="text-right hidden sm:block">
            <p className="font-bold text-slate-800 text-xs">Admin Fireowl</p>
            <p className="font-label-caps text-slate-500 text-[10px]">{userRole}</p>
          </div>
          {canSwitchRole ? (
            <button
              onClick={onOpenAuthModal}
              className="w-9 h-9 rounded-full bg-[#1A1A72] flex items-center justify-center text-white hover:ring-2 hover:ring-[#E63946] transition-all shadow-sm"
              title="Simular perfil de acesso"
            >
              <span className="material-symbols-outlined text-[20px]">person</span>
            </button>
          ) : (
            <div
              className="w-9 h-9 rounded-full bg-[#1A1A72] flex items-center justify-center text-white shadow-sm"
              title="Perfil de acesso"
            >
              <span className="material-symbols-outlined text-[20px]">person</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
