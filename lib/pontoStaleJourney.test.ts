import { describe, it, expect } from 'vitest';
import { buildJourneys, buildDailyTimeRecords, OPEN_JOURNEY_LIMIT_MS } from './timecard';
import { derivePunchState, nextPunchType, PunchType } from './pontoActions';
import { TimePunch } from './types';

/* ===================================================================
 * PONTO — jornada antiga aberta NÃO sequestra a máquina de estados.
 * Regra: OPEN_JOURNEY_LIMIT_MS (18h) participa de buildJourneys,
 * nextPunchType e derivePunchState. ≤18h = jornada atual (mesmo após a
 * meia-noite); >18h = pendência (ABERTA_ANOMALA), nova Entrada liberada,
 * batida atual nunca anexada à jornada antiga, nada apagado/inventado.
 * =================================================================== */

const EMP = 'Joao';
const H = 60 * 60 * 1000;
const MIN = 60 * 1000;
const ms = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi, 0).getTime();
const punch = (type: TimePunch['type'], atMs: number): TimePunch => ({
  id: `${type}_${atMs}`, employeeName: EMP, timestamp: '', type,
  locationStr: '', lat: 0, lng: 0, status: 'APROVADO', at: atMs,
});

/** Simula o funcionário apertando o botão: grava SEMPRE a batida oferecida. */
function press(punches: TimePunch[], atMs: number, expected: PunchType): TimePunch[] {
  const offered = nextPunchType(punches, EMP, atMs);
  expect(offered).toBe(expected);
  return [...punches, punch(offered!, atMs)];
}

describe('A) jornada diurna 08:00 → 12:00 → 13:00 → 17:00', () => {
  it('após PAUSA a próxima ação é RETORNO; total 8h; encerra no fim', () => {
    let ps: TimePunch[] = [];
    ps = press(ps, ms(2026, 9, 23, 8, 0), 'ENTRADA');
    expect(derivePunchState(ps, EMP, ms(2026, 9, 23, 10, 0)).statusKind).toBe('TRABALHANDO');
    ps = press(ps, ms(2026, 9, 23, 12, 0), 'PAUSA');
    const lunch = derivePunchState(ps, EMP, ms(2026, 9, 23, 12, 30));
    expect(lunch.statusKind).toBe('ALMOCO');
    expect(lunch.nextType).toBe('RETORNO');
    ps = press(ps, ms(2026, 9, 23, 13, 0), 'RETORNO');
    expect(nextPunchType(ps, EMP, ms(2026, 9, 23, 15, 0))).toBe('SAIDA');
    ps = press(ps, ms(2026, 9, 23, 17, 0), 'SAIDA');
    const end = derivePunchState(ps, EMP, ms(2026, 9, 23, 17, 5));
    expect(end.statusKind).toBe('ENCERRADA');
    expect(end.nextType).toBeNull();
    const [j] = buildJourneys(ps, { nowMs: ms(2026, 9, 23, 18, 0) });
    expect(j.status).toBe('OK');
    expect(j.workedMs).toBe(8 * H);
  });
});

describe('B) jornada noturna 20:00 → 23:30 → 00:30 (+1) → 04:00 (+1)', () => {
  it('RETORNO funciona no dia seguinte; total 7h00, competência = dia da entrada', () => {
    let ps: TimePunch[] = [];
    ps = press(ps, ms(2026, 9, 23, 20, 0), 'ENTRADA');
    ps = press(ps, ms(2026, 9, 23, 23, 30), 'PAUSA');
    const afterMidnight = derivePunchState(ps, EMP, ms(2026, 9, 24, 0, 10));
    expect(afterMidnight.statusKind).toBe('ALMOCO');
    expect(afterMidnight.nextType).toBe('RETORNO');
    ps = press(ps, ms(2026, 9, 24, 0, 30), 'RETORNO');
    ps = press(ps, ms(2026, 9, 24, 4, 0), 'SAIDA');
    const js = buildJourneys(ps, { nowMs: ms(2026, 9, 24, 5, 0) });
    expect(js).toHaveLength(1);
    expect(js[0].status).toBe('OK');
    expect(js[0].workedMs).toBe(7 * H);
    expect(js[0].competenceKey).toBe('2026-09-23');
  });
  it('depois de encerrar a noturna às 04:00, a próxima noite oferece nova ENTRADA', () => {
    const ps = [
      punch('ENTRADA', ms(2026, 9, 23, 20, 0)), punch('PAUSA', ms(2026, 9, 23, 23, 30)),
      punch('RETORNO', ms(2026, 9, 24, 0, 30)), punch('SAIDA', ms(2026, 9, 24, 4, 0)),
    ];
    expect(nextPunchType(ps, EMP, ms(2026, 9, 24, 19, 55))).toBe('ENTRADA');
  });
});

describe('C) entrada antiga >18h → nova Entrada hoje → Pausa → Retorno → Saída', () => {
  const old = punch('ENTRADA', ms(2026, 9, 18, 21, 32));

  it('a entrada antiga NÃO bloqueia: hoje oferece ENTRADA e o dia segue normal', () => {
    let ps: TimePunch[] = [old];
    const morning = derivePunchState(ps, EMP, ms(2026, 9, 24, 7, 55));
    expect(morning.statusKind).toBe('FORA');
    expect(morning.entrada).toBeUndefined();          // não "trabalha desde 18/09"
    expect(morning.pendingOpen.map((j) => j.entrada)).toEqual([old.at]);
    ps = press(ps, ms(2026, 9, 24, 8, 0), 'ENTRADA');
    ps = press(ps, ms(2026, 9, 24, 12, 0), 'PAUSA');
    ps = press(ps, ms(2026, 9, 24, 13, 0), 'RETORNO');
    ps = press(ps, ms(2026, 9, 24, 17, 0), 'SAIDA');
    expect(nextPunchType(ps, EMP, ms(2026, 9, 24, 17, 5))).toBeNull();

    const js = buildJourneys(ps, { nowMs: ms(2026, 9, 24, 18, 0) });
    expect(js).toHaveLength(2);
    // antiga preservada: mesma batida, mesmo timestamp, sem saída inventada
    expect(js[0].punches).toEqual([old]);
    expect(js[0].entrada).toBe(ms(2026, 9, 18, 21, 32));
    expect(js[0].saida).toBeUndefined();
    expect(js[0].status).toBe('ABERTA_ANOMALA');
    expect(js[0].workedMs).toBeNull();
    // atual: completa e correta
    expect(js[1].status).toBe('OK');
    expect(js[1].workedMs).toBe(8 * H);
  });

  it('a jornada antiga continua como pendência na folha do mês', () => {
    const recs = buildDailyTimeRecords([old], { nowMs: ms(2026, 9, 24, 8, 0), monthKey: '2026-09' });
    expect(recs).toHaveLength(1);
    expect(recs[0].dateKey).toBe('2026-09-18');
    expect(recs[0].status).toBe('ABERTA_ANOMALA');
  });

  it('antiga com almoço batido (E+P, sem R/S) também vira pendência e libera ENTRADA', () => {
    const ps = [punch('ENTRADA', ms(2026, 9, 23, 8, 0)), punch('PAUSA', ms(2026, 9, 23, 12, 0))];
    expect(nextPunchType(ps, EMP, ms(2026, 9, 24, 8, 0))).toBe('ENTRADA');
    const [j] = buildJourneys(ps, { nowMs: ms(2026, 9, 24, 8, 0) });
    expect(j.status).toBe('ABERTA_ANOMALA');
  });

  it('esqueceu a saída ontem (E+P+R): hoje oferece ENTRADA, não SAÍDA', () => {
    const ps = [
      punch('ENTRADA', ms(2026, 9, 23, 8, 0)), punch('PAUSA', ms(2026, 9, 23, 12, 0)),
      punch('RETORNO', ms(2026, 9, 23, 13, 0)),
    ];
    const s = derivePunchState(ps, EMP, ms(2026, 9, 24, 8, 0));
    expect(s.nextType).toBe('ENTRADA');
    expect(s.pendingOpen).toHaveLength(1);
  });
});

describe('D) limite de 18h', () => {
  const entrada = ms(2026, 9, 23, 20, 0);
  const ps = [punch('ENTRADA', entrada)];

  it('aberta há 17h59 continua sendo a jornada atual', () => {
    const now = entrada + 17 * H + 59 * MIN;
    const s = derivePunchState(ps, EMP, now);
    expect(s.statusKind).toBe('TRABALHANDO');
    expect(s.nextType).toBe('PAUSA');
    expect(s.pendingOpen).toHaveLength(0);
    expect(buildJourneys(ps, { nowMs: now })[0].status).toBe('EM_ANDAMENTO');
  });

  it('exatamente 18h ainda é a jornada atual (limite inclusivo)', () => {
    expect(nextPunchType(ps, EMP, entrada + OPEN_JOURNEY_LIMIT_MS)).toBe('PAUSA');
  });

  it('aberta há >18h vira pendência (ABERTA_ANOMALA) e libera ENTRADA', () => {
    const now = entrada + OPEN_JOURNEY_LIMIT_MS + MIN;
    const s = derivePunchState(ps, EMP, now);
    expect(s.statusKind).toBe('FORA');
    expect(s.nextType).toBe('ENTRADA');
    expect(s.pendingOpen).toHaveLength(1);
    expect(buildJourneys(ps, { nowMs: now })[0].status).toBe('ABERTA_ANOMALA');
  });

  it('almoço em curso também respeita o limite (E+P aberta há 17h → RETORNO)', () => {
    const lunch = [punch('ENTRADA', entrada), punch('PAUSA', entrada + 3 * H)];
    expect(nextPunchType(lunch, EMP, entrada + 17 * H)).toBe('RETORNO');
    expect(buildJourneys(lunch, { nowMs: entrada + 17 * H })[0].status).toBe('EM_ANDAMENTO');
    expect(nextPunchType(lunch, EMP, entrada + 19 * H)).toBe('ENTRADA');
  });
});

describe('E) jornada antiga não recebe PAUSA/RETORNO/SAÍDA de hoje', () => {
  it('batidas >18h após a entrada não são anexadas; nada apagado nem alterado', () => {
    const old = punch('ENTRADA', ms(2026, 9, 19, 21, 0));
    const p = punch('PAUSA', ms(2026, 9, 22, 8, 0));
    const r = punch('RETORNO', ms(2026, 9, 22, 12, 0));
    const s = punch('SAIDA', ms(2026, 9, 22, 13, 0));
    const input = [old, p, r, s];
    const snapshot = JSON.stringify(input);
    const js = buildJourneys(input, { nowMs: ms(2026, 9, 24, 8, 0) });
    expect(JSON.stringify(input)).toBe(snapshot);  // entrada imutável
    expect(js).toHaveLength(2);
    expect(js[0].punches).toEqual([old]);
    expect(js[0].status).toBe('ABERTA_ANOMALA');
    // dados já distorcidos (gravados pelo bug) → inconsistência visível, não "OK"
    expect(js[1].entrada).toBeUndefined();
    expect(js[1].punches).toEqual([p, r, s]);
    expect(js[1].status).toBe('INCONSISTENTE');
    expect(js[1].workedMs).toBeNull();
    // todas as batidas continuam presentes na apuração
    expect(js.flatMap((j) => j.punches)).toHaveLength(4);
  });

  it('nesse cenário distorcido, hoje o funcionário ainda consegue abrir ENTRADA', () => {
    const ps = [
      punch('ENTRADA', ms(2026, 9, 19, 21, 0)), punch('PAUSA', ms(2026, 9, 22, 8, 0)),
      punch('RETORNO', ms(2026, 9, 22, 12, 0)), punch('SAIDA', ms(2026, 9, 22, 13, 0)),
    ];
    expect(nextPunchType(ps, EMP, ms(2026, 9, 22, 14, 0))).toBe('ENTRADA');
    expect(nextPunchType(ps, EMP, ms(2026, 9, 24, 8, 0))).toBe('ENTRADA');
  });

  it('saída de hoje após entrada esquecida ontem (>18h) não fecha nem encerra o dia', () => {
    const ps = [
      punch('ENTRADA', ms(2026, 9, 23, 8, 0)), punch('PAUSA', ms(2026, 9, 23, 12, 0)),
      punch('RETORNO', ms(2026, 9, 23, 13, 0)), punch('SAIDA', ms(2026, 9, 24, 8, 0)),
    ];
    expect(nextPunchType(ps, EMP, ms(2026, 9, 24, 8, 5))).toBe('ENTRADA');
    const js = buildJourneys(ps, { nowMs: ms(2026, 9, 24, 8, 5) });
    expect(js.find((j) => j.status === 'OK')).toBeUndefined();
  });
});

describe('F) nenhuma jornada absurda de vários dias vira OK', () => {
  it('varredura: saída 18h01 → 6 dias após a entrada nunca é OK', () => {
    const entrada = ms(2026, 9, 18, 21, 0);
    for (const gap of [18 * H + MIN, 24 * H, 60 * H, 6 * 24 * H]) {
      const variants: TimePunch[][] = [
        [punch('ENTRADA', entrada), punch('SAIDA', entrada + gap)],
        [punch('ENTRADA', entrada), punch('PAUSA', entrada + gap - 2 * H), punch('RETORNO', entrada + gap - H), punch('SAIDA', entrada + gap)],
      ];
      for (const v of variants) {
        const js = buildJourneys(v, { nowMs: entrada + gap + H });
        for (const j of js) {
          if (j.status === 'OK') expect(j.workedMs!).toBeLessThanOrEqual(OPEN_JOURNEY_LIMIT_MS);
        }
        expect(js.some((j) => j.status === 'OK' && j.entrada === entrada)).toBe(false);
      }
    }
  });
});

describe('G) identidade por user_id (nome é só apresentação)', () => {
  const mk = (type: TimePunch['type'], at: number, userId: string, name: string): TimePunch => ({
    id: `${type}_${at}_${userId}`, userId, employeeName: name, timestamp: '', type,
    locationStr: '', lat: 0, lng: 0, status: 'APROVADO', at,
  });

  it('batida de OUTRO usuário gravada com o mesmo nome não altera o estado do dono', () => {
    const mine = [mk('ENTRADA', ms(2026, 9, 24, 8, 0), 'u-joao', EMP)];
    const spoof = mk('SAIDA', ms(2026, 9, 24, 9, 0), 'u-outro', EMP); // mesmo nome, outro user_id
    const s = derivePunchState([...mine, spoof], { userId: 'u-joao', name: EMP }, ms(2026, 9, 24, 10, 0));
    expect(s.statusKind).toBe('TRABALHANDO');
    expect(s.nextType).toBe('PAUSA');
  });

  it('renomear o perfil não parte a jornada: batidas antigas com o nome anterior continuam do mesmo user_id', () => {
    const ps = [mk('ENTRADA', ms(2026, 9, 24, 8, 0), 'u-joao', 'João S.'), mk('PAUSA', ms(2026, 9, 24, 12, 0), 'u-joao', 'João Silva')];
    expect(nextPunchType(ps, { userId: 'u-joao', name: 'João Silva' }, ms(2026, 9, 24, 12, 30))).toBe('RETORNO');
  });

  it('legado: string continua sendo tratada como nome', () => {
    expect(nextPunchType([punch('ENTRADA', ms(2026, 9, 24, 8, 0))], EMP, ms(2026, 9, 24, 9, 0))).toBe('PAUSA');
  });
});
