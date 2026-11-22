import { describe, expect, it } from 'vitest';
import { previewCorrection } from './punchCorrectionPreview';
import { buildTimesheetRows } from './timesheet';
import { TimePunch } from './types';

const at = (hm: string, day = '2026-11-13') => new Date(`${day}T${hm}:00`).getTime();
const p = (id: string, type: TimePunch['type'], hm: string): TimePunch => ({
  id, userId: 'u1', employeeName: 'Func', timestamp: '', type, locationStr: '', lat: 0, lng: 0, status: 'APROVADO', at: at(hm),
});

// Batidas REAIS do caso relatado (13/11): almoço e retorno com 15s de diferença,
// depois uma nova Entrada às 13:12 e uma "saída para almoço" às 16:53.
const dia13 = [
  p('e1', 'ENTRADA', '08:18'), p('p1', 'PAUSA', '12:11'), p('r1', 'RETORNO', '12:12'),
  p('e2', 'ENTRADA', '13:12'), p('p2', 'PAUSA', '16:53'),
];
const NOW = at('10:00', '2026-11-22');
const rows = () => buildTimesheetRows(dia13, { monthKey: '2026-11', nowMs: NOW, expectedMsForDate: () => 8 * 3600e3 });

describe('previewCorrection — caso 13/11', () => {
  it('já havia 2 jornadas (2 linhas) antes da correção', () => {
    expect(rows().filter((r) => r.competenceKey === '2026-11-13')).toHaveLength(2);
  });

  it('Saída 17:02 na 1ª linha cai fora dela (depois da Entrada 13:12) e é bloqueada', () => {
    const first = rows()[0];
    const pv = previewCorrection(dia13, first.journey, '2026-11-13', { action: 'INCLUSAO', type: 'SAIDA', refDate: '2026-11-13', time: '17:02' }, NOW)!;
    expect(pv.landsOutside).toBe(true);
    expect(pv.warning).toMatch(/Entrada das 13:12/);
  });

  it('Saída extra quando a jornada já tem saída cria linha nova e é bloqueada', () => {
    const withExit = [...dia13, p('s2', 'SAIDA', '18:02')];
    const second = buildTimesheetRows(withExit, { monthKey: '2026-11', nowMs: NOW, expectedMsForDate: () => 0 })[1];
    const pv = previewCorrection(withExit, second.journey, '2026-11-13', { action: 'INCLUSAO', type: 'SAIDA', refDate: '2026-11-13', time: '17:02' }, NOW)!;
    expect(pv.createsRows || pv.landsOutside).toBe(true);
    expect(pv.warning).toBeTruthy();
  });

  it('Saída dentro da jornada (antes de 13:12) é aceita, sem aviso', () => {
    const first = rows()[0];
    const pv = previewCorrection(dia13, first.journey, '2026-11-13', { action: 'INCLUSAO', type: 'SAIDA', refDate: '2026-11-13', time: '13:00' }, NOW)!;
    expect(pv.warning).toBeUndefined();
    expect(pv.journey?.status).toBe('OK');
  });

  it('corrigir o horário da batida existente na própria jornada não gera aviso', () => {
    const second = rows()[1];
    const pv = previewCorrection(dia13, second.journey, '2026-11-13', { action: 'AJUSTE', type: 'PAUSA', punch: dia13[4], refDate: '2026-11-13', time: '16:00' }, NOW)!;
    expect(pv.warning).toBeUndefined();
  });

  it('dia sem registro: inclusão de Entrada não é bloqueada', () => {
    const pv = previewCorrection(dia13, undefined, '2026-11-14', { action: 'INCLUSAO', type: 'ENTRADA', refDate: '2026-11-14', time: '08:00' }, NOW)!;
    expect(pv.warning).toBeUndefined();
  });
});
