// Regras de APURAÇÃO de tempo do Ponto — fonte única e central.
//
// Aqui vive tudo o que é "regra" (janela noturna, hora reduzida, percentual,
// política de hora extra); o motor da Folha (lib/timesheet) só as aplica.
// Nada disso é cálculo financeiro: apura TEMPO e CLASSIFICAÇÃO.
//
// Preparado para, no futuro, ser sobrescrito por contrato/CCT/configuração da
// empresa: quem chama passa um WorkTimeRules; na ausência, vale o padrão.

const MIN = 60 * 1000;

/** Trabalho noturno (período, hora reduzida e percentual do adicional). */
export interface NightWorkRule {
  /** Início da janela noturna, em minutos desde 00:00 (22:00 = 1320). */
  startMinutes: number;
  /** Fim da janela, em minutos desde 00:00 (05:00 = 300). Se ≤ início, termina no dia seguinte. */
  endMinutes: number;
  /** Duração da hora noturna reduzida, em ms (52min30s). */
  reducedHourMs: number;
  /** Percentual do adicional noturno (20 = 20%). Informativo — não há cálculo financeiro. */
  additionalPercent: number;
  /** Origem da regra, para exibir qual regra foi efetivamente usada. */
  source: 'PADRAO' | 'CONTRATO' | 'CCT' | 'EMPRESA';
  /** Rótulo legível da regra (ex.: "Padrão urbano (CLT art. 73)"). */
  label: string;
}

/**
 * Política de HORA EXTRA — decide se o excedente de uma jornada é hora
 * extraordinária (e não crédito de banco de horas). Ainda NÃO existe no
 * sistema: por isso o padrão é `null` e nenhuma jornada é classificada como
 * hora extra (saldo positivo continua só saldo). Quando existir, deverá dizer
 * no mínimo: destino do excedente (hora extra × banco de horas), tolerância
 * diária e se há limite/compensação.
 */
export interface OvertimePolicy {
  /** Para onde vai o excedente acima do previsto (após a tolerância). */
  excessGoesTo: 'HORA_EXTRA' | 'BANCO_DE_HORAS';
  /** Tolerância diária em minutos (excedente até este valor não é hora extra). */
  dailyToleranceMinutes: number;
  source: 'CONTRATO' | 'CCT' | 'EMPRESA';
  label: string;
}

export interface WorkTimeRules {
  night: NightWorkRule;
  /** null = sem política canônica → hora extra NÃO apurável. */
  overtime: OvertimePolicy | null;
}

/** Padrão inicial: trabalho noturno urbano 22:00–05:00, hora de 52min30s, 20%. */
export const DEFAULT_NIGHT_RULE: NightWorkRule = {
  startMinutes: 22 * 60,
  endMinutes: 5 * 60,
  reducedHourMs: 52 * MIN + 30 * 1000,
  additionalPercent: 20,
  source: 'PADRAO',
  label: 'Padrão urbano (CLT art. 73): 22h–5h, hora de 52min30s, 20%',
};

export const DEFAULT_WORK_TIME_RULES: WorkTimeRules = {
  night: DEFAULT_NIGHT_RULE,
  overtime: null,
};

/** Intervalo de trabalho efetivo [início, fim) em epoch ms. */
export interface WorkInterval { start: number; end: number }

const overlap = (a: WorkInterval, b: WorkInterval) => Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));

/** Janelas noturnas (em epoch ms, horário local) que podem tocar [from, to). */
function nightWindows(from: number, to: number, rule: NightWorkRule): WorkInterval[] {
  const wraps = rule.endMinutes <= rule.startMinutes;
  const first = new Date(from);
  const windows: WorkInterval[] = [];
  // Começa um dia antes: a janela iniciada ontem às 22h cobre a madrugada de hoje.
  for (let d = new Date(first.getFullYear(), first.getMonth(), first.getDate() - 1); d.getTime() < to; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
    const start = new Date(y, m, day, 0, rule.startMinutes).getTime();
    const end = new Date(y, m, day + (wraps ? 1 : 0), 0, rule.endMinutes).getTime();
    windows.push({ start, end });
  }
  return windows;
}

export interface NightWorkResult {
  /** Tempo REAL trabalhado dentro da janela noturna (pausas descontadas). */
  realMs: number;
  /** Horas noturnas COMPUTADAS pela hora reduzida (real × 60min / hora reduzida). */
  computedMs: number;
}

/**
 * Trabalho noturno de uma jornada a partir dos seus intervalos EFETIVOS de
 * trabalho (pausas já excluídas). Atravessa a meia-noite com timestamps
 * completos; a competência da jornada não interfere aqui.
 */
export function computeNightWork(intervals: WorkInterval[], rule: NightWorkRule = DEFAULT_NIGHT_RULE): NightWorkResult {
  let realMs = 0;
  for (const iv of intervals) {
    if (!(iv.end > iv.start)) continue;
    for (const w of nightWindows(iv.start, iv.end, rule)) realMs += overlap(iv, w);
  }
  const computedMs = Math.round(realMs * (60 * MIN) / rule.reducedHourMs);
  return { realMs, computedMs };
}

/**
 * Hora extra de uma jornada segundo a política. Sem política → null ("não
 * apurável"): o excedente permanece apenas como saldo positivo.
 */
export function computeOvertime(balanceMs: number | null, policy: OvertimePolicy | null): number | null {
  if (!policy || balanceMs == null) return null;
  if (policy.excessGoesTo !== 'HORA_EXTRA') return 0;
  return Math.max(0, balanceMs - policy.dailyToleranceMinutes * MIN);
}
