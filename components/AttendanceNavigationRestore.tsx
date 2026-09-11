'use client';
import React, { useEffect, useState } from 'react';
import { AttendanceScreen } from '@/components/operacoes/ServiceAttendanceFlow';
import { restoreAttendanceNavigation } from '@/lib/attendanceNavigation';
import { Client, ServiceAttendance } from '@/lib/types';
import { useNavigation } from './NavigationSession';
import { showToast } from './ui/Feedback';

/** Only reload/back opens this host. Normal opening keeps the original caller. */
export function AttendanceNavigationRestore({ userId, userName, clients }: { userId?: string; userName: string; clients: Client[] }) {
  const { update } = useNavigation();
  const [attendance, setAttendance] = useState<ServiceAttendance | null>(null);
  useEffect(() => {
    let generation = 0;
    const restore = async () => {
      const current = ++generation;
      const id = new URLSearchParams(window.location.search).get('atendimento');
      if (!id || !userId) { setAttendance(null); return; }
      if (document.querySelector('[data-attendance-id]')?.getAttribute('data-attendance-id') === id) return;
      setAttendance(null);
      const found = await restoreAttendanceNavigation(id, userId).catch(() => null);
      if (current !== generation) return;
      if (found) setAttendance(found);
      else { update({ atendimento: null, atendimentoEtapa: null }); showToast('Atendimento encerrado ou indisponível.'); }
    };
    void restore();
    window.addEventListener('popstate', restore);
    return () => { generation++; window.removeEventListener('popstate', restore); };
  }, [userId, update]);
  return attendance ? <AttendanceScreen attendance={attendance} clients={clients} technicianId={userId} technicianName={userName} onClose={() => { setAttendance(null); update({ atendimento: null, atendimentoEtapa: null }); }} /> : null;
}
