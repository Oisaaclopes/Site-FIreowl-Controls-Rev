import { moneyOrDash, percentOrDash } from './productPricing';

// =====================================================================
// MOTOR DE FORMAÇÃO DE PREÇO (fonte única, testável).
//
// O custo é a BASE. O usuário escolhe UMA variável comercial principal
// (preço de venda, margem, markup OU lucro) e o motor calcula as demais —
// evitando cinco campos editáveis simultâneos e conflitantes.
//
// Definições (nunca "acréscimo simples" sobre o custo):
//   Lucro  = preço − custo
//   Margem = ((preço − custo) / preço) × 100        (sobre a VENDA)
//   Markup = preço / custo                          (razão)
//
// Fórmulas por modo (C = custo):
//   PRICE  : preço = V
//   MARGIN : preço = C / (1 − M/100)                (M em %, 0 ≤ M < 100)
//   MARKUP : preço = C × K                          (K > 0)
//   PROFIT : preço = C + L
//
// Null-safe: custo ausente ou entrada inválida → derivados null (UI mostra
// "—"); custo 0 nunca gera NaN/Infinity (markup/margem que dividiriam por
// zero viram null). Precisão preservada internamente; arredondamento só na
// borda (dinheiro/margem 2 casas, markup até 4).
// =====================================================================

export type PricingMode = 'PRICE' | 'MARGIN' | 'MARKUP' | 'PROFIT';

export const PRICING_MODES: { mode: PricingMode; label: string; fieldLabel: string; suffix: string }[] = [
  { mode: 'PRICE', label: 'Preço de venda', fieldLabel: 'Preço de venda (R$)', suffix: 'R$' },
  { mode: 'MARGIN', label: 'Margem', fieldLabel: 'Margem desejada (%)', suffix: '%' },
  { mode: 'MARKUP', label: 'Markup', fieldLabel: 'Markup (×)', suffix: '×' },
  { mode: 'PROFIT', label: 'Lucro', fieldLabel: 'Lucro unitário (R$)', suffix: 'R$' },
];

export function isPricingMode(v: unknown): v is PricingMode {
  return v === 'PRICE' || v === 'MARGIN' || v === 'MARKUP' || v === 'PROFIT';
}

const round = (n: number, d: number): number => {
  const f = 10 ** d;
  return Math.round((n + Number.EPSILON) * f) / f;
};
const r2 = (n: number) => round(n, 2);
const r4 = (n: number) => round(n, 4);

const finite = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);

export interface PricingResult {
  cost: number | null;
  price: number | null;
  profit: number | null;
  margin: number | null; // percentual
  markup: number | null; // razão
  /** Mensagem de validação da variável principal (impede salvar). */
  error?: string;
}

/** Deriva o pacote completo a partir de custo + preço já calculado. */
function finalize(cost: number, price: number, error?: string): PricingResult {
  const p = r2(price);
  return {
    cost,
    price: p,
    profit: r2(p - cost),
    margin: p > 0 ? r2(((p - cost) / p) * 100) : null,
    markup: cost > 0 ? r4(p / cost) : null,
    error,
  };
}

/**
 * Calcula preço/lucro/margem/markup a partir do custo e da variável principal
 * do modo escolhido. `value` é o valor da variável principal (preço, margem %,
 * markup ×, ou lucro). Entrada inválida → derivados null; custo é a base e
 * nunca é recalculado a partir da venda.
 */
export function computePricing(
  cost: number | null | undefined,
  mode: PricingMode,
  value: number | null | undefined,
): PricingResult {
  const C = finite(cost) && cost >= 0 ? cost : null;
  const empty: PricingResult = { cost: C, price: null, profit: null, margin: null, markup: null };
  if (C == null) return empty; // custo é obrigatório para formar preço

  switch (mode) {
    case 'PRICE': {
      if (!finite(value) || value < 0) return empty;
      return finalize(C, value);
    }
    case 'MARGIN': {
      if (!finite(value)) return empty;
      if (value < 0 || value >= 100) return { ...empty, error: 'Margem deve ser ≥ 0% e < 100%.' };
      return finalize(C, C / (1 - value / 100));
    }
    case 'MARKUP': {
      if (!finite(value)) return empty;
      if (value <= 0) return { ...empty, error: 'Markup deve ser maior que zero.' };
      return finalize(C, C * value);
    }
    case 'PROFIT': {
      if (!finite(value)) return empty;
      return finalize(C, C + value);
    }
    default:
      return empty;
  }
}

/** Valor da variável principal de um modo, a partir de um resultado pronto. */
export function principalValue(mode: PricingMode, r: PricingResult): number | null {
  switch (mode) {
    case 'PRICE': return r.price;
    case 'MARGIN': return r.margin;
    case 'MARKUP': return r.markup;
    case 'PROFIT': return r.profit;
    default: return null;
  }
}

/** Formata markup com até 4 casas, sem zeros à direita. Ex.: 1,6667× / 1,5× / 2×. */
export function markupOrDash(v: number | null | undefined): string {
  return finite(v)
    ? `${r4(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}×`
    : '—';
}

// Reexporta os formatadores monetário/percentual (fonte única de UI).
export { moneyOrDash, percentOrDash };
