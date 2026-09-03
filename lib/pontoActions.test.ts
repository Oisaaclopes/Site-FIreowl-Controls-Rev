import { describe, it, expect } from 'vitest';
import { nextPunchType, derivePunchState, PunchType } from './pontoActions';
import { TimePunch } from './types';

const NOW = new Date('2026-09-03T15:00:00').getTime();
const EMP = 'Isaac';

// Cria uma batida efetiva mínima para o dia de hoje (epoch controlado).
function punch(type: PunchType, hhmm: string, employee = EMP): TimePunch {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(NOW);
  d.setHours(h, m, 0, 0);
  return {
    id: `p_${type}_${hhmm}`,
    employeeName: employee,
    timestamp: `03 SET 2026 | ${hhmm}:00`,
    type,
    locationStr: 'Sem localização',
    lat: 0,
    lng: 0,
    status: 'APROVADO',
    at: d.getTime(),
  };
}

describe('nextPunchType — sequência canônica', () => {
  it('sem batida → ENTRADA', () => {
    expect(nextPunchType([], EMP, NOW)).toBe('ENTRADA');
  });
  it('após ENTRADA → PAUSA (saída para almoço)', () => {
    expect(nextPunchType([punch('ENTRADA', '09:00')], EMP, NOW)).toBe('PAUSA');
  });
  it('após PAUSA → RETORNO', () => {
    expect(nextPunchType([punch('ENTRADA', '09:00'), punch('PAUSA', '12:00')], EMP, NOW)).toBe('RETORNO');
  });
  it('após RETORNO → SAIDA', () => {
    expect(
      nextPunchType([punch('ENTRADA', '09:00'), punch('PAUSA', '12:00'), punch('RETORNO', '13:00')], EMP, NOW)
    ).toBe('SAIDA');
  });
  it('após SAIDA → encerrada (null)', () => {
    expect(
      nextPunchType(
        [punch('ENTRADA', '09:00'), punch('PAUSA', '12:00'), punch('RETORNO', '13:00'), punch('SAIDA', '18:00')],
        EMP,
        NOW
      )
    ).toBeNull();
  });
  it('ignora batidas de outro funcionário', () => {
    expect(nextPunchType([punch('ENTRADA', '09:00', 'Outro')], EMP, NOW)).toBe('ENTRADA');
  });
});

describe('derivePunchState — estado da jornada', () => {
  it('sem batida → FORA, próxima ENTRADA', () => {
    const st = derivePunchState([], EMP, NOW);
    expect(st.statusKind).toBe('FORA');
    expect(st.statusLabel).toBe('Fora do expediente');
    expect(st.nextType).toBe('ENTRADA');
    expect(st.lastRelevant).toBeUndefined();
  });
  it('com ENTRADA → TRABALHANDO, próxima PAUSA', () => {
    const st = derivePunchState([punch('ENTRADA', '09:02')], EMP, NOW);
    expect(st.statusKind).toBe('TRABALHANDO');
    expect(st.nextType).toBe('PAUSA');
    expect(st.entrada?.type).toBe('ENTRADA');
    expect(st.lastRelevant?.type).toBe('ENTRADA');
  });
  it('em almoço (PAUSA sem RETORNO) → ALMOCO, próxima RETORNO', () => {
    const st = derivePunchState([punch('ENTRADA', '09:00'), punch('PAUSA', '12:00')], EMP, NOW);
    expect(st.statusKind).toBe('ALMOCO');
    expect(st.nextType).toBe('RETORNO');
  });
  it('após RETORNO → TRABALHANDO, próxima SAIDA', () => {
    const st = derivePunchState(
      [punch('ENTRADA', '09:00'), punch('PAUSA', '12:00'), punch('RETORNO', '13:00')],
      EMP,
      NOW
    );
    expect(st.statusKind).toBe('TRABALHANDO');
    expect(st.nextType).toBe('SAIDA');
  });
  it('após SAIDA → ENCERRADA, sem próxima batida', () => {
    const st = derivePunchState(
      [punch('ENTRADA', '09:00'), punch('PAUSA', '12:00'), punch('RETORNO', '13:00'), punch('SAIDA', '18:03')],
      EMP,
      NOW
    );
    expect(st.statusKind).toBe('ENCERRADA');
    expect(st.statusLabel).toBe('Jornada encerrada');
    expect(st.nextType).toBeNull();
    expect(st.lastRelevant?.type).toBe('SAIDA');
  });
  it('usa a batida efetiva recebida (ajuste aprovado já aplicado na fonte)', () => {
    // Simula uma entrada cujo horário efetivo foi ajustado para 08:01.
    const ajustada = punch('ENTRADA', '08:01');
    const st = derivePunchState([ajustada], EMP, NOW);
    expect(st.entrada?.at).toBe(ajustada.at);
    expect(st.nextType).toBe('PAUSA');
  });
});
