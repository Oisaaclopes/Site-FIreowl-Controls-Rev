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
