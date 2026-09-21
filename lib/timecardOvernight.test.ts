import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  buildJourneys, consolidateDay, buildDailyTimeRecords, computePeriodSummary,
  OPEN_JOURNEY_LIMIT_MS,
} from './timecard';
import { derivePunchState, nextPunchType } from './pontoActions';
import { dayExpectedMs, WorkSchedule, DEFAULT_SCHEDULE } from './schedule';
import { resolveEffectivePunches } from './effectivePunches';
import type { PunchAdjustment } from './adjustments';
import { TimePunch } from './types';

/* ===================================================================
 * JORNADA NOTURNA / VIRADA DE DIA — apuração por sequência cronológica.
 * A DATA CIVIL não encerra a jornada; ENTRADA de um dia é fechada por SAÍDA do
 * dia seguinte; horas somam com timestamps completos (datetime, não HH:mm).
 * =================================================================== */

const EMP = 'Fulano';
const ms = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi, 0).getTime();
const H = 60 * 60 * 1000;
const MIN = 60 * 1000;
const punch = (type: TimePunch['type'], atMs: number, employee = EMP): TimePunch => ({
  id: `${type}_${atMs}`, employeeName: employee, timestamp: '', type,
  locationStr: '', lat: 0, lng: 0, status: 'APROVADO', at: atMs,
});

describe('1) 21:30 → 02:15 do dia seguinte = 4h45', () => {
  it('fecha a entrada da véspera e soma com datetime completo', () => {
    const c = consolidateDay([
      punch('ENTRADA', ms(2026, 9, 20, 21, 30)),
      punch('SAIDA', ms(2026, 9, 21, 2, 15)),
    ]);
    expect(c.status).toBe('OK');
    expect(c.workedMs).toBe((4 * 60 + 45) * MIN);
    expect(c.crossesMidnight).toBe(true);
  });
});

describe('2/17) jornada prevista 22:00 → 05:00 = 7h', () => {
  const noturna: WorkSchedule = DEFAULT_SCHEDULE.map(() => ({ works: true, start: '22:00', end: '05:00', lunchMinutes: 0 }));
  it('não interpreta 05:00 como anterior a 22:00 (previsto 7h, não 0)', () => {
    expect(dayExpectedMs(noturna, 1)).toBe(7 * H);
  });
  it('trabalhado 22:00 → 05:00 também = 7h', () => {
    const c = consolidateDay([punch('ENTRADA', ms(2026, 9, 20, 22, 0)), punch('SAIDA', ms(2026, 9, 21, 5, 0))]);
    expect(c.workedMs).toBe(7 * H);
  });
});

describe('3) intervalo inteiramente antes da meia-noite (turno noturno)', () => {
  it('pareia almoço na véspera e soma o restante após 00:00', () => {
    // 21:00 entrada, 21:40 pausa, 22:10 retorno, 02:00 saída = 40min + 3h50 = 4h30
    const c = consolidateDay([
      punch('ENTRADA', ms(2026, 9, 20, 21, 0)),
      punch('PAUSA', ms(2026, 9, 20, 21, 40)),
      punch('RETORNO', ms(2026, 9, 20, 22, 10)),
      punch('SAIDA', ms(2026, 9, 21, 2, 0)),
    ]);
    expect(c.status).toBe('OK');
    expect(c.workedMs).toBe(40 * MIN + (3 * 60 + 50) * MIN);
  });
});

describe('4) intervalo atravessando a meia-noite = 3h30 (§9)', () => {
  it('data diferente entre as batidas não quebra o pareamento', () => {
    // 23:00 entrada, 23:50 pausa, 00:20 retorno, 03:00 saída = 50min + 2h40 = 3h30
    const c = consolidateDay([
      punch('ENTRADA', ms(2026, 9, 20, 23, 0)),
      punch('PAUSA', ms(2026, 9, 20, 23, 50)),
      punch('RETORNO', ms(2026, 9, 21, 0, 20)),
      punch('SAIDA', ms(2026, 9, 21, 3, 0)),
    ]);
    expect(c.status).toBe('OK');
    expect(c.workedMs).toBe(50 * MIN + (2 * 60 + 40) * MIN);
  });

  it('exemplo do enunciado (item 4): 6h com 30min de intervalo', () => {
    // 21:30 → 00:30 = 3h ; 01:00 → 04:00 = 3h ; total 6h
    const c = consolidateDay([
      punch('ENTRADA', ms(2026, 9, 20, 21, 30)),
      punch('PAUSA', ms(2026, 9, 21, 0, 30)),
      punch('RETORNO', ms(2026, 9, 21, 1, 0)),
      punch('SAIDA', ms(2026, 9, 21, 4, 0)),
    ]);
    expect(c.workedMs).toBe(6 * H);
  });
});

describe('5) estado continua EM JORNADA após 00:00', () => {
  it('entrada às 21:30 de ontem, agora 01:00 → TRABALHANDO (não FORA)', () => {
    const punches = [punch('ENTRADA', ms(2026, 9, 20, 21, 30))];
    const now = ms(2026, 9, 21, 1, 0);
    const st = derivePunchState(punches, EMP, now);
    expect(st.statusKind).toBe('TRABALHANDO');
    expect(st.entrada?.at).toBe(ms(2026, 9, 20, 21, 30));
  });
});

describe('6) próxima ação após a meia-noite respeita a jornada aberta', () => {
  it('não oferece nova ENTRADA — segue a sequência (PAUSA)', () => {
    const punches = [punch('ENTRADA', ms(2026, 9, 20, 21, 30))];
    const now = ms(2026, 9, 21, 1, 0);
    expect(nextPunchType(punches, EMP, now)).toBe('PAUSA');
  });
  it('já com pausa/retorno abertos, a próxima é SAIDA mesmo após 00:00', () => {
    const punches = [
      punch('ENTRADA', ms(2026, 9, 20, 21, 0)),
      punch('PAUSA', ms(2026, 9, 20, 23, 50)),
      punch('RETORNO', ms(2026, 9, 21, 0, 20)),
    ];
    expect(nextPunchType(punches, EMP, ms(2026, 9, 21, 1, 0))).toBe('SAIDA');
  });
});

describe('7/8/9) saída do dia seguinte fecha a jornada anterior, sem duplicar', () => {
  const punches = [
    punch('ENTRADA', ms(2026, 9, 20, 21, 30)),
    punch('SAIDA', ms(2026, 9, 21, 2, 15)),
  ];
  it('uma única jornada (não cria segunda)', () => {
    const journeys = buildJourneys(punches);
    expect(journeys).toHaveLength(1);
    expect(journeys[0].status).toBe('OK');
  });
  it('relatório diário: um único registro, no dia da entrada', () => {
    const recs = buildDailyTimeRecords(punches);
    expect(recs).toHaveLength(1);
    expect(recs[0].dateKey).toBe('2026-09-20');
    expect(recs[0].workedMs).toBe((4 * 60 + 45) * MIN);
  });
});

describe('10/11/15-mês) virada de mês: pertence a 30/09, contada uma vez', () => {
  const punches = [
    punch('ENTRADA', ms(2026, 9, 30, 22, 0)),
    punch('SAIDA', ms(2026, 10, 1, 3, 0)),
  ];
  it('competência = 30/09 (dia da entrada), 5h', () => {
    const sept = buildDailyTimeRecords(punches, { monthKey: '2026-09' });
    expect(sept).toHaveLength(1);
    expect(sept[0].dateKey).toBe('2026-09-30');
    expect(sept[0].workedMs).toBe(5 * H);
    expect(sept[0].crossesMidnight).toBe(true);
  });
  it('outubro NÃO recebe a mesma jornada (sem dupla contagem)', () => {
    const oct = buildDailyTimeRecords(punches, { monthKey: '2026-10' });
    expect(oct).toHaveLength(0);
  });
  it('somatório dos dois meses = 5h uma única vez', () => {
    const exp = () => 0;
    const sept = computePeriodSummary(buildDailyTimeRecords(punches, { monthKey: '2026-09' }), exp);
    const oct = computePeriodSummary(buildDailyTimeRecords(punches, { monthKey: '2026-10' }), exp);
    expect(sept.trabalhadoMs + oct.trabalhadoMs).toBe(5 * H);
  });
});

describe('12) virada de ANO: 31/12 → 01/01 funciona', () => {
  it('competência 31/12/2026, 5h', () => {
    const recs = buildDailyTimeRecords([
      punch('ENTRADA', ms(2026, 12, 31, 22, 0)),
      punch('SAIDA', ms(2027, 1, 1, 3, 0)),
    ], { monthKey: '2026-12' });
    expect(recs).toHaveLength(1);
    expect(recs[0].dateKey).toBe('2026-12-31');
    expect(recs[0].workedMs).toBe(5 * H);
  });
});

describe('13) ajuste administrativo em batida noturna recalcula pelos timestamps efetivos', () => {
  it('saída ajustada para 02:15 (+1) produz 4h45, sem alterar o registro original', () => {
    const entrada = punch('ENTRADA', ms(2026, 9, 20, 21, 30));
    const saidaOriginal = { ...punch('SAIDA', ms(2026, 9, 20, 23, 0)), id: 'saida-1' };
    const ajuste: PunchAdjustment = {
      id: 'adj-1', employeeName: EMP, refDate: '2026-09-21', type: 'SAIDA',
      requestedTime: '02:15', reason: 'esqueceu de bater', status: 'APROVADO',
      originalPunchId: 'saida-1',
    };
    const efetivas = resolveEffectivePunches([entrada, saidaOriginal], [ajuste]);
    const c = consolidateDay(efetivas);
    expect(c.status).toBe('OK');
    expect(c.workedMs).toBe((4 * 60 + 45) * MIN);
    // O registro original é preservado como evidência (originalAt).
    const efetivaSaida = efetivas.find((p) => p.type === 'SAIDA')!;
    expect(efetivaSaida.originalAt).toBe(ms(2026, 9, 20, 23, 0));
  });
});

describe('14) timestamps originais permanecem preservados na consolidação', () => {
  it('buildJourneys não altera os epochs das batidas', () => {
    const entradaAt = ms(2026, 9, 20, 21, 30);
    const saidaAt = ms(2026, 9, 21, 2, 15);
    const punches = [punch('ENTRADA', entradaAt), punch('SAIDA', saidaAt)];
    const journeys = buildJourneys(punches);
    expect(journeys[0].entrada).toBe(entradaAt);
    expect(journeys[0].saida).toBe(saidaAt);
    expect(punches[0].at).toBe(entradaAt);
    expect(punches[1].at).toBe(saidaAt);
  });
});

describe('15) PDF representa entrada/saída e total (sinalizando o dia seguinte)', () => {
  it('o registro carrega crossesMidnight e horas para o PDF', () => {
    const recs = buildDailyTimeRecords([
      punch('ENTRADA', ms(2026, 9, 20, 21, 30)),
      punch('SAIDA', ms(2026, 9, 21, 2, 15)),
    ]);
    expect(recs[0].crossesMidnight).toBe(true);
    expect(recs[0].entrada).toBe(ms(2026, 9, 20, 21, 30));
    expect(recs[0].saida).toBe(ms(2026, 9, 21, 2, 15));
    expect(recs[0].workedMs).toBe((4 * 60 + 45) * MIN);
  });
  it('o documento marca a saída do dia seguinte com "(+1)"', () => {
    const src = readFileSync(resolve(process.cwd(), 'components/documentos/TimecardDocument.tsx'), 'utf8');
    expect(src).toContain('(+1)');
    expect(src).toContain('crossesMidnight');
  });
});

describe('16) jornada aberta anormal (>18h) não recebe saída inventada', () => {
  it('marca possivelmente incompleta, sem saída e sem horas', () => {
    const entradaAt = ms(2026, 9, 20, 21, 30);
    const now = entradaAt + 20 * H; // 20h em aberto (> janela de 18h)
    const c = consolidateDay([punch('ENTRADA', entradaAt)], now);
    expect(c.status).toBe('ABERTA_ANOMALA');
    expect(c.saida).toBeUndefined();
    expect(c.workedMs).toBeNull();
  });
  it('dentro da janela de segurança (18h) segue EM_ANDAMENTO', () => {
    const entradaAt = ms(2026, 9, 20, 21, 30);
    const c = consolidateDay([punch('ENTRADA', entradaAt)], entradaAt + (OPEN_JOURNEY_LIMIT_MS - 60 * 1000));
    expect(c.status).toBe('EM_ANDAMENTO');
  });
});

describe('18) cálculo usa datetime completo, não somente HH:mm', () => {
  it('mesma hora de relógio em dias diferentes = 24h (não 0)', () => {
    const c = consolidateDay([
      punch('ENTRADA', ms(2026, 9, 20, 23, 0)),
      punch('SAIDA', ms(2026, 9, 21, 23, 0)),
    ]);
    // 24h em aberto seria anômalo se em curso, mas aqui há saída explícita:
    expect(c.workedMs).toBe(24 * H);
  });
  it('não usa a regra frágil "se saída < entrada soma 24h": 26h reais = 26h', () => {
    const c = consolidateDay([
      punch('ENTRADA', ms(2026, 9, 20, 20, 0)),
      punch('SAIDA', ms(2026, 9, 21, 22, 0)),
    ]);
    expect(c.workedMs).toBe(26 * H);
  });
});
