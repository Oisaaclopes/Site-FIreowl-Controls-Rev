'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Pedido, UserRole } from '@/lib/types';
import { usePrivacy } from '@/lib/privacy';
import { pendingCount, isOnline } from '@/lib/offline/reportSync';

interface HeaderProps {
  userRole: UserRole;
  userName: string;
  onOpenAuthModal: () => void;
  onQuickSearchClick?: () => void;
  onOpenMenu?: () => void;
  canSwitchRole?: boolean;
  /** Recolhe o offset esquerdo do header quando a sidebar está minimizada. */
  sidebarCollapsed?: boolean;
  pedidos?: Pedido[];
  onOpenPedidos?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  userRole,
  userName,
  onOpenAuthModal,
  onQuickSearchClick,
  onOpenMenu,
  canSwitchRole = false,
  sidebarCollapsed = false,
  pedidos = [],
  onOpenPedidos,
}) => {
  const { isPrivacyModeActive, togglePrivacy } = usePrivacy();
  const [currentDateTime, setCurrentDateTime] = useState('24 Mai 2024 | 14:30');
  const [showNotifications, setShowNotifications] = useState(false);
  const proposalAlerts = useMemo(() => {
    const parse = (value?: string) => {
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return pedidos.map((pedido) => {
      if (['aceito', 'concluido', 'recusado', 'expirado'].includes(pedido.status)) return null;
      const issued = parse(pedido.createdAt) || parse(pedido.dataEmissao);
      const validity = Number(pedido.proposal?.validadePropostaDias || 0);
      if (!issued || !validity) return null;
      issued.setHours(0, 0, 0, 0); issued.setDate(issued.getDate() + validity);
      const days = Math.ceil((issued.getTime() - today.getTime()) / 86400000);
      return days <= 7 ? { pedido, days } : null;
    }).filter((item): item is { pedido: Pedido; days: number } => !!item).sort((a, b) => a.days - b.days);
  }, [pedidos]);

  // Indicador de sincronização (fila offline do IndexedDB)
  const [online, setOnline] = useState(true);
  const [pend, setPend] = useState(0);
  const attentionCount = (!online ? 1 : 0) + pend + proposalAlerts.length;
  useEffect(() => {
    const refresh = () => pendingCount().then(setPend).catch(() => {});
    setOnline(isOnline());
    refresh();
    const on = () => { setOnline(true); refresh(); };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const id = setInterval(refresh, 15000);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const day = now.getDate().toString().padStart(2, '0');
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
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
    <header className={`fireowl-header fixed top-0 left-0 right-0 h-14 bg-slate-50/70 backdrop-blur-md z-40 flex items-center justify-between px-3 md:px-5 transition-[left] duration-300 ease-out ${sidebarCollapsed ? 'lg:left-20' : 'lg:left-60'}`}>
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        {/* Menu hambúrguer — apenas mobile/tablet */}
        <button
          onClick={onOpenMenu}
          aria-label="Abrir menu"
          className="lg:hidden w-9 h-9 -ml-1 rounded-md flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
          <span className="material-symbols-outlined text-slate-500 text-[15px]">event</span>
          <span className="font-data-mono text-slate-700 uppercase text-[11px] font-semibold whitespace-nowrap">
            {currentDateTime}
          </span>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Unidade Londrina/PR — Operacional</span>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* O status de sincronização (fila offline) continua sendo monitorado e
            é exibido de forma contextual dentro do sino de notificações — o
            motor de sync/offline-first permanece intacto, apenas o badge fixo
            "SYNC/nuvem" foi removido do cabeçalho. */}

        {/* Notifications Icon with Popup */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-600 flex items-center justify-center"
            title="Notificações do Sistema"
          >
            <span className="material-symbols-outlined">notifications</span>
            {attentionCount > 0 && <div className="absolute top-1 right-1 min-w-2.5 h-2.5 px-0.5 bg-[#E63946] rounded-full ring-2 ring-white text-[8px] leading-[10px] text-white font-bold">{attentionCount > 9 ? '9+' : attentionCount}</div>}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-4 text-xs">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-3">
                <span className="font-bold text-slate-800 uppercase text-xs">Avisos do sistema</span>
                <span className={`font-data-mono text-[10px] px-2 py-0.5 rounded-full font-bold ${attentionCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{attentionCount > 0 ? 'Atenção' : 'Em dia'}</span>
              </div>
              <div className="space-y-2.5">
                {!online ? (
                  <div className="p-2.5 bg-slate-100 border-l-4 border-slate-500 rounded-r-md">
                    <p className="font-bold text-slate-800 uppercase text-[11px]">Sem conexão</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">Os dados continuam salvos neste aparelho e serão enviados quando a conexão voltar.</p>
                  </div>
                ) : pend > 0 ? (
                  <div className="p-2.5 bg-amber-50 border-l-4 border-amber-500 rounded-r-md">
                    <p className="font-bold text-amber-900 uppercase text-[11px]">Envio pendente</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">{pend} relatório(s) aguardando sincronização com o servidor.</p>
                  </div>
                ) : (
                  <div className="p-2.5 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-md">
                    <p className="font-bold text-emerald-900 uppercase text-[11px]">Tudo sincronizado</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">Não há relatórios aguardando envio neste aparelho.</p>
                  </div>
                )}
                {proposalAlerts.slice(0, 3).map(({ pedido, days }) => (
                  <div key={pedido.id} className={`p-2.5 rounded-r-md border-l-4 ${days < 0 ? 'bg-red-50 border-red-500' : 'bg-amber-50 border-amber-500'}`}>
                    <p className={`font-bold uppercase text-[11px] ${days < 0 ? 'text-red-800' : 'text-amber-900'}`}>{days < 0 ? 'Proposta vencida' : days === 0 ? 'Proposta vence hoje' : 'Vencimento próximo'}</p>
                    <p className="text-[11px] text-slate-600 mt-0.5 truncate">{pedido.numeroPedido} · {pedido.clienteNome}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{days < 0 ? `Vencida há ${Math.abs(days)} dia(s)` : `Vence em ${days} dia(s)`}</p>
                  </div>
                ))}
              </div>
              {proposalAlerts.length > 0 && onOpenPedidos && <button onClick={() => { setShowNotifications(false); onOpenPedidos(); }} className="w-full mt-3 py-1.5 bg-[#1A1A72] hover:bg-[#0B1E38] text-white font-semibold rounded text-center text-[11px]">Ver propostas com alerta</button>}
              <button
                onClick={() => setShowNotifications(false)}
                className="w-full mt-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-center text-[11px]"
              >
                Fechar
              </button>
            </div>
          )}
        </div>

        {/* Modo Privacidade — oculta valores financeiros */}
        <button
          onClick={togglePrivacy}
          aria-pressed={isPrivacyModeActive}
          title={isPrivacyModeActive ? 'Modo Privacidade ativo — mostrar valores' : 'Ocultar valores financeiros'}
          className={`relative p-1.5 rounded-full transition-colors flex items-center justify-center ${
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
        <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
          <div className="text-right hidden sm:block">
            <p className="font-bold text-slate-800 text-xs truncate max-w-36">{userName}</p>
            <p className="font-label-caps text-slate-500 text-[10px]">{userRole}</p>
          </div>
          {canSwitchRole ? (
            <button
              onClick={onOpenAuthModal}
              className="w-8 h-8 rounded-full bg-[#1A1A72] flex items-center justify-center text-white hover:ring-2 hover:ring-[#E63946] transition-all shadow-sm"
              title="Simular perfil de acesso"
            >
              <span className="material-symbols-outlined text-[20px]">person</span>
            </button>
          ) : (
            <div
              className="w-8 h-8 rounded-full bg-[#1A1A72] flex items-center justify-center text-white shadow-sm"
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
