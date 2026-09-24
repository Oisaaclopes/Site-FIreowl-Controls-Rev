import { describe, it, expect } from 'vitest';
import {
  buildTimesheetRows, filterTimesheetRows, resolveTrackingStartKey, summarizeEmployeeMonth, summarizeTimesheetRows,
  TimesheetOptions, toDocumentLines,
} from './timesheet';
import { resolveEffectivePunches } from './effectivePunches';
import type { PunchAdjustment } from './adjustments';
import { TimePunch } from './types';

/* Folha consolidada: uma linha por JORNADA, sobre o motor canônico. */

const EMP = 'Joao';
const H = 60 * 60 * 1000;
const MIN = 60 * 1000;
const ms = (d: number, h: number, mi = 0, mo = 9) => new Date(2026, mo - 1, d, h, mi, 0).getTime();
let seq = 0;
const punch = (type: TimePunch['type'], at: number, id?: string): TimePunch => ({
  id: id ?? `p${seq++}`, userId: 'u1', employeeName: EMP, timestamp: '', type,
  locationStr: '', lat: 0, lng: 0, status: 'APROVADO', at,
});
const day = (d: number, e: [number, number], p: [number, number], r: [number, number], s: [number, number]) => [
  punch('ENTRADA', ms(d, ...e)), punch('PAUSA', ms(d, ...p)), punch('RETORNO', ms(d, ...r)), punch('SAIDA', ms(d, ...s)),
];
const opts = (over: Partial<TimesheetOptions> = {}): TimesheetOptions => ({
  monthKey: '2026-09',
  nowMs: ms(30, 23),
  expectedMsForDate: () => 8 * H,
  ...over,
});
/** Só as linhas de JORNADA (a grade de dias sem registro é testada à parte). */
const journeyRows = (punches: TimePunch[], o: TimesheetOptions) => buildTimesheetRows(punches, o).filter((r) => r.journey);

describe('linhas da folha', () => {
  it('23/09 08:02–12:01 / 13:03–16:59 → 7h55, previsto 8h, saldo -0h05, Carga inferior', () => {
    const [row] = journeyRows(day(23, [8, 2], [12, 1], [13, 3], [16, 59]), opts());
    expect(row.competenceKey).toBe('2026-09-23');
    expect(row.workedMs).toBe(7 * H + 55 * MIN);
    expect(row.expectedMs).toBe(8 * H);
    expect(row.balanceMs).toBe(-5 * MIN);
    expect(row.situation).toBe('CARGA_INFERIOR');
    expect(row.slots.RETORNO?.at).toBe(ms(23, 13, 3));
  });

  it('exatamente o previsto → Normal; acima → Hora extra (sem tolerância inventada)', () => {
    expect(journeyRows(day(22, [8, 0], [12, 0], [13, 0], [17, 0]), opts())[0].situation).toBe('NORMAL');
    expect(journeyRows(day(22, [8, 0], [12, 0], [13, 0], [17, 1]), opts())[0].situation).toBe('HORA_EXTRA');
  });

  it('noturna 20:00→23:30 | 00:30→04:00 fica na competência da entrada, 7h00', () => {
    const rows = journeyRows([
      punch('ENTRADA', ms(23, 20)), punch('PAUSA', ms(23, 23, 30)),
      punch('RETORNO', ms(24, 0, 30)), punch('SAIDA', ms(24, 4)),
    ], opts({ expectedMsForDate: () => 7 * H }));
    expect(rows).toHaveLength(1);
    expect(rows[0].competenceKey).toBe('2026-09-23');
    expect(rows[0].workedMs).toBe(7 * H);
    expect(rows[0].crossesMidnight).toBe(true);
    expect(rows[0].situation).toBe('NORMAL');
  });

  it('retorno faltando → Jornada incompleta, sem horas', () => {
    const [row] = journeyRows([
      punch('ENTRADA', ms(23, 8, 3)), punch('PAUSA', ms(23, 12, 1)), punch('SAIDA', ms(23, 17, 14)),
    ], opts());
    expect(row.situation).toBe('INCOMPLETA');
    expect(row.workedMs).toBeNull();
    expect(row.slots.RETORNO).toBeUndefined();
  });

  it('entrada esquecida >18h → Jornada anômala (pendência)', () => {
    const [row] = journeyRows([punch('ENTRADA', ms(18, 21, 32))], opts({ nowMs: ms(24, 8) }));
    expect(row.situation).toBe('ANOMALA');
    expect(filterTimesheetRows([row], 'PENDENCIA')).toHaveLength(1);
  });

  it('duas jornadas no mesmo dia = duas linhas; previsto só na primeira; situação pelo total do dia', () => {
    const rows = journeyRows([
      punch('ENTRADA', ms(10, 8)), punch('SAIDA', ms(10, 12)),
      punch('ENTRADA', ms(10, 13)), punch('SAIDA', ms(10, 17)),
    ], opts());
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.expectedMs)).toEqual([8 * H, 0]);
    expect(rows.every((r) => r.situation === 'NORMAL')).toBe(true);
  });

  it('recorta por competência (jornada de agosto não entra em setembro)', () => {
    const rows = journeyRows([
      punch('ENTRADA', ms(31, 22, 0, 8)), punch('SAIDA', ms(1, 5)),
      ...day(2, [8, 0], [12, 0], [13, 0], [17, 0]),
    ], opts());
    expect(rows.map((r) => r.competenceKey)).toEqual(['2026-09-02']);
  });
});

describe('ajustes na folha', () => {
  const adj = (over: Partial<PunchAdjustment>): PunchAdjustment => ({
    id: 'a1', userId: 'u1', employeeName: EMP, refDate: '2026-09-23', type: 'SAIDA',
    requestedTime: '17:00', reason: 'correção', status: 'APROVADO', action: 'AJUSTE', origin: 'ADMINISTRATIVO',
    reviewerName: 'Gestora', createdAt: '2026-09-24T12:00:00Z', ...over,
  });

  it('correção administrativa → Ajustada, sem esconder a situação resultante', () => {
    const raw = day(23, [8, 0], [12, 0], [13, 0], [17, 40]);
    const saida = raw[3];
    const eff = resolveEffectivePunches(raw, [adj({ originalPunchId: saida.id })]);
    const [row] = journeyRows(eff, opts());
    expect(row.adjusted).toBe(true);
    expect(row.situation).toBe('NORMAL');       // 8h após a correção
    expect(row.slots.SAIDA?.originalAt).toBe(ms(23, 17, 40));
    expect(filterTimesheetRows([row], 'AJUSTADOS')).toHaveLength(1);
  });

  it('batida faltante incluída pelo gestor completa a jornada', () => {
    const raw = [punch('ENTRADA', ms(23, 8)), punch('PAUSA', ms(23, 12)), punch('SAIDA', ms(23, 17))];
    const eff = resolveEffectivePunches(raw, [adj({ type: 'RETORNO', requestedTime: '13:00', action: 'INCLUSAO' })]);
    const [row] = journeyRows(eff, opts());
    expect(row.situation).toBe('NORMAL');
    expect(row.workedMs).toBe(8 * H);
    expect(row.slots.RETORNO?.adjustmentAction).toBe('INCLUSAO');
  });

  it('solicitação PENDENTE do funcionário → Aguardando correção (conta como pendência)', () => {
    const raw = day(23, [8, 0], [12, 0], [13, 0], [17, 0]);
    const [row] = journeyRows(raw, opts({ adjustments: [adj({ status: 'PENDENTE', origin: 'SOLICITACAO' })] }));
    expect(row.awaitingCorrection).toBe(true);
    expect(filterTimesheetRows([row], 'PENDENCIA')).toHaveLength(1);
  });
});

/* Grade da competência — escala seg–sex 9h, feriado 07/09 (seg), atestado
 * lançado em 15/09 (resolvedor devolve 0), "hoje" = 24/09 (qui) 10:00. */
describe('grade: dias previstos sem registro', () => {
  const HOLIDAY = '2026-09-07';
  const ATESTADO = '2026-09-15';
  const expected = (dk: string) => {
    const [y, m, d] = dk.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    if (dk === HOLIDAY || dk === ATESTADO) return 0;
    return dow === 0 || dow === 6 ? 0 : 9 * H;
  };
  const grid = (punches: TimePunch[] = [], extra: Partial<TimesheetOptions> = {}) => buildTimesheetRows(punches, opts({
    nowMs: ms(24, 10),
    expectedMsForDate: expected,
    occurrences: { [HOLIDAY]: 'Feriado: Independência', [ATESTADO]: 'Atestado' },
    trackingStartKey: '2026-09-01',
    ...extra,
  }));
  const byDay = (rows: ReturnType<typeof grid>, dk: string) => rows.filter((r) => r.competenceKey === dk);

  it('23/09 previsto sem batida → — | 0h00 | 9h00 | -9h00 | Sem registro', () => {
    const [row] = byDay(grid(), '2026-09-23');
    expect(row.situation).toBe('SEM_REGISTRO');
    expect(row.journey).toBeUndefined();
    expect(Object.values(row.slots).every((p) => p === undefined)).toBe(true);
    expect(row.workedMs).toBe(0);
    expect(row.expectedMs).toBe(9 * H);
    expect(row.balanceMs).toBe(-9 * H);
    expect(filterTimesheetRows([row], 'PENDENCIA')).toHaveLength(1);
  });

  it('feriado: aparece como ocorrência, previsto 0, sem saldo negativo', () => {
    const [row] = byDay(grid(), HOLIDAY);
    expect(row.situation).toBe('OCORRENCIA');
    expect(row.occurrence).toBe('Feriado: Independência');
    expect(row.expectedMs).toBe(0);
    expect(row.balanceMs).toBeNull();
  });

  it('atestado já lançado (domínio existente): ocorrência, sem horas negativas', () => {
    const [row] = byDay(grid(), ATESTADO);
    expect(row.situation).toBe('OCORRENCIA');
    expect(row.balanceMs).toBeNull();
  });

  it('folga de escala (fim de semana) sem batida não gera linha nem horas negativas', () => {
    const rows = grid();
    expect(byDay(rows, '2026-09-19')).toHaveLength(0); // sábado
    expect(byDay(rows, '2026-09-20')).toHaveLength(0); // domingo
  });

  it('hoje e dias futuros não viram "Sem registro"', () => {
    const rows = grid();
    expect(byDay(rows, '2026-09-24')).toHaveLength(0);
    expect(byDay(rows, '2026-09-25')).toHaveLength(0);
    expect(rows.filter((r) => r.situation === 'SEM_REGISTRO').every((r) => r.competenceKey < '2026-09-24')).toBe(true);
  });

  it('dia com jornada não gera "Sem registro"; trabalho em feriado = Hora extra', () => {
    const rows = grid([
      ...day(23, [8, 0], [12, 0], [13, 0], [18, 0]),
      punch('ENTRADA', ms(7, 8)), punch('SAIDA', ms(7, 12)),
    ]);
    expect(byDay(rows, '2026-09-23').map((r) => r.situation)).toEqual(['NORMAL']);
    const holidayWork = byDay(rows, HOLIDAY);
    expect(holidayWork).toHaveLength(1);
    expect(holidayWork[0].situation).toBe('HORA_EXTRA');
    expect(holidayWork[0].occurrence).toBe('Feriado: Independência');
  });

  it('noturna: batidas após a meia-noite pertencem à jornada da véspera (não criam linha no dia seguinte)', () => {
    const rows = grid([
      punch('ENTRADA', ms(22, 20)), punch('PAUSA', ms(22, 23, 30)),
      punch('RETORNO', ms(23, 0, 30)), punch('SAIDA', ms(23, 4)),
    ], { expectedMsForDate: (dk) => (dk === '2026-09-22' ? 7 * H : 0) });
    expect(byDay(rows, '2026-09-22').map((r) => r.situation)).toEqual(['NORMAL']);
    expect(byDay(rows, '2026-09-23')).toHaveLength(0);
  });
});

describe('totais da folha', () => {
  it('previsto inclui dias sem registro; saldo soma −previsto deles; folga/feriado = 0', () => {
    // Setembro/2026 até 23/09: dias úteis = 17 (1–23, sem sábados/domingos),
    // menos feriado 07/09 → 16 dias previstos de 8h.
    const expected = (dk: string) => {
      const [y, m, d] = dk.split('-').map(Number);
      const dow = new Date(y, m - 1, d).getDay();
      return dk === '2026-09-07' || dow === 0 || dow === 6 ? 0 : 8 * H;
    };
    const punches = [
      ...day(21, [8, 0], [12, 0], [13, 0], [17, 0]), // 8h  → saldo 0
      ...day(22, [8, 0], [12, 0], [13, 0], [18, 0]), // 9h  → +1h
      punch('ENTRADA', ms(23, 8)),                    // aberta >18h → pendência, fora do saldo
    ];
    const o = opts({ nowMs: ms(24, 10), expectedMsForDate: expected, occurrences: { '2026-09-07': 'Feriado' }, trackingStartKey: '2026-09-01' });
    const rows = buildTimesheetRows(punches, o);
    const semRegistro = rows.filter((r) => r.situation === 'SEM_REGISTRO');
    expect(semRegistro).toHaveLength(13);             // 16 previstos − 21, 22, 23
    const t = summarizeTimesheetRows(rows);
    expect(t.previstoMs).toBe(16 * 8 * H);
    expect(t.trabalhadoMs).toBe(17 * H);
    expect(t.saldoMs).toBe(1 * H - 13 * 8 * H);
    const s = summarizeEmployeeMonth(EMP, punches, o);
    expect(s).toMatchObject(t);
    expect(s.journeys).toBe(3);
    expect(s.pendencies).toBe(14);                    // 13 sem registro + 1 anômala
  });
});

describe('exemplo do enunciado', () => {
  it('08:02–12:01 / 13:03–17:59 soma 8h55 (3h59 + 4h56) → Hora extra de +0h55', () => {
    const [row] = journeyRows(day(23, [8, 2], [12, 1], [13, 3], [17, 59]), opts());
    expect(row.workedMs).toBe(8 * H + 55 * MIN);
    expect(row.balanceMs).toBe(55 * MIN);
    expect(row.situation).toBe('HORA_EXTRA');
  });
});

describe('início da apuração', () => {
  const weekday9h = (dk: string) => {
    const [y, m, d] = dk.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    return dow === 0 || dow === 6 ? 0 : 9 * H;
  };
  const base = { nowMs: ms(24, 10), expectedMsForDate: weekday9h };

  it('dias previstos ANTES do início da apuração não viram "Sem registro"', () => {
    const rows = buildTimesheetRows(day(21, [8, 0], [12, 0], [13, 0], [18, 0]), opts({ ...base, trackingStartKey: '2026-09-21' }));
    const semRegistro = rows.filter((r) => r.situation === 'SEM_REGISTRO').map((r) => r.competenceKey);
    expect(semRegistro).toEqual(['2026-09-22', '2026-09-23']);
    expect(summarizeTimesheetRows(rows).previstoMs).toBe(3 * 9 * H); // 21 (jornada) + 22 + 23
  });

  it('início desconhecido (sem nenhuma batida) → nenhum dia presumido "Sem registro"', () => {
    const rows = buildTimesheetRows([], opts({ ...base, trackingStartKey: undefined }));
    expect(rows.filter((r) => r.situation === 'SEM_REGISTRO')).toHaveLength(0);
    expect(summarizeTimesheetRows(rows)).toEqual({ previstoMs: 0, trabalhadoMs: 0, saldoMs: 0 });
  });

  it('resolveTrackingStartKey: 1ª batida original do servidor ou a efetiva conhecida mais antiga', () => {
    const known = [punch('ENTRADA', ms(10, 8)), punch('SAIDA', ms(10, 17))];
    expect(resolveTrackingStartKey(ms(3, 8, 0, 8), known)).toBe('2026-08-03');   // servidor mais antigo
    expect(resolveTrackingStartKey(undefined, known)).toBe('2026-09-10');        // só as conhecidas
    expect(resolveTrackingStartKey(ms(15, 8), [punch('RETORNO', ms(12, 13))])).toBe('2026-09-12'); // inclusão anterior
    expect(resolveTrackingStartKey(undefined, [])).toBeUndefined();
  });
});

describe('documentos (PDF/Excel) = mesmas linhas e totais da Folha', () => {
  const expected = (dk: string) => {
    const [y, m, d] = dk.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    return dk === '2026-09-07' || dow === 0 || dow === 6 ? 0 : 9 * H;
  };
  const o = opts({
    nowMs: ms(24, 10), expectedMsForDate: expected, trackingStartKey: '2026-09-21',
    occurrences: { '2026-09-07': 'Feriado: Independência' },
  });
  const punches = [
    punch('ENTRADA', ms(21, 20)), punch('PAUSA', ms(21, 23, 30)), punch('RETORNO', ms(22, 0, 30)), punch('SAIDA', ms(22, 6)),
  ];
  const rows = buildTimesheetRows(punches, o);
  const lines = toDocumentLines(rows);

  it('uma linha de documento por linha da Folha, com os mesmos valores', () => {
    expect(lines).toHaveLength(rows.length);
    lines.forEach((l, i) => {
      expect(l.dateKey).toBe(rows[i].competenceKey);
      expect(l.workedMs).toBe(rows[i].workedMs);
      expect(l.expectedMs).toBe(rows[i].expectedMs);
      expect(l.balanceMs).toBe(rows[i].balanceMs);
      expect(l.situation).toBe(rows[i].situation);
    });
  });

  it('"Sem registro" reduz o saldo do documento exatamente como na tela', () => {
    const sem = lines.find((l) => l.dateKey === '2026-09-23')!;
    expect(sem.label).toBe('Sem registro');
    expect(sem.balanceMs).toBe(-9 * H);
    const docSaldo = lines.reduce((s, l) => s + (l.balanceMs ?? 0), 0);
    const docPrevisto = lines.reduce((s, l) => s + l.expectedMs, 0);
    const screen = summarizeTimesheetRows(rows);
    expect(docSaldo).toBe(screen.saldoMs);
    expect(docPrevisto).toBe(screen.previstoMs);
    expect(screen.saldoMs).toBe((9 * H - 9 * H) - 9 * H - 9 * H); // 21 normal (9h) · 22 e 23 sem registro
  });

  it('noturna: saída marcada (+1) e feriado como ocorrência sem saldo', () => {
    const night = lines.find((l) => l.dateKey === '2026-09-21')!;
    expect(night.saidaNextDay).toBe(true);
    expect(night.workedMs).toBe(9 * H);
    const holiday = lines.find((l) => l.dateKey === '2026-09-07')!;
    expect(holiday.label).toBe('Feriado: Independência');
    expect(holiday.balanceMs).toBeNull();
    expect(holiday.tone).toBe('info');
  });
});
