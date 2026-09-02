import { tituloEscopo } from './propostaTitulo';

/**
 * §10/§11/§12 — Fonte única da estrutura da proposta.
 *
 * Define a ordem canônica das seções, seus títulos (com título dinâmico de
 * escopo) e a visibilidade a partir das flags. Usado tanto pelo PDF quanto pela
 * tela de pré-visualização da estrutura, para que índice e numeração sejam
 * sempre calculados do mesmo lugar.
 */

export interface SecaoEstrutura {
  key: string;
  titulo: string;
  visible: boolean;
  /** Seção que o usuário pode ativar/desativar. */
  opcional: boolean;
}

/** Campos da proposta que influenciam a estrutura. */
export interface EstruturaProposalLike {
  tipoServico?: string;
  incluirSeguranca?: boolean;
  incluirMultas?: boolean;
  incluirLimitacao?: boolean;
  incluirConfidencialidade?: boolean;
  incluirTermoAceite?: boolean;
  incluirCondicoesGerais?: boolean;
}

export interface EstruturaCtx {
  /** Carta de Apresentação visível (opção de geração + nível ≠ simples). */
  cartaVisivel: boolean;
  /** Histórico de Propostas visível. */
  historicoVisivel: boolean;
  /** Há materiais (habilita "Embalagem, Transporte e Armazenamento"). */
  temMateriais: boolean;
  /** Garantia visível (há alguma condição informada). undefined = visível
   * (compatibilidade com propostas antigas / chamadas sem o campo). */
  garantiaVisivel?: boolean;
}

const inc = (v?: boolean) => v !== false;

/** Seções fixas: Carta abre (página própria) e Aceite fecha a proposta. */
export const SECOES_FIXAS_INICIO = ['carta'];
export const SECOES_FIXAS_FIM = ['aceite'];

/**
 * §12 — Aplica a ordem definida pelo usuário ao "miolo" da estrutura, mantendo
 * Carta no início e Aceite no fim. Chaves não citadas em `ordem` seguem na
 * ordem canônica, ao final. Sem `ordem`, devolve a estrutura como está.
 */
export function ordenarEstrutura(secoes: SecaoEstrutura[], ordem?: string[]): SecaoEstrutura[] {
  if (!ordem || ordem.length === 0) return secoes;
  const inicio = secoes.filter((s) => SECOES_FIXAS_INICIO.includes(s.key));
  const fim = secoes.filter((s) => SECOES_FIXAS_FIM.includes(s.key));
  const meio = secoes.filter((s) => !SECOES_FIXAS_INICIO.includes(s.key) && !SECOES_FIXAS_FIM.includes(s.key));
  const restantes = new Map(meio.map((s) => [s.key, s]));
  const ordenados: SecaoEstrutura[] = [];
  for (const k of ordem) {
    const s = restantes.get(k);
    if (s) { ordenados.push(s); restantes.delete(k); }
  }
  for (const s of meio) if (restantes.has(s.key)) ordenados.push(s); // resto na ordem canônica
  return [...inicio, ...ordenados, ...fim];
}

export function montarEstruturaProposta(p: EstruturaProposalLike, ctx: EstruturaCtx): SecaoEstrutura[] {
  return [
    { key: 'carta', titulo: 'Carta de Apresentação', visible: ctx.cartaVisivel, opcional: true },
    { key: 'historico', titulo: 'Histórico de Propostas', visible: ctx.historicoVisivel, opcional: true },
    { key: 'visao', titulo: 'Visão Geral da Proposta', visible: true, opcional: false },
    { key: 'escopo', titulo: tituloEscopo(p.tipoServico), visible: true, opcional: false },
    { key: 'itens', titulo: 'Materiais e Serviços Ofertados', visible: true, opcional: false },
    { key: 'premissas', titulo: 'Premissas Adotadas', visible: true, opcional: false },
    { key: 'servicos', titulo: 'Descrição dos Serviços Ofertados', visible: true, opcional: false },
    { key: 'embalagem', titulo: 'Embalagem, Transporte e Armazenamento', visible: ctx.temMateriais, opcional: true },
    { key: 'seguranca', titulo: 'Segurança do Trabalho', visible: inc(p.incluirSeguranca), opcional: true },
    { key: 'obrigacoes', titulo: 'Obrigações da Contratante', visible: true, opcional: false },
    { key: 'precos', titulo: 'Preços', visible: true, opcional: false },
    { key: 'infoCompra', titulo: 'Informações para o Pedido de Compra', visible: true, opcional: false },
    { key: 'impostos', titulo: 'Impostos e Taxas', visible: true, opcional: false },
    { key: 'pagamento', titulo: 'Condições de Pagamento', visible: true, opcional: false },
    { key: 'multas', titulo: 'Multas por Atraso de Pagamento', visible: inc(p.incluirMultas), opcional: true },
    { key: 'limitacao', titulo: 'Limitação de Responsabilidade', visible: inc(p.incluirLimitacao), opcional: true },
    { key: 'prazo', titulo: 'Prazo de Fornecimento', visible: true, opcional: false },
    { key: 'garantia', titulo: 'Garantia', visible: ctx.garantiaVisivel !== false, opcional: true },
    { key: 'confidencialidade', titulo: 'Confidencialidade', visible: inc(p.incluirConfidencialidade), opcional: true },
    { key: 'termoAceite', titulo: 'Termo de Aceite da Proposta', visible: inc(p.incluirTermoAceite), opcional: true },
    { key: 'condicoesGerais', titulo: 'Condições Gerais', visible: inc(p.incluirCondicoesGerais), opcional: true },
    { key: 'validade', titulo: 'Validade da Proposta', visible: true, opcional: false },
    { key: 'conclusao', titulo: 'Conclusão', visible: true, opcional: false },
    { key: 'aceite', titulo: 'Aceite da Proposta', visible: true, opcional: false },
  ];
}
