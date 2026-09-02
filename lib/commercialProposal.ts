/* =====================================================================
 * Normalização do snapshot comercial (CommercialProposalData).
 *
 * FONTE ÚNICA de forma: editor, persistência e PDF consomem o objeto já
 * normalizado por aqui. Aceita tanto o formato v1 (garantia string, sem
 * override explícito) quanto o v2 (garantia estruturada + valorTotalManual).
 *
 * Backward-compatible: NÃO reescreve documentos antigos no banco — apenas
 * produz uma forma consistente em runtime. A gravação em v2 acontece quando o
 * usuário salva (o editor define schemaVersion = 2).
 *
 * Módulo PURO e testável isoladamente.
 * ===================================================================== */

import { CommercialProposalData } from './types';
import { CommercialWarranty, normalizeCommercialWarranty } from './commercialWarranty';
import { calculateCommercialProposalTotals, roundMoney } from './commercialTotals';

/** Versão corrente do schema comercial. */
export const COMMERCIAL_SCHEMA_VERSION = 2;

export interface NormalizedCommercialProposal extends CommercialProposalData {
  schemaVersion: number;
  warranty: CommercialWarranty;
  valorTotalManual: number | null;
}

/**
 * Normaliza um `proposal` (v1 ou v2) para a forma corrente.
 *
 * Garantia: usa `warranty` quando presente; senão deriva de `garantia` (string)
 * em modo legado — sem reinterpretar o texto.
 *
 * Total: se não houver override explícito (`valorTotalManual`) mas o total
 * gravado divergir do calculado dos itens, INFERE que houve override manual e
 * o recupera — corrige o bug histórico de perder o override ao reabrir, sem
 * inventar valores (só age quando há divergência real).
 */
export function normalizeCommercialProposalData(raw: CommercialProposalData): NormalizedCommercialProposal {
  const warranty = raw.warranty
    ? normalizeCommercialWarranty(raw.warranty)
    : normalizeCommercialWarranty(raw.garantia);

  const explicitOverride =
    raw.valorTotalManual != null && Number.isFinite(Number(raw.valorTotalManual))
      ? roundMoney(Number(raw.valorTotalManual))
      : null;

  // Total calculado a partir dos itens + mão de obra (sem override).
  const base = calculateCommercialProposalTotals({
    equipmentItems: raw.equipmentItems,
    maoDeObra: raw.maoDeObra,
    valorTotalManual: null,
  });

  const storedTotal = Number(raw.valorTotal) || 0;
  let valorTotalManual = explicitOverride;
  if (valorTotalManual == null && storedTotal > 0 && Math.abs(storedTotal - base.calculatedTotal) > 0.01) {
    // v1 sem flag, mas total gravado ≠ calculado → override histórico recuperado.
    valorTotalManual = roundMoney(storedTotal);
  }

  const finalTotal = valorTotalManual != null ? valorTotalManual : base.calculatedTotal;

  return {
    ...raw,
    schemaVersion: raw.schemaVersion || 1,
    warranty,
    valorTotalManual,
    // Mantém o total comercial final coerente com a decisão acima.
    valorTotal: raw.recorrente ? storedTotal : finalTotal,
  };
}
