import { describe, expect, it } from 'vitest';
import {
  ATTENDANCE_PAUSE_REASONS,
  ATTENDANCE_PAUSE_REASON_LABEL,
  computeEffectiveMs,
  computeElapsedMs,
  currentPauseInfo,
  formatDurationShort,
} from './attendanceTime';
import type { ServiceAttendanceEvent, AttendanceEventType } from './types';

const H = 3600_000;
const ev = (type: AttendanceEventType, createdAt: string, extra: Partial<ServiceAttendanceEvent> = {}): ServiceAttendanceEvent => ({
  id: `${type}-${createdAt}`, serviceAttendanceId: 'a1', type, createdAt, ...extra,
});

describe('computeEffectiveMs — exclui períodos pausados (§10)', () => {
  it('linha do tempo completa: soma só intervalos EM_EXECUCAO', () => {
    // 17:42 STARTED, 18:30 PAUSED (48min), 08:10 RESUMED, 10:45 PAUSED (2h35), 14:20 RESUMED, 16:00 FINALIZED (1h40)
    const events = [
      ev('STARTED', '2026-09-04T17:42:00Z'),
      ev('PAUSED', '2026-09-04T18:30:00Z', { reason: 'CONDICAO_CLIMATICA' }),
      ev('RESUMED', '2026-09-05T08:10:00Z'),
      ev('PAUSED', '2026-09-05T10:45:00Z', { reason: 'AGUARDANDO_MATERIAL' }),
      ev('RESUMED', '2026-09-05T14:20:00Z'),
      ev('FINALIZED', '2026-09-05T16:00:00Z'),
    ];
    const efetivo = computeEffectiveMs('2026-09-04T17:42:00Z', events, Date.parse('2026-09-10T00:00:00Z'));
    // 48min + 2h35 + 1h40 = 5h03
    expect(efetivo).toBe(48 * 60000 + (2 * H + 35 * 60000) + (1 * H + 40 * 60000));
  });

  it('em execução (sem finalizar): conta o último intervalo até now', () => {
    const now = Date.parse('2026-09-05T10:00:00Z');
    const events = [ev('STARTED', '2026-09-05T08:00:00Z')]; // aberto há 2h
    expect(computeEffectiveMs('2026-09-05T08:00:00Z', events, now)).toBe(2 * H);
  });

  it('durante PAUSADO o efetivo NÃO cresce', () => {
    const events = [
      ev('STARTED', '2026-09-05T08:00:00Z'),
      ev('PAUSED', '2026-09-05T09:00:00Z', { reason: 'FIM_JORNADA' }),
    ];
    // now muito depois; efetivo continua 1h (não conta a pausa aberta)
    expect(computeEffectiveMs('2026-09-05T08:00:00Z', events, Date.parse('2026-09-09T00:00:00Z'))).toBe(1 * H);
  });

  it('compatibilidade §8: sem STARTED usa started_at como âncora', () => {
    // atendimento antigo: só started_at, primeira ação pós-0108 é PAUSED
    const events = [ev('PAUSED', '2026-09-04T18:42:00Z', { reason: 'FIM_JORNADA' })];
    // STARTED implícito 17:42 → efetivo = 1h até o PAUSED
    expect(computeEffectiveMs('2026-09-04T17:42:00Z', events, Date.parse('2026-09-10T00:00:00Z'))).toBe(1 * H);
  });

  it('sem eventos e sem finalizar: efetivo = decorrido (legado EM_EXECUCAO)', () => {
    const now = Date.parse('2026-09-05T10:00:00Z');
    expect(computeEffectiveMs('2026-09-05T08:00:00Z', [], now)).toBe(2 * H);
  });
});

describe('computeElapsedMs — parede início→fim/now', () => {
  it('inclui o período pausado (diferente do efetivo)', () => {
    const now = Date.parse('2026-09-06T17:42:00Z');
    expect(computeElapsedMs('2026-09-04T17:42:00Z', undefined, now)).toBe(48 * H);
  });
  it('usa finished_at quando finalizado', () => {
    expect(computeElapsedMs('2026-09-05T08:00:00Z', '2026-09-05T10:00:00Z')).toBe(2 * H);
  });
});

describe('currentPauseInfo — pausa corrente', () => {
  it('último evento PAUSED → devolve motivo/quando', () => {
    const info = currentPauseInfo([
      ev('STARTED', '2026-09-05T08:00:00Z'),
      ev('PAUSED', '2026-09-05T09:00:00Z', { reason: 'CONDICAO_CLIMATICA', note: 'chuva forte' }),
    ]);
    expect(info).toEqual({ pausedAt: '2026-09-05T09:00:00Z', reason: 'CONDICAO_CLIMATICA', note: 'chuva forte' });
  });
  it('último evento RESUMED → não está pausado', () => {
    const info = currentPauseInfo([
      ev('PAUSED', '2026-09-05T09:00:00Z', { reason: 'OUTRO' }),
      ev('RESUMED', '2026-09-05T10:00:00Z'),
    ]);
    expect(info).toBeNull();
  });
});

describe('rótulos de motivo', () => {
  it('todos os motivos têm label amigável e ordem canônica', () => {
    expect(ATTENDANCE_PAUSE_REASONS).toHaveLength(8);
    for (const r of ATTENDANCE_PAUSE_REASONS) {
      expect(ATTENDANCE_PAUSE_REASON_LABEL[r]).toBeTruthy();
    }
    expect(ATTENDANCE_PAUSE_REASON_LABEL.CONDICAO_CLIMATICA).toBe('Condição climática');
  });
});

describe('formatDurationShort', () => {
  it('formata horas e minutos', () => {
    expect(formatDurationShort(2 * H + 18 * 60000)).toBe('2h18');
    expect(formatDurationShort(45 * 60000)).toBe('45min');
    expect(formatDurationShort(0)).toBe('0min');
  });
});
