'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Client, TabPath, UserRole } from '@/lib/types';
import { greeting, MODULE_META, quickMenuTabs } from '@/lib/modules';
import { allowedTabs } from '@/lib/rbac';
import { flushOutbox, isOnline, pendingCount } from '@/lib/offline/reportSync';
import { pendingFieldPhotoJobs } from '@/lib/offline/fieldPhotoSync';
import { QuickFieldPhotoModal } from '@/components/field-photos/QuickFieldPhotoModal';

const ROLE_LABEL: Record<UserRole, string> = {
  ADMINISTRATIVO: 'Administrativo', GESTOR: 'Gestor', FINANCEIRO: 'Financeiro', TECNICO: 'Técnico',
};
// Tom de destaque só para o ícone — cards permanecem sóbrios (B2B, §40).
const ICON_TONE: Partial<Record<TabPath, string>> = {
  relatorios: 'text-danger', 'fotos-de-campo': 'text-primary', agenda: 'text-indigo-500',
  ponto: 'text-emerald-500', pedidos: 'text-primary', painel: 'text-fg-secondary',
};

interface Props {
  userName: string;
  cargo?: string;
  userRole: UserRole;
  userId?: string;
  clients: Client[];
  onSelectTab: (t: TabPath) => void;
}

export const MobileQuickMenu: React.FC<Props> = ({ userName, cargo, userRole, userId, clients, onSelectTab }) => {
  const [pend, setPend] = useState(0);
  const [online, setOnline] = useState(true);
  const [quickPhotoOpen, setQuickPhotoOpen] = useState(false);
  const tabs = quickMenuTabs(userRole);
  const canQuickPhoto = allowedTabs(userRole).includes('fotos-de-campo');

  const refresh = useCallback(() => {
    void Promise.all([pendingCount(), pendingFieldPhotoJobs()]).then(([r, p]) => setPend(r + p)).catch(() => {});
  }, []);

  useEffect(() => {
    setOnline(isOnline());
    refresh();
    const on = () => { setOnline(true); void flushOutbox().finally(refresh); };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [refresh]);

  const perfil = cargo || ROLE_LABEL[userRole];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 p-4">
      {/* Saudação + status de sincronização (dados reais, §29) */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-fg">{greeting()}, {userName?.split(' ')[0] || 'operador'} 👋</p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">{perfil}</p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
            online ? (pend > 0 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700') : 'border-border bg-surface-3 text-fg-secondary'
          }`}
          title={online ? (pend > 0 ? `${pend} registro(s) aguardando envio` : 'Tudo sincronizado') : 'Sem conexão — dados salvos no aparelho'}
        >
          <span className="material-symbols-outlined text-sm">{online ? (pend > 0 ? 'cloud_upload' : 'cloud_done') : 'cloud_off'}</span>
          {online ? (pend > 0 ? `${pend} p/ enviar` : 'Sincronizado') : 'Offline'}
        </span>
      </div>

      {/* Ação operacional (só quando o módulo é permitido, sem inventar ação §28) */}
      {canQuickPhoto && (
        <button
          onClick={() => setQuickPhotoOpen(true)}
          className="flex min-h-[64px] items-center gap-3 rounded-2xl bg-navy px-4 text-left text-white shadow-card active:scale-[0.99]"
        >
          <span className="material-symbols-outlined text-3xl">photo_camera</span>
          <div>
            <p className="text-sm font-bold uppercase tracking-wide">Registro Rápido</p>
            <p className="text-[11px] text-white/70">Capturar foto de campo agora</p>
          </div>
        </button>
      )}

      {/* Acesso rápido — cards derivados exclusivamente do RBAC (§25/§26) */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-fg-secondary">Acesso rápido</p>
        <div className="grid grid-cols-2 gap-3">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => onSelectTab(t)}
              className="flex min-h-[92px] flex-col items-start justify-between rounded-2xl border border-border bg-surface p-3.5 text-left shadow-soft transition-colors hover:border-border-strong active:scale-[0.99]"
            >
              <span className={`material-symbols-outlined text-[26px] ${ICON_TONE[t] || 'text-fg-secondary'}`}>{MODULE_META[t].icon}</span>
              <span className="text-sm font-bold text-fg">{MODULE_META[t].label}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="text-center text-[11px] text-fg-muted">Use o menu para acessar todos os módulos.</p>

      {canQuickPhoto && (
        <QuickFieldPhotoModal
          isOpen={quickPhotoOpen}
          onClose={() => setQuickPhotoOpen(false)}
          clients={clients}
          technicianId={userId}
          technicianName={userName}
        />
      )}
    </div>
  );
};
