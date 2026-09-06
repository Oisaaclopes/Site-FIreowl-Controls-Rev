/* ===================================================================
 * MANUTENÇÃO CONTRATUAL (migration 0106) — resolução da POLÍTICA EFETIVA e
 * aritmética de periodicidade. PURO e testável; SEM I/O, SEM RPC — funciona
 * offline sobre políticas já sincronizadas (lib camada de dados as carrega).
 *
 * Precedência (mais específico vence): ATIVO > CONTRATO > CLIENTE > PADRAO.
 * Dentro do mesmo escopo, mais filtros de classificação casados vencem
 * (tipo_ativo > grupo > area). Como o salto de escopo (1000) supera o bônus
 * máximo de classificação (600), o escopo SEMPRE domina — a precedência pedida
 * é matematicamente garantida. NÃO duplica a Base: filtros usam devices.sistema
 * (area), devices.grupo e devices.tipo_ativo.
 * =================================================================== */
import type {
  AssetMaintenancePolicy,
  Device,
  EffectiveMaintenancePolicy,
  MaintenanceAssetStatus,
  MaintenancePeriodicityUnit,
} from './types';

/** Peso base por escopo. O gap de 1000 > bônus máximo (600) garante precedência. */
const SCOPE_WEIGHT = { ATIVO: 4000, CONTRATO: 3000, CLIENTE: 2000, PADRAO: 1000 } as const;
/** Bônus por filtro de classificação casado (só conta quando o filtro é não-nulo). */
const CLASS_BONUS = { tipoAtivo: 300, grupo: 200, area: 100 } as const;

/** Contexto do ativo para casar políticas (deriva de devices — Base canônica). */
export interface AssetPolicyContext {
  deviceId: string;
  clienteId?: string;
  area?: string;       // devices.sistema
  grupo?: string;      // devices.grupo
  tipoAtivo?: string;  // devices.tipo_ativo
}

/** Extrai o contexto de um Device (não cria estrutura paralela). */
export function assetContextFromDevice(d: Device): AssetPolicyContext {
  return {
    deviceId: d.id,
    clienteId: d.clienteId,
    area: d.sistema,
    grupo: d.grupo,
    tipoAtivo: d.tipoAtivo,
  };
}

/**
 * Uma política CASA o ativo/contexto quando TODO seletor não-nulo bate
 * (null = curinga). Política inativa nunca casa. `contractId` do contexto é
 * exigido só quando a política tem contract_id.
 */
export function policyMatches(
  policy: AssetMaintenancePolicy,
  ctx: AssetPolicyContext,
  contractId: string | null | undefined
): boolean {
  if (policy.ativa === false) return false;
  if (policy.deviceId != null && policy.deviceId !== ctx.deviceId) return false;
  if (policy.contractId != null && policy.contractId !== (contractId ?? undefined)) return false;
  if (policy.clienteId != null && policy.clienteId !== ctx.clienteId) return false;
  if (policy.area != null && policy.area !== ctx.area) return false;
  if (policy.grupo != null && policy.grupo !== ctx.grupo) return false;
  if (policy.tipoAtivo != null && policy.tipoAtivo !== ctx.tipoAtivo) return false;
  return true;
}

/** Especificidade da política = peso do escopo + bônus dos filtros casados. */
export function policySpecificity(policy: AssetMaintenancePolicy): number {
  let score = SCOPE_WEIGHT[policy.escopo] ?? 0;
  if (policy.tipoAtivo != null) score += CLASS_BONUS.tipoAtivo;
  if (policy.grupo != null) score += CLASS_BONUS.grupo;
  if (policy.area != null) score += CLASS_BONUS.area;
  return score;
}

/**
 * Resolve a política EFETIVA de um ativo. Retorna a de MAIOR especificidade que
 * casa; empate (teoricamente impedido pelo partial-unique da 0106) é resolvido
 * de forma determinística por updated_at desc e, por fim, id asc. Sem match →
 * null (SEM_POLITICA; nunca inventa periodicidade normativa).
 */
export function resolveEffectivePolicy(
  ctx: AssetPolicyContext,
  contractId: string | null | undefined,
  policies: AssetMaintenancePolicy[]
): EffectiveMaintenancePolicy | null {
  let best: AssetMaintenancePolicy | null = null;
  let bestScore = -1;
  for (const p of policies) {
    if (!policyMatches(p, ctx, contractId)) continue;
    const score = policySpecificity(p);
    if (score > bestScore) {
      best = p; bestScore = score;
    } else if (score === bestScore && best) {
      // desempate determinístico: updated_at mais recente, depois id menor.
      const a = p.updatedAt ?? '';
      const b = best.updatedAt ?? '';
      if (a > b || (a === b && p.id < best.id)) best = p;
    }
  }
  if (!best) return null;
  return {
    periodicidadeValor: best.periodicidadeValor,
    periodicidadeUnidade: best.periodicidadeUnidade,
    obrigatorioNoCiclo: best.obrigatorioNoCiclo ?? false,
    janelaToleranciaDias: best.janelaToleranciaDias ?? 0,
    policyId: best.id,
    escopo: best.escopo,
    especificidade: bestScore,
  };
}

/* ------------------------- Aritmética de datas (UTC, determinística) -------- */

/** Parse 'YYYY-MM-DD' (ou ISO) para uma data-âncora em UTC (meia-noite). */
export function parseDateUTC(value: string): Date {
  const s = String(value).slice(0, 10);
  const [y, m, d] = s.split('-').map((n) => parseInt(n, 10));
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

/** Formata uma data UTC como 'YYYY-MM-DD'. */
export function formatDateUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Último dia do mês (ano/mês em UTC). */
function lastDayOfMonth(year: number, monthIdx: number): number {
  return new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
}

/**
 * Soma `months` meses de CALENDÁRIO, com CLAMP determinístico de fim de mês:
 * 31/01 + 1 mês = 28/02 (ou 29/02 em ano bissexto). Nunca "transborda" para o
 * mês seguinte. ANO reusa esta função (anos = meses*12), então 29/02 + 1 ano
 * = 28/02 do ano seguinte de forma determinística.
 */
export function addMonthsCalendar(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const day = date.getUTCDate();
  const total = m + months;
  const ty = y + Math.floor(total / 12);
  const tm = ((total % 12) + 12) % 12;
  const clampedDay = Math.min(day, lastDayOfMonth(ty, tm));
  return new Date(Date.UTC(ty, tm, clampedDay));
}

/**
 * Aplica a periodicidade a uma data-âncora. DIA/SEMANA = duração fixa;
 * MES/ANO = aritmética de calendário (add_months com clamp de fim de mês).
 */
export function addPeriodicity(anchor: Date, valor: number, unidade: MaintenancePeriodicityUnit): Date {
  switch (unidade) {
    case 'DIA':
      return new Date(anchor.getTime() + valor * 86400000);
    case 'SEMANA':
      return new Date(anchor.getTime() + valor * 7 * 86400000);
    case 'MES':
      return addMonthsCalendar(anchor, valor);
    case 'ANO':
      return addMonthsCalendar(anchor, valor * 12);
    default:
      return anchor;
  }
}

/** Diferença em dias inteiros (b - a), truncada. Positivo = b no futuro de a. */
export function diffDays(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

/** Próxima manutenção a partir do último teste (string) e da política efetiva. */
export function nextMaintenanceDate(
  lastTest: string,
  policy: Pick<EffectiveMaintenancePolicy, 'periodicidadeValor' | 'periodicidadeUnidade'>
): string {
  const next = addPeriodicity(parseDateUTC(lastTest), policy.periodicidadeValor, policy.periodicidadeUnidade);
  return formatDateUTC(next);
}

/** Janela (em dias) em que um ativo é considerado "PROXIMO" antes do vencimento. */
export const DEFAULT_PROXIMO_WINDOW_DAYS = 30;

/**
 * Classifica o status de manutenção na data de referência.
 * - VENCIDO: passou do vencimento + carência (janela_tolerancia_dias).
 * - PROXIMO: dentro de [vencimento - janela, vencimento + carência].
 * - EM_DIA: ainda antes da janela de aproximação.
 * Sem próximo teste (ativo nunca testado, mas com política) → VENCIDO (a fazer).
 */
export function maintenanceStatus(
  nextTest: string | undefined,
  referenceDate: string,
  toleranceDays = 0,
  proximoWindowDays = DEFAULT_PROXIMO_WINDOW_DAYS
): MaintenanceAssetStatus {
  if (!nextTest) return 'VENCIDO';
  const ref = parseDateUTC(referenceDate);
  const due = parseDateUTC(nextTest);
  const daysToDue = diffDays(ref, due); // >0 futuro, <0 vencido
  if (daysToDue < -toleranceDays) return 'VENCIDO';
  if (daysToDue <= proximoWindowDays) return 'PROXIMO';
  return 'EM_DIA';
}
