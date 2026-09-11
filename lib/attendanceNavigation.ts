import { fetchServiceAttendances } from './serviceAttendances';

/** A read is sufficient to reopen an existing execution; never call start/resume here. */
export async function restoreAttendanceNavigation(id: string, userId: string) {
  if (!id || !userId) return null;
  const rows = await fetchServiceAttendances({ technicianId: userId });
  return rows.find((row) => row.id === id && row.technicianId === userId && ['EM_EXECUCAO', 'PAUSADO'].includes(row.status)) || null;
}
