// Prévia de uma correção administrativa ANTES de gravar.
//
// A folha tem uma linha por JORNADA, e a jornada é montada pela ordem
// cronológica das batidas. Uma batida incluída/corrigida com um horário que
// cai fora da jornada clicada (ex.: Saída 17:02 numa jornada que termina antes
// de uma Entrada às 13:12) vai parar em OUTRA jornada — ou vira uma jornada
// "só-saída" = linha nova no mesmo dia. Esta prévia simula a correção com o
// MESMO motor (buildJourneys) e diz onde a batida vai cair.

import { buildJourneys, Journey } from './timecard';
import { TimePunch } from './types';

export type CorrectionAction = 'AJUSTE' | 'INCLUSAO' | 'DESCONSIDERAR';

export interface CorrectionDraftLike {
  action: CorrectionAction;
  type: TimePunch['type'];
  /** Batida alvo (AJUSTE/DESCONSIDERAR). */
  punch?: TimePunch;
  refDate: string; // YYYY-MM-DD
  time: string; // HH:MM
}

export interface CorrectionPreview {
  /** Jornada resultante que contém a batida corrigida/incluída (ou a âncora). */
  journey?: Journey;
  /** Jornadas do dia de competência antes × depois. */
  dayJourneysBefore: number;
  dayJourneysAfter: number;
  /** A batida nova/corrigida ficou FORA da jornada da linha clicada. */
  landsOutside: boolean;
  /** A correção cria jornada(s) a mais no dia (linhas novas na folha). */
  createsRows: boolean;
  /** Explicação objetiva para o gestor quando há problema. */
  warning?: string;
}

const PREVIEW_ID = '__preview__';
const pad2 = (n: number) => String(n).padStart(2, '0');
const hm = (at: number) => `${pad2(new Date(at).getHours())}:${pad2(new Date(at).getMinutes())}`;
const LABEL: Record<TimePunch['type'], string> = { ENTRADA: 'Entrada', PAUSA: 'Saída para almoço', RETORNO: 'Retorno', SAIDA: 'Saída' };

export const draftAt = (d: Pick<CorrectionDraftLike, 'refDate' | 'time'>): number | undefined => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.refDate) || !/^\d{2}:\d{2}$/.test(d.time)) return undefined;
  const v = new Date(`${d.refDate}T${d.time}:00`).getTime();
  return Number.isNaN(v) ? undefined : v;
};

/**
 * @param punches batidas EFETIVAS do funcionário (todas as conhecidas).
 * @param rowJourney jornada da linha clicada (undefined = dia sem registro).
 * @param competenceKey dia da linha.
 */
export function previewCorrection(
  punches: TimePunch[], rowJourney: Journey | undefined, competenceKey: string,
  draft: CorrectionDraftLike, nowMs: number,
): CorrectionPreview | null {
  const at = draft.action === 'DESCONSIDERAR' ? undefined : draftAt(draft);
  if (draft.action !== 'DESCONSIDERAR' && at == null) return null;

  const targetId = draft.punch?.id;
  let next: TimePunch[];
  let movedId: string | undefined;
  if (draft.action === 'DESCONSIDERAR') {
    next = punches.filter((p) => p.id !== targetId);
  } else if (draft.action === 'AJUSTE' && targetId) {
    next = punches.map((p) => (p.id === targetId ? { ...p, at } : p));
    movedId = targetId;
  } else {
    const owner = punches[0];
    next = [...punches, {
      id: PREVIEW_ID, userId: owner?.userId, employeeName: owner?.employeeName || '', timestamp: '',
      type: draft.type, locationStr: '', lat: 0, lng: 0, status: 'APROVADO', at,
    }];
    movedId = PREVIEW_ID;
  }

  const before = buildJourneys(punches, { nowMs }).filter((j) => j.competenceKey === competenceKey).length;
  const afterAll = buildJourneys(next, { nowMs });
  const after = afterAll.filter((j) => j.competenceKey === competenceKey).length;

  // Âncora: uma batida da linha que NÃO é o alvo — identifica "a mesma jornada".
  const anchor = rowJourney?.punches.find((p) => p.id !== targetId);
  const anchorJourney = anchor ? afterAll.find((j) => j.punches.some((p) => p.id === anchor.id)) : undefined;
  const movedJourney = movedId ? afterAll.find((j) => j.punches.some((p) => p.id === movedId)) : undefined;
  const journey = movedJourney ?? anchorJourney;

  const landsOutside = !!(movedId && anchorJourney && movedJourney && anchorJourney !== movedJourney);
  // DESCONSIDERAR nunca "cria" linha de forma problemática (só reorganiza o que existe).
  const createsRows = draft.action !== 'DESCONSIDERAR' && rowJourney != null && after > before;

  let warning: string | undefined;
  if ((landsOutside || createsRows) && at != null) {
    const sorted = (rowJourney?.punches ?? []).filter((p) => p.id !== targetId && p.at != null).sort((a, b) => a.at! - b.at!);
    const last = sorted[sorted.length - 1];
    // Próxima batida do funcionário DEPOIS da jornada clicada: é ela que "rouba" o horário.
    const blocker = last ? punches
      .filter((p) => p.at != null && p.at > last.at! && p.id !== targetId && !rowJourney?.punches.some((r) => r.id === p.id))
      .sort((a, b) => a.at! - b.at!)[0] : undefined;
    const label = `${LABEL[draft.type]} às ${hm(at)}`;
    if (blocker && at > blocker.at!) {
      warning = `${label} fica depois da ${LABEL[blocker.type]} das ${hm(blocker.at!)}, que já pertence a outra jornada. `
        + `Para esta linha, use um horário antes de ${hm(blocker.at!)} — ou corrija/desconsidere a ${LABEL[blocker.type]} das ${hm(blocker.at!)} primeiro.`;
    } else if (createsRows) {
      warning = `${label} criaria uma nova linha neste dia (a jornada já tem ${LABEL[draft.type].toLowerCase()} ou o horário não se encaixa na sequência). `
        + 'Confira o horário ou use "Corrigir horário" na batida existente.';
    } else {
      warning = `${label} não se encaixa nesta jornada — ficaria em outra linha da folha.`;
    }
  }
  return { journey, dayJourneysBefore: before, dayJourneysAfter: after, landsOutside, createsRows, warning };
}
