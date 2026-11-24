import type { CommercialProposalData, PedidoTipo } from './types';

/**
 * Seções do documento do Pedido — personalizáveis por pedido em TODOS os tipos.
 *
 * Cada Tipo de Pedido tem um conjunto PADRÃO de seções (o que o gerador daquele
 * tipo sempre imprimiu). O usuário pode ligar/desligar qualquer seção do
 * catálogo; a escolha fica no JSONB `proposal.secoesDocumento` (sem migração).
 *
 * Compatibilidade: `secoesDocumento` AUSENTE = pedido não personalizado → os
 * geradores seguem EXATAMENTE o caminho histórico (o padrão do tipo). Só quando
 * a lista existe (mesmo vazia) é que a seleção explícita manda no PDF.
 *
 * As chaves são as mesmas da estrutura da proposta ([[lib/propostaEstrutura]]),
 * mais `entregaveis` e `incluso`, que na proposta histórica saíam embutidos em
 * "Descrição dos Serviços" e "Premissas" e aqui viram seções independentes.
 */

export type SecaoDocKey =
  | 'carta'
  | 'historico'
  | 'visao'
  | 'normas'
  | 'escopo'
  | 'itens'
  | 'itensServicos'
  | 'premissas'
  | 'incluso'
  | 'servicos'
  | 'responsabilidades'
  | 'entregaveis'
  | 'embalagem'
  | 'seguranca'
  | 'obrigacoes'
  | 'precos'
  | 'infoCompra'
  | 'impostos'
  | 'pagamento'
  | 'multas'
  | 'limitacao'
  | 'prazo'
  | 'garantia'
  | 'confidencialidade'
  | 'termoAceite'
  | 'condicoesGerais'
  | 'validade'
  | 'conclusao'
  | 'aceite';

export interface SecaoDocumento {
  key: SecaoDocKey;
  titulo: string;
  descricao: string;
}

/** Catálogo completo, na ordem canônica do documento. */
export const SECOES_DOCUMENTO: SecaoDocumento[] = [
  { key: 'carta', titulo: 'Carta de Apresentação', descricao: 'Página de abertura assinada pelo responsável comercial.' },
  { key: 'historico', titulo: 'Histórico de Propostas', descricao: 'Tabela de revisões do pedido.' },
  { key: 'visao', titulo: 'Objetivo', descricao: 'Objetivo do pedido.' },
  { key: 'normas', titulo: 'Diretrizes Normativas', descricao: 'Normas de referência.' },
  { key: 'escopo', titulo: 'Escopo dos Serviços', descricao: 'Descrição do escopo proposto (e SLA, se houver).' },
  { key: 'itens', titulo: 'Materiais e Serviços', descricao: 'Tabela de MATERIAIS (quantidades e valores).' },
  { key: 'itensServicos', titulo: 'Lista de Serviços', descricao: 'Tabela de SERVIÇOS; sai dentro da seção de itens.' },
  { key: 'premissas', titulo: 'Premissas Adotadas', descricao: 'Condições assumidas para a execução.' },
  { key: 'incluso', titulo: 'Incluso / Não incluso', descricao: 'O que está dentro e fora do escopo.' },
  { key: 'servicos', titulo: 'Descrição dos Serviços Ofertados', descricao: 'Grupos de serviços ofertados.' },
  { key: 'responsabilidades', titulo: 'Responsabilidades da Contratada', descricao: 'O que a contratada assume.' },
  { key: 'entregaveis', titulo: 'Entregáveis', descricao: 'Documentos e resultados entregues ao cliente.' },
  { key: 'embalagem', titulo: 'Embalagem, Transporte e Armazenamento', descricao: 'Condições de entrega dos materiais.' },
  { key: 'seguranca', titulo: 'Segurança do Trabalho', descricao: 'Requisitos de segurança da equipe.' },
  { key: 'obrigacoes', titulo: 'Obrigações da Contratante', descricao: 'O que o cliente precisa providenciar.' },
  { key: 'precos', titulo: 'Preços', descricao: 'Investimento total (ou mensal) e observações de preço.' },
  { key: 'infoCompra', titulo: 'Informações para o Pedido de Compra', descricao: 'Razão social, CNPJ e contatos para faturamento.' },
  { key: 'impostos', titulo: 'Impostos e Taxas', descricao: 'Regime tributário e observações.' },
  { key: 'pagamento', titulo: 'Condições de Pagamento', descricao: 'Formas e condições de pagamento, faturamento.' },
  { key: 'multas', titulo: 'Multas por Atraso de Pagamento', descricao: 'Cláusula jurídica.' },
  { key: 'limitacao', titulo: 'Limitação de Responsabilidade', descricao: 'Cláusula jurídica.' },
  { key: 'prazo', titulo: 'Prazo de Fornecimento', descricao: 'Prazo de execução/entrega.' },
  { key: 'garantia', titulo: 'Garantia', descricao: 'Garantia de mão de obra e materiais (se informada).' },
  { key: 'confidencialidade', titulo: 'Confidencialidade', descricao: 'Cláusula jurídica.' },
  { key: 'termoAceite', titulo: 'Termo de Aceite', descricao: 'Texto do termo de aceite.' },
  { key: 'condicoesGerais', titulo: 'Condições Gerais', descricao: 'Cláusula jurídica.' },
  { key: 'validade', titulo: 'Validade', descricao: 'Prazo de validade dos preços.' },
  { key: 'conclusao', titulo: 'Conclusão / Parecer', descricao: 'Texto de fechamento (no laudo: parecer técnico).' },
  { key: 'aceite', titulo: 'Aceite e Assinaturas', descricao: 'Bloco final de "de acordo" com assinaturas.' },
];

export const SECAO_KEYS: SecaoDocKey[] = SECOES_DOCUMENTO.map((s) => s.key);
const KEY_SET = new Set<string>(SECAO_KEYS);

export const SECAO_TITULO: Record<SecaoDocKey, string> = Object.fromEntries(
  SECOES_DOCUMENTO.map((s) => [s.key, s.titulo]),
) as Record<SecaoDocKey, string>;

/**
 * Seções que o gerador de ORÇAMENTO imprime historicamente (na ordem do
 * documento; o escopo sai junto do Objetivo). Usado como padrão de Orçamento/Fornecimento e para saber quais
 * seções ele desenha nativamente (o resto vira bloco genérico).
 */
export const SECOES_NATIVAS_ORCAMENTO: SecaoDocKey[] = [
  'visao', 'normas', 'escopo', 'itens', 'itensServicos', 'incluso', 'precos', 'impostos', 'pagamento', 'prazo', 'garantia', 'validade', 'premissas',
  // O orçamento sempre fechou com o bloco de assinaturas ("De acordo & Aceite"):
  // é nativo, então aparece como "Sim" no editor e obedece ao "Não".
  'aceite',
];

/** Seções que o gerador de LAUDO imprime historicamente (objetivo, normas, itens, parecer). */
export const SECOES_NATIVAS_LAUDO: SecaoDocKey[] = ['visao', 'normas', 'itens', 'itensServicos', 'conclusao'];

/** Cláusulas da proposta que já tinham flag própria (`incluirX`). */
const FLAG_POR_SECAO: Partial<Record<SecaoDocKey, keyof FlagsSecoes>> = {
  seguranca: 'incluirSeguranca',
  multas: 'incluirMultas',
  limitacao: 'incluirLimitacao',
  confidencialidade: 'incluirConfidencialidade',
  termoAceite: 'incluirTermoAceite',
  condicoesGerais: 'incluirCondicoesGerais',
};

export type FlagsSecoes = Pick<
  CommercialProposalData,
  'incluirSeguranca' | 'incluirMultas' | 'incluirLimitacao' | 'incluirConfidencialidade' | 'incluirTermoAceite' | 'incluirCondicoesGerais'
>;

/** Flag `incluirX` correspondente à seção (ou undefined se a seção não tem flag). */
export function flagDaSecao(key: SecaoDocKey): keyof FlagsSecoes | undefined {
  return FLAG_POR_SECAO[key];
}

/**
 * Seções pré-definidas para o tipo. Para Proposta/Serviço respeita as flags
 * jurídicas já gravadas (uma cláusula desligada não volta marcada). Sem tipo
 * definido, o documento histórico é a proposta completa.
 */
export function secoesPadraoDoTipo(tipo: PedidoTipo | '' | undefined, flags: FlagsSecoes = {}): SecaoDocKey[] {
  switch (tipo) {
    case 'orcamento':
    case 'fornecimento':
      return [...SECOES_NATIVAS_ORCAMENTO].sort(porOrdemCanonica);
    case 'laudo':
      return [...SECOES_NATIVAS_LAUDO];
    case 'personalizado':
      return [];
    case 'proposta':
    case 'servico':
    default:
      return SECAO_KEYS.filter((k) => {
        const f = FLAG_POR_SECAO[k];
        return !f || flags[f] !== false;
      });
  }
}

function porOrdemCanonica(a: string, b: string): number {
  return SECAO_KEYS.indexOf(a as SecaoDocKey) - SECAO_KEYS.indexOf(b as SecaoDocKey);
}

/** Normaliza uma lista vinda do JSONB: só chaves conhecidas, sem repetição, na ordem canônica. */
export function normalizarSecoes(lista: readonly string[]): SecaoDocKey[] {
  return Array.from(new Set(lista.filter((k) => KEY_SET.has(k)))).sort(porOrdemCanonica) as SecaoDocKey[];
}

/** O pedido tem seleção explícita de seções? (false = legado / padrão do tipo). */
export function secoesPersonalizadas(p: Pick<CommercialProposalData, 'secoesDocumento'> | undefined | null): boolean {
  return Array.isArray(p?.secoesDocumento);
}

/**
 * Seleção explícita a aplicar no PDF, ou `null` quando o pedido não foi
 * personalizado (o gerador deve usar o caminho histórico, sem mudança alguma).
 */
export function secoesSelecionadas(p: Pick<CommercialProposalData, 'secoesDocumento'> | undefined | null): Set<SecaoDocKey> | null {
  if (!secoesPersonalizadas(p)) return null;
  return new Set(normalizarSecoes(p!.secoesDocumento!));
}

/** Seções efetivas (para o editor): seleção explícita ou o padrão do tipo. */
export function secoesEfetivas(
  p: Pick<CommercialProposalData, 'secoesDocumento' | 'pedidoTipo'> & FlagsSecoes,
): SecaoDocKey[] {
  return secoesPersonalizadas(p) ? normalizarSecoes(p.secoesDocumento!) : secoesPadraoDoTipo(p.pedidoTipo, p);
}

/** Liga/desliga uma seção mantendo a ordem canônica. */
export function alternarSecao(atual: readonly string[], key: SecaoDocKey, ligar?: boolean): SecaoDocKey[] {
  const set = new Set(normalizarSecoes(atual));
  const on = ligar ?? !set.has(key);
  if (on) set.add(key);
  else set.delete(key);
  return normalizarSecoes(Array.from(set));
}

/** A seção faz parte do padrão do tipo? (destaque no editor). */
export function ehSecaoPadrao(tipo: PedidoTipo | '' | undefined, key: SecaoDocKey, flags: FlagsSecoes = {}): boolean {
  return secoesPadraoDoTipo(tipo, flags).includes(key);
}

/** Seleção equivale ao padrão do tipo? (permite gravar "não personalizado"). */
export function igualAoPadrao(sel: readonly string[], tipo: PedidoTipo | '' | undefined, flags: FlagsSecoes = {}): boolean {
  const a = normalizarSecoes(sel);
  const b = secoesPadraoDoTipo(tipo, flags);
  return a.length === b.length && a.every((k, i) => k === b[i]);
}

/**
 * Seções selecionadas que um gerador NÃO desenha nativamente — saem como
 * blocos genéricos ([[SecoesExtras]] no pdfKit), na ordem canônica.
 */
export function secoesExtras(sel: Set<SecaoDocKey>, nativas: readonly SecaoDocKey[]): SecaoDocKey[] {
  return SECAO_KEYS.filter((k) => sel.has(k) && !nativas.includes(k));
}

// ===================== Padrão da EMPRESA por tipo (0122) =====================
// "Salvar como novo padrão do Orçamento": a empresa pode trocar o padrão de um
// tipo. Ele só vale para pedidos NOVOS (ou ao escolher o tipo): o editor grava
// a seleção no próprio pedido, então o PDF nunca depende deste mapa e pedidos
// existentes não mudam.

export type MapaPadraoEmpresa = Partial<Record<PedidoTipo, string[]>>;

/** Padrão salvo pela empresa para o tipo (normalizado), ou null se não houver. */
export function padraoEmpresaDoTipo(tipo: PedidoTipo | '' | undefined, empresa: MapaPadraoEmpresa | undefined | null): SecaoDocKey[] | null {
  if (!tipo || !empresa) return null;
  const lista = empresa[tipo];
  return Array.isArray(lista) ? normalizarSecoes(lista) : null;
}

/** Padrão de referência do tipo: o da empresa quando existe, senão o do sistema. */
export function padraoReferenciaDoTipo(
  tipo: PedidoTipo | '' | undefined,
  empresa: MapaPadraoEmpresa | undefined | null,
  flags: FlagsSecoes = {},
): SecaoDocKey[] {
  return padraoEmpresaDoTipo(tipo, empresa) ?? secoesPadraoDoTipo(tipo, flags);
}

/** Duas seleções são iguais (ignorando ordem/repetição/chaves inválidas)? */
export function mesmasSecoes(a: readonly string[], b: readonly string[]): boolean {
  const x = normalizarSecoes(a);
  const y = normalizarSecoes(b);
  return x.length === y.length && x.every((k, i) => k === y[i]);
}

/**
 * Novo mapa da empresa após salvar (`lista`) ou restaurar (`null`) o padrão de
 * um tipo. Salvar exatamente o padrão do sistema equivale a restaurar (remove
 * a chave), para o mapa não guardar redundância.
 */
export function atualizarPadraoEmpresa(
  empresa: MapaPadraoEmpresa | undefined | null,
  tipo: PedidoTipo,
  lista: readonly string[] | null,
): MapaPadraoEmpresa {
  const out: MapaPadraoEmpresa = { ...(empresa || {}) };
  if (lista === null || mesmasSecoes(lista, secoesPadraoDoTipo(tipo))) delete out[tipo];
  else out[tipo] = normalizarSecoes(lista);
  return out;
}

// ============================ Ordem das seções ============================
/** Seções presas no início/fim do documento (não reordenáveis). */
export const SECOES_FIXAS_INICIO_DOC: SecaoDocKey[] = ['carta'];
export const SECOES_FIXAS_FIM_DOC: SecaoDocKey[] = ['aceite'];
/** Sub-seção: não tem posição própria (sai dentro de 'itens'). */
export const SUBSECOES: SecaoDocKey[] = ['itensServicos'];

/**
 * Ordem de desenho das seções: Carta no início, Aceite no fim e o miolo na
 * ordem escolhida pelo usuário (proposal.ordemSecoes); chaves não citadas
 * seguem na ordem canônica, ao final. Sub-seções são removidas.
 */
export function ordenarSecoes(keys: readonly SecaoDocKey[], ordem?: readonly string[]): SecaoDocKey[] {
  // Só a Lista de Serviços ligada ainda precisa da seção de itens para aparecer.
  const comItens = keys.includes('itensServicos') && !keys.includes('itens') ? [...keys, 'itens' as SecaoDocKey] : keys;
  const set = new Set(comItens.filter((k) => !SUBSECOES.includes(k)));
  const inicio = SECOES_FIXAS_INICIO_DOC.filter((k) => set.has(k));
  const fim = SECOES_FIXAS_FIM_DOC.filter((k) => set.has(k));
  const meio: SecaoDocKey[] = [];
  for (const k of ordem || []) {
    const key = k as SecaoDocKey;
    if (set.has(key) && !inicio.includes(key) && !fim.includes(key) && !meio.includes(key)) meio.push(key);
  }
  for (const k of SECAO_KEYS) if (set.has(k) && !inicio.includes(k) && !fim.includes(k) && !meio.includes(k)) meio.push(k);
  return [...inicio, ...meio, ...fim];
}

/**
 * Move uma seção do miolo para antes (dir=-1) ou depois (dir=1) da vizinha
 * mais próxima dentre `visiveis` (as que têm card no editor). Devolve a nova
 * ordem completa do miolo (para gravar em proposal.ordemSecoes).
 */
export function moverSecao(
  ordemAtual: readonly string[] | undefined,
  key: SecaoDocKey,
  dir: -1 | 1,
  visiveis: readonly SecaoDocKey[],
): SecaoDocKey[] {
  const meio = ordenarSecoes(SECAO_KEYS, ordemAtual).filter((k) => !SECOES_FIXAS_INICIO_DOC.includes(k) && !SECOES_FIXAS_FIM_DOC.includes(k));
  const vis = meio.filter((k) => visiveis.includes(k));
  const i = vis.indexOf(key);
  const alvo = vis[i + dir];
  if (i < 0 || !alvo) return meio;
  const sem = meio.filter((k) => k !== key);
  const j = sem.indexOf(alvo);
  sem.splice(dir < 0 ? j : j + 1, 0, key);
  return sem;
}
