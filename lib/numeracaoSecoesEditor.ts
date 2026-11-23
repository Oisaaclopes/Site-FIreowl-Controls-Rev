import { EstruturaProposalLike, montarEstruturaProposta, ordenarEstrutura } from './propostaEstrutura';

/**
 * Numeração das seções como sai no PDF da PROPOSTA COMERCIAL (PropostaDocument),
 * para exibir no editor ("01 Carta de Apresentação", "02 Objetivo"…).
 *
 * Somente leitura/apresentação: reproduz exatamente a mesma conta do gerador
 * (montarEstruturaProposta + ordenarEstrutura, contando só as seções visíveis).
 * Não altera a estrutura nem a ordem do documento.
 */
export interface NumeracaoCtx {
  /** Seleção explícita gravada no pedido (secoesDocumento) ou null (padrão do tipo). */
  selecao: ReadonlySet<string> | null;
  /** Há materiais (tipo ≠ serviço) nos itens. */
  temMateriais: boolean;
  /** Garantia com alguma condição informada. */
  garantiaVisivel: boolean;
  /** Opções de geração (Conta → PDF). undefined = ligado, como no gerador. */
  showCarta?: boolean;
  showHistorico?: boolean;
}

export function numeracaoSecoesProposta(
  p: EstruturaProposalLike & { nivelProposta?: string; ordemSecoes?: string[] },
  ctx: NumeracaoCtx,
): Record<string, string> {
  const nivel = p.nivelProposta || 'tecnica';
  const showHistorico = ctx.showHistorico !== false;
  const estrutura = ordenarEstrutura(
    montarEstruturaProposta(
      p,
      ctx.selecao
        ? { cartaVisivel: ctx.showCarta !== false, historicoVisivel: showHistorico, temMateriais: ctx.temMateriais, garantiaVisivel: ctx.garantiaVisivel, selecao: ctx.selecao }
        : { cartaVisivel: ctx.showCarta !== false && nivel !== 'simples', historicoVisivel: showHistorico, temMateriais: ctx.temMateriais, garantiaVisivel: ctx.garantiaVisivel },
    ),
    p.ordemSecoes,
  );
  const out: Record<string, string> = {};
  estrutura
    .filter((s) => s.visible)
    .forEach((s, i) => {
      out[s.key] = String(i + 1).padStart(2, '0');
    });
  return out;
}
