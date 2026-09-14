/* =====================================================================
 * Modalidade SOMENTE MATERIAL — rótulos e textos comerciais.
 *
 * FONTE ÚNICA de nomenclatura/frases para editor e PDF (evita divergência
 * entre o que o usuário vê no formulário e o que sai no documento).
 * Módulo PURO. Ver [[commercialTotals]] e [[FornecimentoMateriaisDocument]].
 * ===================================================================== */

import { FreteInfo, ImpostosAdicionaisInfo, ModalidadeComercial } from './types';

/** Formatação monetária pt-BR (R$ 0,00). Local para não acoplar ao pdfKit. */
function brlSimples(n: number): string {
  return `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

export const MODALIDADE_LABELS: Record<ModalidadeComercial, string> = {
  servico: 'Serviço',
  material_servico: 'Material + Serviço',
  somente_material: 'Somente Material',
};

export const MODALIDADE_ORDER: ModalidadeComercial[] = ['servico', 'material_servico', 'somente_material'];

/** Modalidade efetiva de um proposal (ausente = Material + Serviço histórico). */
export function modalidadeEfetiva(modalidade?: ModalidadeComercial): ModalidadeComercial {
  return modalidade || 'material_servico';
}

export function isSomenteMaterial(modalidade?: ModalidadeComercial): boolean {
  return modalidade === 'somente_material';
}

export const FRETE_MODO_LABELS: Record<FreteInfo['modo'], string> = {
  incluso: 'Incluso',
  nao_incluso: 'Não incluso',
  a_combinar: 'A combinar',
  valor: 'Valor definido',
};

export const IMPOSTO_MODO_LABELS: Record<ImpostosAdicionaisInfo['modo'], string> = {
  inclusos: 'Inclusos',
  nao_inclusos: 'Não inclusos',
  valor: 'Valor adicional',
};

/** Frase do frete para as Condições Comerciais (ou null quando entra no resumo). */
export function freteCondicaoTexto(frete?: FreteInfo): string | null {
  if (!frete) return null;
  switch (frete.modo) {
    case 'incluso':
      return 'Frete incluso no valor dos produtos.';
    case 'nao_incluso':
      return 'Frete não incluso — por conta do cliente.';
    case 'a_combinar':
      return 'Frete a combinar.';
    case 'valor':
      return `Frete: ${brlSimples(Math.max(0, Number(frete.valor) || 0))}.`;
    default:
      return null;
  }
}

/** Frase dos impostos adicionais para as Condições Comerciais. */
export function impostosCondicaoTexto(imp?: ImpostosAdicionaisInfo): string | null {
  if (!imp) return null;
  switch (imp.modo) {
    case 'inclusos':
      return 'Impostos inclusos no valor apresentado.';
    case 'nao_inclusos':
      return 'Impostos não inclusos.';
    case 'valor':
      return `Impostos adicionais: ${brlSimples(Math.max(0, Number(imp.valor) || 0))}.`;
    default:
      return null;
  }
}

/**
 * Aviso comercial curto e discreto: o fornecimento não inclui execução. Vai nas
 * Condições Comerciais / Observações (não é uma seção técnica de "Não incluso").
 */
export const AVISO_SEM_INSTALACAO =
  'O presente orçamento contempla exclusivamente o fornecimento dos materiais relacionados, não incluindo instalação, programação, comissionamento ou serviços técnicos, salvo quando expressamente indicado.';

/** Observação de disponibilidade (opcional; usada como placeholder/sugestão). */
export const OBS_DISPONIBILIDADE =
  'Disponibilidade sujeita à confirmação no momento da aprovação do pedido.';
