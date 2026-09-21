// Escala de trabalho do funcionário (usada para jornada prevista e alertas)

export interface WorkDay {
  works: boolean;
  start: string; // 'HH:MM'
  end: string; // 'HH:MM'
  lunchMinutes: number;
}

// Array de 7 posições indexado por Date.getDay() (0 = Domingo ... 6 = Sábado)
export type WorkSchedule = WorkDay[];

export const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const off: WorkDay = { works: false, start: '09:00', end: '18:00', lunchMinutes: 60 };
const segQui: WorkDay = { works: true, start: '09:00', end: '19:00', lunchMinutes: 60 };
const sex: WorkDay = { works: true, start: '09:00', end: '18:00', lunchMinutes: 60 };

// Escala padrão da empresa: Seg–Qui 09:00–19:00, Sex 09:00–18:00 (1h de almoço)
export const DEFAULT_SCHEDULE: WorkSchedule = [
  { ...off }, // Dom
  { ...segQui }, // Seg
  { ...segQui }, // Ter
  { ...segQui }, // Qua
  { ...segQui }, // Qui
  { ...sex }, // Sex
  { ...off }, // Sáb
];

export const normalizeSchedule = (s: unknown): WorkSchedule => {
  if (Array.isArray(s) && s.length === 7) {
    return s.map((d: any, i) => ({
      works: !!(d?.works),
      start: d?.start || DEFAULT_SCHEDULE[i].start,
      end: d?.end || DEFAULT_SCHEDULE[i].end,
      lunchMinutes: typeof d?.lunchMinutes === 'number' ? d.lunchMinutes : 60,
    }));
  }
  return DEFAULT_SCHEDULE.map((d) => ({ ...d }));
};

// 'HH:MM' -> minutos desde meia-noite
export const hmToMinutes = (hm: string): number => {
  const [h, m] = (hm || '0:0').split(':').map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
};

/**
 * Jornada PREVISTA (ms) para um dia da semana conforme a escala do FUNCIONÁRIO.
 * Puro e testável. Dia de folga (works=false) → 0. Feriado/atestado são tratados
 * por quem chama (contexto do funcionário/período), não aqui.
 * `dayOfWeek`: 0=Domingo … 6=Sábado (Date.getDay()).
 */
export const dayExpectedMs = (schedule: WorkSchedule, dayOfWeek: number): number => {
  const s = normalizeSchedule(schedule);
  const cfg = s[dayOfWeek];
  if (!cfg || !cfg.works) return 0;
  // Jornada noturna: quando a saída é "menor" que a entrada (ex.: 22:00 → 05:00),
  // ela atravessa a meia-noite — soma 24h ao fim. NÃO interpretar 05:00 como
  // anterior a 22:00 (isso zerava a jornada prevista da escala noturna).
  let span = hmToMinutes(cfg.end) - hmToMinutes(cfg.start);
  if (span <= 0) span += 24 * 60;
  const mins = span - (cfg.lunchMinutes || 0);
  return Math.max(0, mins) * 60000;
};
