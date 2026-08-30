import { InventoryItem } from './types';

/* ===================================================================
 * ETAPA 5 — Status conceitual de Catálogo × Estoque.
 *
 * Regras (pura, testável):
 *  - SOMENTE_CATALOGO: produto sem controle físico (catalog_only ou
 *    stock_managed=false). NUNCA conta como crítico/esgotado.
 *  - SEM_ESTOQUE: controlado, saldo = 0.
 *  - CRITICO: controlado, 0 < saldo ≤ nível crítico.
 *  - ESTOQUE_BAIXO: controlado, nível crítico < saldo ≤ mínimo.
 *  - EM_ESTOQUE: controlado, saldo > mínimo.
 *
 * null ≠ zero: custo/preço/fornecedor ausentes são "Não cadastrado",
 * nunca R$ 0,00, e não entram no valor do estoque.
 * =================================================================== */

export type StockStatus = 'SOMENTE_CATALOGO' | 'SEM_ESTOQUE' | 'CRITICO' | 'ESTOQUE_BAIXO' | 'EM_ESTOQUE';

/** Produto com controle físico de estoque (não é somente-catálogo). */
export function isStockControlled(i: Pick<InventoryItem, 'catalogOnly' | 'stockManaged'>): boolean {
  return i.catalogOnly !== true && i.stockManaged !== false;
}

/** Nível crítico derivado do mínimo (sem coluna própria: metade do mínimo). */
export function criticalLevel(min: number): number {
  return min > 0 ? Math.ceil(min / 2) : 0;
}

export function stockStatus(i: Pick<InventoryItem, 'catalogOnly' | 'stockManaged' | 'quantity' | 'minQuantity'>): StockStatus {
  if (!isStockControlled(i)) return 'SOMENTE_CATALOGO';
  const q = Number(i.quantity || 0);
  const min = Number(i.minQuantity || 0);
  if (q <= 0) return 'SEM_ESTOQUE';
  const crit = criticalLevel(min);
  if (crit > 0 && q <= crit) return 'CRITICO';
  if (min > 0 && q <= min) return 'ESTOQUE_BAIXO';
  return 'EM_ESTOQUE';
}

export const STOCK_STATUS_META: Record<StockStatus, { label: string; tone: 'slate' | 'red' | 'amber' | 'emerald' | 'sky' }> = {
  SOMENTE_CATALOGO: { label: 'Somente catálogo', tone: 'slate' },
  SEM_ESTOQUE: { label: 'Sem estoque', tone: 'red' },
  CRITICO: { label: 'Crítico', tone: 'red' },
  ESTOQUE_BAIXO: { label: 'Estoque baixo', tone: 'amber' },
  EM_ESTOQUE: { label: 'Em estoque', tone: 'emerald' },
};

/** Cadastro pendente de validação (criado em campo / provisório / A_VALIDAR). */
export function isPendenteValidacao(i: Pick<InventoryItem, 'catalogStatus' | 'pendenteValidacao' | 'code'>): boolean {
  return i.catalogStatus === 'A_VALIDAR' || i.pendenteValidacao === true || (i.code || '').toUpperCase().startsWith('PROV-');
}

export interface StockIndicators {
  catalogo: number;      // produtos no catálogo (total)
  comSaldo: number;      // produtos com saldo físico > 0
  unidades: number;      // unidades físicas em estoque
  estoqueBaixo: number;  // itens em ESTOQUE_BAIXO
  critico: number;       // itens em CRITICO
  semEstoque: number;    // controlados com saldo 0
  pendentes: number;     // cadastros a validar
  valor: number;         // Σ (unidades × custo CONHECIDO). Custo null não entra.
}

export function stockIndicators(items: InventoryItem[]): StockIndicators {
  const ind: StockIndicators = { catalogo: items.length, comSaldo: 0, unidades: 0, estoqueBaixo: 0, critico: 0, semEstoque: 0, pendentes: 0, valor: 0 };
  for (const i of items) {
    const q = Number(i.quantity || 0);
    if (q > 0) ind.comSaldo += 1;
    ind.unidades += Math.max(0, q);
    const st = stockStatus(i);
    if (st === 'ESTOQUE_BAIXO') ind.estoqueBaixo += 1;
    else if (st === 'CRITICO') ind.critico += 1;
    else if (st === 'SEM_ESTOQUE') ind.semEstoque += 1;
    if (isPendenteValidacao(i)) ind.pendentes += 1;
    // Valor: só unidades físicas × custo conhecido (null não vira R$0).
    if (i.costPrice != null && q > 0) ind.valor += q * Number(i.costPrice);
  }
  return ind;
}

/** Rótulo null-safe: valor ausente → "Não cadastrado" (nunca R$ 0,00 artificial). */
export function moneyOrNull(v: number | null | undefined): string {
  return v == null ? 'Não cadastrado' : `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}
export function textOrNull(v: string | null | undefined): string {
  return v && v.trim() ? v : 'Não cadastrado';
}

/** Normaliza código/part-number p/ busca: FSP-951 ~ FSP951 ~ fsp 951. */
export function normalizeSearch(v: string | undefined): string {
  return (v || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}
