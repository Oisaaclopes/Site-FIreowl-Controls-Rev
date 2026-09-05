/* ===================================================================
 * CORREÇÃO — Custo real no recebimento (rateio de frete/outros + custo médio).
 * Helpers PUROS e auditáveis (sem I/O). Precisão monetária em 2 casas para
 * valores rateados; custo médio em 4 casas para não acumular erro no estoque.
 * =================================================================== */

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const round4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;

/**
 * Rateia um custo total (frete/outros) proporcionalmente ao VALOR de cada item
 * (§5). Quando a soma dos valores é 0, divide igualmente. O resto de
 * arredondamento em centavos vai para o último item (soma bate exatamente).
 */
export function allocateProportional(values: number[], total: number): number[] {
  const n = values.length;
  if (n === 0) return [];
  const t = round2(total || 0);
  if (t <= 0) return values.map(() => 0);
  const sum = values.reduce((a, b) => a + (b > 0 ? b : 0), 0);
  const out: number[] = [];
  if (sum <= 0) {
    const each = round2(t / n);
    for (let i = 0; i < n; i++) out.push(each);
  } else {
    for (let i = 0; i < n; i++) out.push(round2((t * Math.max(0, values[i])) / sum));
  }
  // ajuste de resto no último item não-zero
  const diff = round2(t - out.reduce((a, b) => a + b, 0));
  if (diff !== 0) {
    for (let i = n - 1; i >= 0; i--) { if (out[i] > 0 || sum <= 0) { out[i] = round2(out[i] + diff); break; } }
  }
  return out;
}

/**
 * Custo unitário FINAL da entrada = mercadoria + rateio por unidade (§8).
 * `freightAlloc`/`otherAlloc` são valores MONETÁRIOS totais do item; divididos
 * pela quantidade aceita para virar custo por unidade.
 */
export function finalUnitCost(unitCost: number, freightAlloc: number, otherAlloc: number, acceptedQty: number): number {
  const qty = acceptedQty > 0 ? acceptedQty : 1;
  return round4((unitCost || 0) + (freightAlloc || 0) / qty + (otherAlloc || 0) / qty);
}

/**
 * Custo médio ponderado (§11). Se não há saldo anterior (ou custo anterior
 * desconhecido), o custo passa a ser o da entrada. Nunca "substitui o custo de
 * todo o estoque pela última compra" quando já existe saldo.
 */
export function weightedAverageCost(prevQty: number, prevCost: number | null | undefined, addQty: number, addUnitCost: number): number {
  const pq = prevQty > 0 ? prevQty : 0;
  const aq = addQty > 0 ? addQty : 0;
  if (pq > 0 && prevCost != null && aq > 0) {
    return round4((pq * prevCost + aq * addUnitCost) / (pq + aq));
  }
  return round4(aq > 0 ? addUnitCost : (prevCost ?? 0));
}
