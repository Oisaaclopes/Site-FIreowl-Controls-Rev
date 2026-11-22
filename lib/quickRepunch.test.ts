import { describe, expect, it } from 'vitest';
import { derivePunchState, quickRepunchWarning } from './pontoActions';
import { TimePunch } from './types';

const T0 = new Date('2026-11-13T12:11:00').getTime();
const p = (id: string, type: TimePunch['type'], at: number): TimePunch => ({
  id, userId: 'u1', employeeName: 'Func', timestamp: '', type, locationStr: '', lat: 0, lng: 0, status: 'APROVADO', at,
});
const who = { userId: 'u1', name: 'Func' };

describe('quickRepunchWarning', () => {
  const punches = [p('e', 'ENTRADA', T0 - 4 * 3600e3), p('a', 'PAUSA', T0)];
  it('pergunta quando o retorno vem 15s depois do almoço', () => {
    const now = T0 + 15000;
    expect(quickRepunchWarning(derivePunchState(punches, who, now), now)).toMatch(/há 15s/);
  });
  it('não pergunta após o intervalo mínimo', () => {
    const now = T0 + 60 * 60000;
    expect(quickRepunchWarning(derivePunchState(punches, who, now), now)).toBeNull();
  });
});

import { needsNewJourneyReason, nextPunchType, buildPunch } from './pontoActions';

describe('nova jornada no mesmo dia exige motivo', () => {
  const D = (hm: string) => new Date(`2026-11-13T${hm}:00`).getTime();
  it('dia encerrado: próxima é null e nova jornada exige motivo', () => {
    const ps = [p('e', 'ENTRADA', D('08:00')), p('s', 'SAIDA', D('17:00'))];
    expect(nextPunchType(ps, who, D('19:00'))).toBeNull();
    expect(needsNewJourneyReason(ps, who, D('19:00'))).toBe(true);
    expect(derivePunchState(ps, who, D('19:00')).todayJourneysLabel).toBe('08:00–17:00');
  });
  it('batida solta hoje (saída sem entrada) também exige motivo para a Entrada', () => {
    const ps = [p('s', 'SAIDA', D('09:00'))];
    expect(nextPunchType(ps, who, D('10:00'))).toBe('ENTRADA');
    expect(needsNewJourneyReason(ps, who, D('10:00'))).toBe(true);
  });
  it('1ª entrada do dia (ontem encerrado) não exige motivo', () => {
    const ps = [p('e', 'ENTRADA', D('08:00') - 864e5), p('s', 'SAIDA', D('17:00') - 864e5)];
    expect(needsNewJourneyReason(ps, who, D('08:00'))).toBe(false);
  });
  it('jornada aberta não pede motivo (a próxima não é Entrada)', () => {
    const ps = [p('e', 'ENTRADA', D('08:00'))];
    expect(needsNewJourneyReason(ps, who, D('10:00'))).toBe(false);
  });
  it('o motivo só vai na Entrada', () => {
    expect(buildPunch('ENTRADA', 'Func', undefined, '  Segundo turno ').journeyReason).toBe('Segundo turno');
    expect(buildPunch('SAIDA', 'Func', undefined, 'x').journeyReason).toBeUndefined();
  });
});
