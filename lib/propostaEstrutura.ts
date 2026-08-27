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
}

const inc = (v?: boolean) => v !== false;

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
    { key: 'garantia', titulo: 'Garantia', visible: true, opcional: false },
    { key: 'confidencialidade', titulo: 'Confidencialidade', visible: inc(p.incluirConfidencialidade), opcional: true },
    { key: 'termoAceite', titulo: 'Termo de Aceite da Proposta', visible: inc(p.incluirTermoAceite), opcional: true },
    { key: 'condicoesGerais', titulo: 'Condições Gerais', visible: inc(p.incluirCondicoesGerais), opcional: true },
    { key: 'validade', titulo: 'Validade da Proposta', visible: true, opcional: false },
    { key: 'conclusao', titulo: 'Conclusão', visible: true, opcional: false },
    { key: 'aceite', titulo: 'Aceite da Proposta', visible: true, opcional: false },
  ];
}
