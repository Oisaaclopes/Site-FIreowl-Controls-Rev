'use client';

import React, { useState, useEffect } from 'react';
import { UserRole } from '@/lib/types';

interface HeaderProps {
  userRole: UserRole;
  onOpenAuthModal: () => void;
  onQuickSearchClick?: () => void;
  onNewOSClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  userRole,
  onOpenAuthModal,
  onQuickSearchClick,
  onNewOSClick
}) => {
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
    <header className="fixed top-0 left-64 right-0 h-16 bg-white z-40 flex items-center justify-between px-8 shadow-sm border-b border-slate-200">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200">
          <span className="material-symbols-outlined text-slate-500 text-base">event</span>
          <span className="font-data-mono text-slate-700 uppercase text-xs font-semibold">
            {currentDateTime}
          </span>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Unidade Londrina/PR — Operacional</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {onNewOSClick && (
          <button
            onClick={onNewOSClick}
            className="hidden sm:flex items-center gap-1.5 bg-[#E63946] hover:bg-[#a51515] text-white font-semibold text-xs px-4 py-2 rounded-md transition-colors shadow-sm uppercase tracking-wide"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Nova Ordem
          </button>
        )}

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

        {/* User Profile Info */}
        <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
          <div className="text-right hidden sm:block">
            <p className="font-bold text-slate-800 text-xs">Admin Fireowl</p>
            <p className="font-label-caps text-slate-500 text-[10px]">{userRole}</p>
          </div>
          <button
            onClick={onOpenAuthModal}
            className="w-9 h-9 rounded-full bg-[#1A1A72] flex items-center justify-center text-white hover:ring-2 hover:ring-[#E63946] transition-all shadow-sm"
            title="Painel de Acesso do Operador"
          >
            <span className="material-symbols-outlined text-[20px]">person</span>
          </button>
        </div>
      </div>
    </header>
  );
};
