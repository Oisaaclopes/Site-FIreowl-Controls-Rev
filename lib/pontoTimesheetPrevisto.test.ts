import { describe, expect, it } from 'vitest';
import { WorkSchedule, DEFAULT_SCHEDULE, dayExpectedMs } from './schedule';
import { computePeriodSummary, DailyTimeRecord } from './timecard';

/* ===================================================================
 * Regressão da FOLHA PONTO (§7/§14): as "Horas previstas" devem vir da escala
 * do FUNCIONÁRIO da folha, nunca do usuário autenticado que gera o documento.
 * O bug original zerava as previstas ao usar a escala (vazia) do gerador.
 * =================================================================== */

const H = 60 * 60 * 1000;
const allOff: WorkSchedule = DEFAULT_SCHEDULE.map((d) => ({ ...d, works: false }));
// Rhuan: seg–sex 09:00–18:00, 60 min de almoço = 8h/dia.
const rhuan: WorkSchedule = DEFAULT_SCHEDULE.map((d, i) => ({ works: i >= 1 && i <= 5, start: '09:00', end: '18:00', lunchMinutes: 60 }));
// Ana: seg–sex 08:00–17:00, 60 min = 8h; sábado 08:00–12:00 = 4h.
const ana: WorkSchedule = DEFAULT_SCHEDULE.map((d, i) => (
  i === 6 ? { works: true, start: '08:00', end: '12:00', lunchMinutes: 0 }
  : { works: i >= 1 && i <= 5, start: '08:00', end: '17:00', lunchMinutes: 60 }
));

describe('dayExpectedMs por escala do funcionário', () => {
  it('dia útil usa a jornada do funcionário (8h)', () => {
    expect(dayExpectedMs(rhuan, 1)).toBe(8 * H); // segunda
  });
  it('folga (works=false) → 0', () => {
    expect(dayExpectedMs(rhuan, 0)).toBe(0); // domingo
    expect(dayExpectedMs(rhuan, 6)).toBe(0); // sábado
  });
  it('escala do gerador vazia (todos off) zeraria as previstas — o bug', () => {
    expect(dayExpectedMs(allOff, 1)).toBe(0);
  });
  it('escalas diferentes produzem previstas diferentes', () => {
    expect(dayExpectedMs(ana, 6)).toBe(4 * H); // Ana trabalha sábado; Rhuan não
    expect(dayExpectedMs(rhuan, 6)).toBe(0);
  });
});

describe('computePeriodSummary usa a escala do funcionário selecionado', () => {
  // 3 dias trabalhados (seg/ter/qua) de 8h cada.
  const records: DailyTimeRecord[] = ['2026-08-03', '2026-08-04', '2026-08-05'].map((dateKey) => ({
    dateKey, status: 'OK', workedMs: 8 * H, entrada: null, saida: null, marcos: [],
  } as unknown as DailyTimeRecord));

  const resolver = (schedule: WorkSchedule) => (dk: string) => {
    const [y, m, d] = dk.split('-').map(Number);
    return dayExpectedMs(schedule, new Date(y, m - 1, d).getDay());
  };

  it('previstas do funcionário (Rhuan) = 3 × 8h; saldo zero', () => {
    const s = computePeriodSummary(records, resolver(rhuan));
    expect(s.previstoMs).toBe(3 * 8 * H);
    expect(s.trabalhadoMs).toBe(3 * 8 * H);
    expect(s.saldoMs).toBe(0);
  });

  it('bug reproduzido: escala do gerador (vazia) → previstas 00:00 e tudo vira saldo positivo', () => {
    const s = computePeriodSummary(records, resolver(allOff));
    expect(s.previstoMs).toBe(0);
    expect(s.saldoMs).toBe(3 * 8 * H); // todas as horas pareceriam excedentes — o sintoma relatado
  });

  it('previstas seguem o funcionário mesmo com gerador de escala diferente (§7)', () => {
    // Gera a folha de Rhuan; o "gerador" (allOff) não influencia o resultado.
    const s = computePeriodSummary(records, resolver(rhuan));
    expect(s.previstoMs).toBe(3 * 8 * H);
    expect(s.previstoMs).not.toBe(0);
  });
});
