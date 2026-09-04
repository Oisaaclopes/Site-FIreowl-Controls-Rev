import { describe, expect, it } from 'vitest';
import {
  ATTENDANCE_RESULT_LABEL,
  attendanceFinalizationBlockers,
  canConcludeOsFromResult,
  findActiveAttendance,
  formatAttendanceElapsed,
  formatStartedAt,
  resultNeedsObservation,
  shouldWarnNoJourney,
} from './attendanceFlow';
import { ServiceAttendance, TimePunch } from './types';

const now = new Date(2026, 8, 3, 14).getTime();
const punch = (type: TimePunch['type'], hour: number): TimePunch => ({
  id: `${type}-${hour}`, userId: 'u1', employeeName: 'Ana', timestamp: '', type,
  locationStr: '', locationAddress: '', lat: 0, lng: 0, status: 'APROVADO',
  at: new Date(2026, 8, 3, hour).getTime(),
});
const att = (over: Partial<ServiceAttendance> = {}): ServiceAttendance => ({
  id: 'a1', workOrderId: 'os1', technicianId: 'u1', status: 'EM_EXECUCAO', ...over,
});

describe('shouldWarnNoJourney (§6)', () => {
  it('avisa quando usa ponto e não há jornada aberta', () => {
    expect(shouldWarnNoJourney(true, [], now)).toBe(true);
    expect(shouldWarnNoJourney(true, [punch('SAIDA', 12)], now)).toBe(true);
  });
  it('não avisa quando há jornada aberta hoje', () => {
    expect(shouldWarnNoJourney(true, [punch('ENTRADA', 8)], now)).toBe(false);
  });
  it('nunca avisa quando o técnico não usa controle de ponto', () => {
    expect(shouldWarnNoJourney(false, [], now)).toBe(false);
    expect(shouldWarnNoJourney(false, [punch('SAIDA', 12)], now)).toBe(false);
  });
});

describe('resultado do atendimento (§15/§16/§17)', () => {
  it('só RESOLVIDO habilita concluir a OS', () => {
    expect(canConcludeOsFromResult('RESOLVIDO')).toBe(true);
    expect(canConcludeOsFromResult('PARCIALMENTE_RESOLVIDO')).toBe(false);
    expect(canConcludeOsFromResult('NAO_RESOLVIDO')).toBe(false);
    expect(canConcludeOsFromResult(undefined)).toBe(false);
  });
  it('PARCIAL e NÃO RESOLVIDO pedem observação', () => {
    expect(resultNeedsObservation('PARCIALMENTE_RESOLVIDO')).toBe(true);
    expect(resultNeedsObservation('NAO_RESOLVIDO')).toBe(true);
    expect(resultNeedsObservation('RESOLVIDO')).toBe(false);
  });
  it('mantém os valores canônicos da 0083 nos rótulos', () => {
    expect(Object.keys(ATTENDANCE_RESULT_LABEL).sort()).toEqual(
      ['NAO_RESOLVIDO', 'PARCIALMENTE_RESOLVIDO', 'RESOLVIDO']
    );
  });
});

describe('findActiveAttendance (§7)', () => {
  it('encontra o atendimento em execução do técnico', () => {
    const found = findActiveAttendance([att()], 'u1');
    expect(found?.id).toBe('a1');
  });
  it('ignora atendimento finalizado e de outro técnico', () => {
    expect(findActiveAttendance([att({ status: 'FINALIZADO' })], 'u1')).toBeUndefined();
    expect(findActiveAttendance([att({ technicianId: 'u2' })], 'u1')).toBeUndefined();
  });
});

describe('validação de finalização — central SDAI (§24/§52)', () => {
  const base = { isSdai: true, centralNotApplicable: false, hasCentralBefore: false, hasCentralAfter: false };
  it('SDAI sem condição inicial → bloqueia', () => {
    const b = attendanceFinalizationBlockers({ ...base, hasCentralBefore: false, hasCentralAfter: true });
    expect(b.map((x) => x.key)).toContain('central_before');
  });
  it('SDAI sem condição final → bloqueia', () => {
    const b = attendanceFinalizationBlockers({ ...base, hasCentralBefore: true, hasCentralAfter: false });
    expect(b.map((x) => x.key)).toContain('central_after');
  });
  it('SDAI com ambas → libera', () => {
    expect(attendanceFinalizationBlockers({ ...base, hasCentralBefore: true, hasCentralAfter: true })).toEqual([]);
  });
  it('SDAI + central não aplicável + motivo → libera', () => {
    expect(attendanceFinalizationBlockers({ ...base, centralNotApplicable: true, centralNaReason: 'Serviço só em infraestrutura' })).toEqual([]);
  });
  it('SDAI + central não aplicável sem motivo → bloqueia', () => {
    const b = attendanceFinalizationBlockers({ ...base, centralNotApplicable: true, centralNaReason: '' });
    expect(b.map((x) => x.key)).toContain('central_na_reason');
  });
  it('CFTV/BMS (não SDAI) → nunca exige central', () => {
    expect(attendanceFinalizationBlockers({ ...base, isSdai: false })).toEqual([]);
  });
});

describe('tempo derivado do atendimento (§22)', () => {
  it('formata horas e minutos', () => {
    const start = new Date(2026, 8, 3, 12, 43).getTime();
    expect(formatAttendanceElapsed(start, now)).toBe('1h 17min');
  });
  it('mostra só minutos quando abaixo de 1h', () => {
    const start = new Date(2026, 8, 3, 13, 30).getTime();
    expect(formatAttendanceElapsed(start, now)).toBe('30min');
  });
  it('tolera início ausente/ inválido', () => {
    expect(formatAttendanceElapsed(undefined, now)).toBe('');
    expect(formatAttendanceElapsed('não-é-data', now)).toBe('');
  });
  it('formata o horário de início', () => {
    expect(formatStartedAt(new Date(2026, 8, 3, 9, 42).getTime())).toBe('09:42');
    expect(formatStartedAt(undefined)).toBe('');
  });
});
