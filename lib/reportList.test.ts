import { describe, expect, it } from 'vitest';
import { canHardDeleteReport, filterReports, isLatestReportRefresh } from './reportList';
import { ReportInstance } from './types';

const reports: ReportInstance[] = [
  { id: '1', numero: 'LEV-2026-10001', templateCodigo: 'L', tipo: 'LEVANTAMENTO', status: 'finalizado', clienteId: 'c1', local: 'Londrina', finalizadoEm: '2026-09-02' },
  { id: '2', numero: 'COR-2026-10002', templateCodigo: 'C', tipo: 'CORRETIVA', status: 'rascunho', clienteId: 'c2', local: 'Maringá', iniciadoEm: '2026-09-01' },
];
const clients: Record<string, string> = { c1: 'Super Muffato', c2: 'Acme' };
const name = (id?: string) => id ? clients[id] : '';

describe('lista canônica de relatórios', () => {
  it('filtra tipo e status de forma independente', () => {
    expect(filterReports(reports, { tipo: 'LEVANTAMENTO', status: 'TODOS', search: '' }, name).map((r) => r.id)).toEqual(['1']);
    expect(filterReports(reports, { tipo: 'TODOS', status: 'rascunho', search: '' }, name).map((r) => r.id)).toEqual(['2']);
  });
  it('busca por número, cliente e local', () => {
    expect(filterReports(reports, { tipo: 'TODOS', status: 'TODOS', search: '10002' }, name)[0].id).toBe('2');
    expect(filterReports(reports, { tipo: 'TODOS', status: 'TODOS', search: 'muffato' }, name)[0].id).toBe('1');
    expect(filterReports(reports, { tipo: 'TODOS', status: 'TODOS', search: 'maringá' }, name)[0].id).toBe('2');
  });
  it('não cria registros quando a fonte está vazia', () => {
    expect(filterReports([], { tipo: 'TODOS', status: 'TODOS', search: '' }, name)).toEqual([]);
  });
  it('mantém hard delete fora do perfil técnico', () => {
    expect(canHardDeleteReport('TECNICO')).toBe(false);
    expect(canHardDeleteReport('GESTOR')).toBe(true);
  });
  it('rejeita refresh antigo e aceita o mais recente', () => {
    expect(isLatestReportRefresh(2, 1)).toBe(false);
    expect(isLatestReportRefresh(2, 2)).toBe(true);
  });
});
