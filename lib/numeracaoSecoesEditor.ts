import { normalizarSecoes, ordenarSecoes } from './documentoSecoes';

/**
 * Numeração dos cards de seção no editor de pedidos: cada seção LIGADA recebe a
 * sua posição na sequência do documento (01, 02, 03…), na ordem do editor
 * (Carta no início, Aceite no fim, miolo conforme as setas ▲▼). Mover um card
 * muda o número; desligar tira o número e renumera as seguintes.
 *
 * Materiais e Serviços compartilham o número: saem juntos na seção "itens".
 * Somente apresentação: não altera a estrutura, a ordem nem o PDF.
 */
export function numeracaoPorPosicao(ativas: readonly string[], ordem?: readonly string[]): Record<string, string> {
  const keys = ordenarSecoes(normalizarSecoes(ativas), ordem);
  const out: Record<string, string> = {};
  keys.forEach((k, i) => {
    out[k] = String(i + 1).padStart(2, '0');
  });
  return out;
}
