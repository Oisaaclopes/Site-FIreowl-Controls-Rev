'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { flushOutbox, isOnline, pendingCount } from '@/lib/offline/reportSync';
import { pendingFieldPhotoJobs } from '@/lib/offline/fieldPhotoSync';
import { deriveSyncBadge } from '@/lib/syncStatus';

/**
 * Hook único do estado de sincronização (fila offline de relatórios + fotos).
 *
 * Consolida o monitoramento que antes estava duplicado no TechDashboard e no
 * MobileQuickMenu. A infraestrutura offline/outbox permanece intacta — este
 * hook só observa e expõe {online, pending, syncing} para apresentação.
 */
export function useSyncStatus() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(() => {
    void Promise.all([pendingCount(), pendingFieldPhotoJobs()])
      .then(([reports, photos]) => setPending(reports + photos))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setOnline(isOnline());
    refresh();
    const on = () => {
      setOnline(true);
      setSyncing(true);
      void flushOutbox().finally(() => {
        setSyncing(false);
        refresh();
      });
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [refresh]);

  return { online, pending, syncing, refresh };
}

/**
 * SyncIndicator — pílula de status que só aparece em EXCEÇÕES.
 *
 * Quando tudo está normal (online, sem pendências, sem sync em curso) o
 * componente NÃO renderiza nada (deriveSyncBadge → null). Assim o topo das
 * telas fica limpo e o usuário só é avisado quando há algo relevante.
 */
export const SyncIndicator: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { online, pending, syncing } = useSyncStatus();
  const badge = deriveSyncBadge({ online, pending, syncing });
  if (!badge) return null;

  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${badge.tone} ${className}`}
      title={badge.title}
    >
      <span className={`material-symbols-outlined text-sm ${badge.kind === 'SYNCING' ? 'animate-spin' : ''}`}>{badge.icon}</span>
      {badge.label}
    </span>
  );
};
