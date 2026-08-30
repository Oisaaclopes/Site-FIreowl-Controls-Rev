import { describe, it, expect } from 'vitest';
import { consolidateDay, buildDailyTimeRecords, computePeriodSummary, dayStatusLabel } from './timecard';
import { TimePunch } from './types';

// Helpers para montar batidas de teste no dia 2026-08-05.
const at = (h: number, m: number) => new Date(2026, 7, 5, h, m, 0).getTime();
const punch = (type: TimePunch['type'], atMs: number): TimePunch => ({
  id: `${type}_${atMs}`,
  employeeName: 'Fulano',
  timestamp: '',
  type,
  locationStr: '',
  lat: 0,
  lng: 0,
  status: 'APROVADO',
  at: atMs,
});

describe('consolidateDay', () => {
  it('jornada completa e cronológica calcula horas (manhã + tarde)', () => {
    const day = [
      punch('ENTRADA', at(9, 0)),
      punch('PAUSA', at(12, 0)),
      punch('RETORNO', at(13, 0)),
      punch('SAIDA', at(18, 0)),
    ];
    const c = consolidateDay(day);
    expect(c.status).toBe('OK');
    // 3h de manhã + 5h de tarde = 8h
    expect(c.workedMs).toBe(8 * 60 * 60000);
  });

  it('jornada sem almoço (só entrada e saída) calcula corrido', () => {
    const c = consolidateDay([punch('ENTRADA', at(9, 0)), punch('SAIDA', at(15, 0))]);
    expect(c.status).toBe('OK');
    expect(c.workedMs).toBe(6 * 60 * 60000);
  });

  // Caso real 05/08/2026: Entrada 16:06, Saída Almoço 16:28, Retorno 18:38,
  // Saída 17:00 — Retorno (18:38) vem DEPOIS da Saída (17:00): impossível.
  it('sequência fora de ordem é INCONSISTENTE, não 00h00', () => {
    const day = [
      punch('ENTRADA', at(16, 6)),
      punch('PAUSA', at(16, 28)),
      punch('RETORNO', at(18, 38)),
      punch('SAIDA', at(17, 0)),
    ];
    const c = consolidateDay(day);
    expect(c.status).toBe('INCONSISTENTE');
    expect(c.workedMs).toBeNull();
    expect(dayStatusLabel(c.status)).toBe('Jornada inconsistente');
  });

  it('só entrada em dia passado é INCOMPLETA (horas não calculáveis)', () => {
    const c = consolidateDay([punch('ENTRADA', at(9, 0))]);
    expect(c.status).toBe('INCOMPLETA');
    expect(c.workedMs).toBeNull();
  });

  it('só entrada no dia de hoje é EM_ANDAMENTO', () => {
    const c = consolidateDay([punch('ENTRADA', at(9, 0))], at(11, 0));
    expect(c.status).toBe('EM_ANDAMENTO');
    expect(c.workedMs).toBeNull();
  });

  it('par de almoço quebrado (pausa sem retorno) é INCOMPLETA', () => {
    const c = consolidateDay([
      punch('ENTRADA', at(9, 0)),
      punch('PAUSA', at(12, 0)),
      punch('SAIDA', at(18, 0)),
    ]);
    expect(c.status).toBe('INCOMPLETA');
    expect(c.workedMs).toBeNull();
  });
});

describe('buildDailyTimeRecords + computePeriodSummary', () => {
  it('não soma horas de dias inconsistentes/incompletos', () => {
    const punches = [
      // dia OK: 8h
      punch('ENTRADA', at(9, 0)),
      punch('PAUSA', at(12, 0)),
      punch('RETORNO', at(13, 0)),
      punch('SAIDA', at(18, 0)),
    ];
    const records = buildDailyTimeRecords(punches);
    expect(records).toHaveLength(1);
    const expected = () => 8 * 60 * 60000; // previsto = 8h
    const s = computePeriodSummary(records, expected);
    expect(s.trabalhadoMs).toBe(8 * 60 * 60000);
    expect(s.saldoMs).toBe(0);
  });
});
