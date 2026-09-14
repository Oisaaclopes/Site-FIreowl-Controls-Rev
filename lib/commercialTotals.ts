/* =====================================================================
 * Formação de preço da proposta — FONTE ÚNICA de cálculo.
 *
 * Editor e PDF DEVEM usar esta função. Nunca recalcular por conta própria
 * com reduce solto. Distingue explicitamente TOTAL CALCULADO e TOTAL COMERCIAL
 * FINAL (override manual persistido).
 *
 * Módulo PURO e testável isoladamente.
 * ===================================================================== */

import { PedidoEquipmentItem, FreteInfo, ImpostosAdicionaisInfo } from './types';

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

/** Valor monetário do frete que ENTRA no total (só quando modo = 'valor'). */
export function freteValor(frete?: FreteInfo): number {
  if (!frete || frete.modo !== 'valor') return 0;
  return roundMoney(Math.max(0, Number(frete.valor) || 0));
}

/** Valor monetário dos impostos adicionais que ENTRA no total (modo = 'valor'). */
export function impostosAdicionaisValor(imp?: ImpostosAdicionaisInfo): number {
  if (!imp || imp.modo !== 'valor') return 0;
  return roundMoney(Math.max(0, Number(imp.valor) || 0));
}

export interface CommercialTotalsInput {
  equipmentItems?: PedidoEquipmentItem[];
  /** Mão de obra avulsa (linha "Serviços/Mão de obra" fora dos itens). */
  maoDeObra?: number;
  /** Override manual do total comercial. null/undefined = usar o calculado. */
  valorTotalManual?: number | null;
  /** SOMENTE MATERIAL — frete (só 'valor' soma). */
  frete?: FreteInfo;
  /** SOMENTE MATERIAL — impostos adicionais (só 'valor' soma). */
  impostosAdicionais?: ImpostosAdicionaisInfo;
  /**
   * SOMENTE MATERIAL — considera apenas os itens do tipo material e ignora a
   * mão de obra. Serviços eventualmente cadastrados ficam PRESERVADOS no
   * pedido, mas não entram no cálculo enquanto a modalidade é material-only.
   */
  onlyMaterials?: boolean;
}

export interface CommercialTotals {
  materialsSubtotal: number;
  servicesSubtotal: number;
  itemsSubtotal: number;
  maoDeObra: number;
  discountTotal: number;
  /** Frete somado ao total (0 quando incluso/não incluso/a combinar). */
  freteTotal: number;
  /** Impostos adicionais somados ao total (0 quando inclusos/não inclusos). */
  impostosTotal: number;
  /** Total derivado dos itens + mão de obra + frete + impostos. */
  calculatedTotal: number;
  /** Override manual, se houver (senão null). */
  manualOverride: number | null;
  /** Verdade comercial: override quando informado, senão o calculado. */
  finalTotal: number;
}

/** Calcula todos os totais comerciais a partir do estado persistido/editado. */
export function calculateCommercialProposalTotals(input: CommercialTotalsInput): CommercialTotals {
  const itens = input.equipmentItems || [];
  const onlyMaterials = !!input.onlyMaterials;
  let materialsSubtotal = 0;
  let servicesSubtotal = 0;
  let discountTotal = 0;
  for (const it of itens) {
    const isServico = it.tipo === 'servico';
    const total = lineTotal(it);
    if (isServico) servicesSubtotal += total;
    else materialsSubtotal += total;
    // Em material-only o desconto de serviços não conta (serviços saem do total).
    if (!onlyMaterials || !isServico) discountTotal += Number(it.desconto) || 0;
  }
  materialsSubtotal = roundMoney(materialsSubtotal);
  servicesSubtotal = roundMoney(servicesSubtotal);
  discountTotal = roundMoney(discountTotal);
  const itemsSubtotal = onlyMaterials ? materialsSubtotal : roundMoney(materialsSubtotal + servicesSubtotal);
  // Mão de obra é um conceito de serviço: em material-only não soma.
  const maoDeObra = onlyMaterials ? 0 : roundMoney(Number(input.maoDeObra) || 0);
  const freteTotal = freteValor(input.frete);
  const impostosTotal = impostosAdicionaisValor(input.impostosAdicionais);
  const calculatedTotal = roundMoney(itemsSubtotal + maoDeObra + freteTotal + impostosTotal);

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
    freteTotal,
    impostosTotal,
    calculatedTotal,
    manualOverride,
    finalTotal,
  };
}
