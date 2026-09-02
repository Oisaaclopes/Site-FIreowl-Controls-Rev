/* =====================================================================
 * Formação de preço da proposta — FONTE ÚNICA de cálculo.
 *
 * Editor e PDF DEVEM usar esta função. Nunca recalcular por conta própria
 * com reduce solto. Distingue explicitamente TOTAL CALCULADO e TOTAL COMERCIAL
 * FINAL (override manual persistido).
 *
 * Módulo PURO e testável isoladamente.
 * ===================================================================== */

import { PedidoEquipmentItem } from './types';

/** Arredondamento monetário central (2 casas, à prova de ponto flutuante). */
export function roundMoney(n: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/** Total de uma linha: preço × quantidade − desconto (nunca negativo). */
export function lineTotal(it: { precoUnitario?: number; quantidade?: number; desconto?: number }): number {
  const bruto = (Number(it.precoUnitario) || 0) * (Number(it.quantidade) || 0) - (Number(it.desconto) || 0);
  return roundMoney(Math.max(0, bruto));
}

export interface CommercialTotalsInput {
  equipmentItems?: PedidoEquipmentItem[];
  /** Mão de obra avulsa (linha "Serviços/Mão de obra" fora dos itens). */
  maoDeObra?: number;
  /** Override manual do total comercial. null/undefined = usar o calculado. */
  valorTotalManual?: number | null;
}

export interface CommercialTotals {
  materialsSubtotal: number;
  servicesSubtotal: number;
  itemsSubtotal: number;
  maoDeObra: number;
  discountTotal: number;
  /** Total derivado dos itens + mão de obra. */
  calculatedTotal: number;
  /** Override manual, se houver (senão null). */
  manualOverride: number | null;
  /** Verdade comercial: override quando informado, senão o calculado. */
  finalTotal: number;
}

/** Calcula todos os totais comerciais a partir do estado persistido/editado. */
export function calculateCommercialProposalTotals(input: CommercialTotalsInput): CommercialTotals {
  const itens = input.equipmentItems || [];
  let materialsSubtotal = 0;
  let servicesSubtotal = 0;
  let discountTotal = 0;
  for (const it of itens) {
    const total = lineTotal(it);
    if (it.tipo === 'servico') servicesSubtotal += total;
    else materialsSubtotal += total;
    discountTotal += Number(it.desconto) || 0;
  }
  materialsSubtotal = roundMoney(materialsSubtotal);
  servicesSubtotal = roundMoney(servicesSubtotal);
  discountTotal = roundMoney(discountTotal);
  const itemsSubtotal = roundMoney(materialsSubtotal + servicesSubtotal);
  const maoDeObra = roundMoney(Number(input.maoDeObra) || 0);
  const calculatedTotal = roundMoney(itemsSubtotal + maoDeObra);

  const rawOverride = input.valorTotalManual;
  const manualOverride =
    rawOverride != null && Number.isFinite(Number(rawOverride)) ? roundMoney(Number(rawOverride)) : null;

  const finalTotal = manualOverride != null ? manualOverride : calculatedTotal;

  return {
    materialsSubtotal,
    servicesSubtotal,
    itemsSubtotal,
    maoDeObra,
    discountTotal,
    calculatedTotal,
    manualOverride,
    finalTotal,
  };
}
