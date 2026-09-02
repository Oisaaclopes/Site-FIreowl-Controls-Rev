import { ReportInstance, UserRole } from './types';

export interface ReportFilters { tipo: string; status: string; search: string }

export function filterReports(
  reports: ReportInstance[],
  filters: ReportFilters,
  clientName: (id?: string) => string,
): ReportInstance[] {
  const search = filters.search.trim().toLocaleLowerCase('pt-BR');
  return reports.filter((report) => {
    if (filters.tipo !== 'TODOS' && report.tipo !== filters.tipo) return false;
    if (filters.status !== 'TODOS' && report.status !== filters.status) return false;
    if (!search) return true;
    return [report.id, report.numero, clientName(report.clienteId), report.local]
      .some((value) => (value || '').toLocaleLowerCase('pt-BR').includes(search));
  }).sort((a, b) => {
    const aDate = new Date(a.finalizadoEm || a.iniciadoEm || 0).getTime();
    const bDate = new Date(b.finalizadoEm || b.iniciadoEm || 0).getTime();
    return bDate - aDate;
  });
}

export const canHardDeleteReport = (role: UserRole): boolean => role === 'ADMINISTRATIVO' || role === 'GESTOR';

/** Somente a geração corrente pode publicar o resultado de um refresh. */
export const isLatestReportRefresh = (currentGeneration: number, responseGeneration: number): boolean =>
  currentGeneration === responseGeneration;
