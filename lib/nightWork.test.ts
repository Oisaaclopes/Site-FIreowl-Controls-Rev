import { describe, it, expect } from 'vitest';
import {
  availableFilters, buildTimesheetRows, filterTimesheetRows, summarizeTimesheetRows, TimesheetOptions, toDocumentLines,
} from './timesheet';
import { computeNightWork, computeOvertime, DEFAULT_NIGHT_RULE, DEFAULT_WORK_TIME_RULES, WorkTimeRules } from './workRules';
import { resolveEffectivePunches } from './effectivePunches';
import type { PunchAdjustment } from './adjustments';
import { TimePunch } from './types';

/* ===================================================================
 * Saldo × hora extra × trabalho noturno — apuração de TEMPO (não financeira).
 * Regra central: lib/workRules (padrão urbano 22h–5h, hora de 52min30s, 20%;
 * política de hora extra AUSENTE → hora extra não apurável).
 * =================================================================== */

const H = 60 * 60 * 1000;
const MIN = 60 * 1000;
const ms = (d: number, h: number, mi = 0) => new Date(2026, 8, d, h, mi, 0).getTime();
let seq = 0;
const punch = (type: TimePunch['type'], at: number): TimePunch => ({
  id: `n${seq++}`, userId: 'u1', employeeName: 'Joao', timestamp: '', type,
  locationStr: '', lat: 0, lng: 0, status: 'APROVADO', at,
});
const opts = (over: Partial<TimesheetOptions> = {}): TimesheetOptions => ({
  monthKey: '2026-09', nowMs: ms(30, 12), expectedMsForDate: () => 0, ...over,
});
const journeyRow = (punches: TimePunch[], over: Partial<TimesheetOptions> = {}) =>
  buildTimesheetRows(punches, opts(over)).filter((r) => r.journey)[0];

describe('regra central de trabalho noturno', () => {
  it('padrão: 22:00–05:00, hora reduzida de 52min30s, 20%', () => {
    expect(DEFAULT_NIGHT_RULE.startMinutes).toBe(22 * 60);
    expect(DEFAULT_NIGHT_RULE.endMinutes).toBe(5 * 60);
    expect(DEFAULT_NIGHT_RULE.reducedHourMs).toBe(52 * MIN + 30 * 1000);
    expect(DEFAULT_NIGHT_RULE.additionalPercent).toBe(20);
    expect(DEFAULT_WORK_TIME_RULES.overtime).toBeNull();
  });
});

describe('1–4) interseção com a janela noturna', () => {
  it('1) 08:00–18:00: zero trabalho noturno', () => {
    const r = journeyRow([punch('ENTRADA', ms(10, 8)), punch('SAIDA', ms(10, 18))]);
    expect(r.nightWorkedMs).toBe(0);
    expect(r.nightComputedMs).toBe(0);
  });

  it('2) 21:00–23:00: 1h00 real noturna', () => {
    const r = journeyRow([punch('ENTRADA', ms(10, 21)), punch('SAIDA', ms(10, 23))]);
    expect(r.nightWorkedMs).toBe(1 * H);
  });

  it('3) 22:00–05:00: 7h00 reais e 8h00 computadas (hora reduzida)', () => {
    const r = journeyRow([punch('ENTRADA', ms(10, 22)), punch('SAIDA', ms(11, 5))]);
    expect(r.nightWorkedMs).toBe(7 * H);
    expect(r.nightComputedMs).toBe(8 * H);
  });

  it('4) 23:00–04:00: 5h00 reais noturnas', () => {
    const r = journeyRow([punch('ENTRADA', ms(10, 23)), punch('SAIDA', ms(11, 4))]);
    expect(r.nightWorkedMs).toBe(5 * H);
  });

  it('madrugada iniciada antes das 05:00 (03:00–08:00) conta só até 05:00', () => {
    expect(computeNightWork([{ start: ms(10, 3), end: ms(10, 8) }]).realMs).toBe(2 * H);
  });
});

describe('5) jornada atravessando a meia-noite', () => {
  it('24/09 21:00 → 25/09 05:00 pertence a 24/09 e apura 7h noturnas', () => {
    const r = journeyRow([punch('ENTRADA', ms(24, 21)), punch('SAIDA', ms(25, 5))]);
    expect(r.competenceKey).toBe('2026-09-24');
    expect(r.crossesMidnight).toBe(true);
    expect(r.workedMs).toBe(8 * H);
    expect(r.nightWorkedMs).toBe(7 * H);
  });
});

describe('6–7) pausa não é trabalho noturno', () => {
  it('6) pausa inteira dentro da janela (00:00–01:00) é descontada', () => {
    const r = journeyRow([
      punch('ENTRADA', ms(10, 22)), punch('PAUSA', ms(11, 0)), punch('RETORNO', ms(11, 1)), punch('SAIDA', ms(11, 5)),
    ]);
    expect(r.workedMs).toBe(6 * H);
    expect(r.nightWorkedMs).toBe(6 * H);
    expect(r.nightComputedMs).toBe(Math.round(6 * H * 60 / 52.5));
  });

  it('7) pausa parcialmente dentro (21:30–22:30) desconta só a interseção (30min)', () => {
    const r = journeyRow([
      punch('ENTRADA', ms(10, 18)), punch('PAUSA', ms(10, 21, 30)), punch('RETORNO', ms(10, 22, 30)), punch('SAIDA', ms(11, 2)),
    ]);
    // Janela 22:00–02:00 = 4h; a pausa ocupa 22:00–22:30 → 3h30 reais noturnas.
    expect(r.nightWorkedMs).toBe(3 * H + 30 * MIN);
  });
});

describe('8) jornada sem período noturno continua exatamente como hoje', () => {
  it('08:00–12:00 / 13:00–17:00 com previsto 8h: Normal, saldo 0, sem badge', () => {
    const r = journeyRow(
      [punch('ENTRADA', ms(10, 8)), punch('PAUSA', ms(10, 12)), punch('RETORNO', ms(10, 13)), punch('SAIDA', ms(10, 17))],
      { expectedMsForDate: () => 8 * H },
    );
    expect(r.situation).toBe('NORMAL');
    expect(r.workedMs).toBe(8 * H);
    expect(r.balanceMs).toBe(0);
    expect(r.badges).toEqual([]);
  });
});

describe('9) jornada ajustada usa as batidas efetivas', () => {
  it('saída corrigida de 02:43 para 05:00 recalcula o noturno', () => {
    const raw = [punch('ENTRADA', ms(10, 22)), punch('SAIDA', ms(11, 2, 43))];
    const adj: PunchAdjustment = {
      id: 'a1', userId: 'u1', employeeName: 'Joao', refDate: '2026-09-11', type: 'SAIDA', requestedTime: '05:00',
      reason: 'correção', status: 'APROVADO', action: 'AJUSTE', origin: 'ADMINISTRATIVO', originalPunchId: raw[1].id,
    };
    const r = journeyRow(resolveEffectivePunches(raw, [adj]));
    expect(r.nightWorkedMs).toBe(7 * H);
    expect(r.badges).toEqual(expect.arrayContaining(['ADICIONAL_NOTURNO', 'AJUSTADA']));
  });
});

describe('10) PDF/Excel recebem os mesmos totais da Folha', () => {
  it('linhas de documento carregam noturno/hora extra; somas = resumo da tela', () => {
    const rows = buildTimesheetRows([
      punch('ENTRADA', ms(10, 22)), punch('SAIDA', ms(11, 5)),
      punch('ENTRADA', ms(12, 21)), punch('SAIDA', ms(12, 23)),
      punch('ENTRADA', ms(14, 8)), punch('SAIDA', ms(14, 17)),
    ], opts({ expectedMsForDate: () => 8 * H }));
    const lines = toDocumentLines(rows);
    const screen = summarizeTimesheetRows(rows);
    expect(lines.reduce((s, l) => s + (l.nightWorkedMs ?? 0), 0)).toBe(screen.nightWorkedMs);
    expect(lines.reduce((s, l) => s + (l.nightComputedMs ?? 0), 0)).toBe(screen.nightComputedMs);
    expect(screen.nightWorkedMs).toBe(8 * H);
    expect(screen.overtimeMs).toBeNull();
    expect(lines.find((l) => l.dateKey === '2026-09-10')!.label).toContain('Trabalho noturno 7h00');
  });
});

describe('11) saldo positivo NÃO vira hora extra sem política', () => {
  const extra = [punch('ENTRADA', ms(10, 8)), punch('SAIDA', ms(10, 18))]; // 10h com previsto 8h
  const o = { expectedMsForDate: () => 8 * H };

  it('sem política: saldo +2h, situação "Acima do previsto", hora extra não apurável', () => {
    const r = journeyRow(extra, o);
    expect(r.balanceMs).toBe(2 * H);
    expect(r.situation).toBe('ACIMA_PREVISTO');
    expect(r.overtimeMs).toBeNull();
    expect(r.badges).not.toContain('HORA_EXTRA');
    expect(filterTimesheetRows([r], 'HORA_EXTRA')).toHaveLength(0);
    expect(availableFilters()).not.toContain('HORA_EXTRA');
    expect(availableFilters()).toContain('NOTURNO');
  });

  it('com política (futura) que destina o excedente a hora extra: classifica após a tolerância', () => {
    const rules: WorkTimeRules = {
      ...DEFAULT_WORK_TIME_RULES,
      overtime: { excessGoesTo: 'HORA_EXTRA', dailyToleranceMinutes: 10, source: 'EMPRESA', label: 'teste' },
    };
    const r = journeyRow(extra, { ...o, rules });
    expect(r.overtimeMs).toBe(2 * H - 10 * MIN);
    expect(r.badges).toContain('HORA_EXTRA');
    expect(availableFilters(rules)).toContain('HORA_EXTRA');
  });

  it('política que destina o excedente ao banco de horas: hora extra = 0', () => {
    expect(computeOvertime(2 * H, { excessGoesTo: 'BANCO_DE_HORAS', dailyToleranceMinutes: 0, source: 'EMPRESA', label: 'x' })).toBe(0);
  });

  it('hora extra e noturno coexistem na mesma jornada (badges não exclusivos)', () => {
    const rules: WorkTimeRules = {
      ...DEFAULT_WORK_TIME_RULES,
      overtime: { excessGoesTo: 'HORA_EXTRA', dailyToleranceMinutes: 0, source: 'EMPRESA', label: 'teste' },
    };
    const r = journeyRow([punch('ENTRADA', ms(10, 18)), punch('SAIDA', ms(11, 4))], { ...o, rules });
    expect(r.badges).toEqual(expect.arrayContaining(['ADICIONAL_NOTURNO', 'HORA_EXTRA']));
  });
});

describe('12) jornada diurna não recebe badge de adicional noturno', () => {
  it('08:00–17:00 → sem ADICIONAL_NOTURNO e fora do filtro noturno', () => {
    const r = journeyRow([punch('ENTRADA', ms(10, 8)), punch('SAIDA', ms(10, 17))]);
    expect(r.badges).not.toContain('ADICIONAL_NOTURNO');
    expect(filterTimesheetRows([r], 'NOTURNO')).toHaveLength(0);
  });

  it('jornada incompleta não apura noturno (null), nem conta no filtro', () => {
    const r = journeyRow([punch('ENTRADA', ms(10, 22)), punch('PAUSA', ms(11, 1)), punch('SAIDA', ms(11, 5))]);
    expect(r.situation).toBe('INCOMPLETA');
    expect(r.nightWorkedMs).toBeNull();
    expect(filterTimesheetRows([r], 'NOTURNO')).toHaveLength(0);
  });
});
