import { CommercialProposalData } from './types';
import { SecaoDocKey, ordenarSecoes, secoesSelecionadas } from './documentoSecoes';
import { renderWarranty } from './commercialWarranty';
import { secaoTemConteudo } from './secaoConteudo';
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

/**
 * Numeração das seções como sai no PDF do ORÇAMENTO (OrcamentoDocument), com a
 * mesma regra do gerador:
 * - sem seleção própria (pedido no padrão do tipo): layout histórico, números fixos
 *   01 Objetivo · 02 Materiais e Serviços · 03 Preços · 04 Impostos · 05 Pagamento ·
 *   06 Prazo · 07 Garantia · 08 Validade (Objetivo e Garantia só quando têm conteúdo);
 * - com seleção: cada seção ligada e com conteúdo, na ordem escolhida no editor.
 */
export function numeracaoSecoesOrcamento(p: CommercialProposalData): Record<string, string> {
  const sel = secoesSelecionadas(p);
  if (!sel) {
    const out: Record<string, string> = { itens: '02', precos: '03', impostos: '04', pagamento: '05', prazo: '06', validade: '08' };
    if (nv(p.objetivo) || nv(p.escopoServico)) out.visao = '01';
    if (renderWarranty(p.warranty).hasAny) out.garantia = '07';
    return out;
  }
  const ctx = { p, verMateriais: sel.has('itens'), verServicos: sel.has('itensServicos') };
  const temConteudoOrc = (k: SecaoDocKey): boolean => {
    switch (k) {
      case 'itens': case 'precos': case 'impostos': case 'pagamento': case 'prazo': case 'validade': return true;
      case 'garantia': return renderWarranty(p.warranty).hasAny;
      case 'premissas': return lnv(p.premissas);
      case 'incluso': return lnv(p.incluso) || lnv(p.naoIncluso);
      default: return secaoTemConteudo(k, ctx);
    }
  };
  const ordem = ordenarSecoes([...sel], p.ordemSecoes).filter(temConteudoOrc);
  const out: Record<string, string> = {};
  ordem.forEach((k, i) => {
    out[k] = String(i + 1).padStart(2, '0');
  });
  return out;
}

const nv = (s?: string) => !!s && s.trim().length > 0;
const lnv = (a?: string[]) => Array.isArray(a) && a.filter((x) => nv(x)).length > 0;
