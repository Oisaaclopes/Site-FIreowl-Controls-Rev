import type { InventoryItem } from './types';

// =====================================================================
// Cálculos comerciais do produto (fonte única, testável). NÃO armazena
// derivados: calcula a partir de custo (cost_price) e preço de venda
// (sale_price, com fallback unit_price). Null-safe: nunca Infinity/NaN.
//
// Fórmulas (spec Passada 3.1):
//   Lucro  = preço − custo
//   Markup = preço / custo            (razão)
//   Margem = ((preço − custo) / preço) × 100
//
// Valor "não informado" = null OU ≤ 0. Nesses casos os derivados são null
// (a UI mostra "—"), nunca R$ 0,00 artificial nem divisão por zero.
// =====================================================================

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Valor comercial informado = número finito e > 0. */
export function isInformed(v: number | null | undefined): v is number {
  return v != null && Number.isFinite(v) && v > 0;
}

/** Preço de venda efetivo do item (sale_price, senão unit_price). */
export function effectivePrice(item: Pick<InventoryItem, 'salePrice' | 'unitPrice'>): number | null {
  const p = item.salePrice ?? item.unitPrice ?? null;
  return isInformed(p) ? p : null;
}

export function calculateProfit(cost: number | null | undefined, price: number | null | undefined): number | null {
  if (!isInformed(cost) || !isInformed(price)) return null;
  return round2(price - cost);
}

export function calculateMarkup(cost: number | null | undefined, price: number | null | undefined): number | null {
  if (!isInformed(cost) || !isInformed(price)) return null;
  return round2(price / cost);
}

export function calculateMargin(cost: number | null | undefined, price: number | null | undefined): number | null {
  if (!isInformed(cost) || !isInformed(price)) return null;
  return round2(((price - cost) / price) * 100);
}

export interface ProductPricing {
  cost: number | null;
  price: number | null;
  profit: number | null;
  markup: number | null;
  margin: number | null;
}

/** Pacote comercial completo de um item (para cards e detalhe). */
export function productPricing(item: Pick<InventoryItem, 'costPrice' | 'salePrice' | 'unitPrice'>): ProductPricing {
  const cost = isInformed(item.costPrice) ? item.costPrice! : null;
  const price = effectivePrice(item);
  return {
    cost,
    price,
    profit: calculateProfit(cost, price),
    markup: calculateMarkup(cost, price),
    margin: calculateMargin(cost, price),
  };
}

/** Formata moeda ou "—" (nunca R$ 0,00 para valor ausente). */
export function moneyOrDash(v: number | null | undefined): string {
  return isInformed(v) ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';
}

/** Formata percentual ou "—". */
export function percentOrDash(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? '—' : `${round2(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;
}

/** Formata razão (markup) ou "—". Ex.: 2.5 → "2,5×". */
export function ratioOrDash(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? '—' : `${round2(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}×`;
}
