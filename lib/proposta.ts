import { Pendencia } from './types';

/* =====================================================================
 * Geração de proposta a partir de pendências (Parte 10).
 *
 * SEPARAÇÃO ANTI-VAZAMENTO (10.4): a composição interna (custo, contingência,
 * margem) vive em ComposicaoInterna e NUNCA é passada ao gerador de PDF. O PDF
 * recebe apenas PropostaPublica, que estruturalmente não tem esses campos — o
 * único número monetário é `precoVenda`.
 * ===================================================================== */

export type RegimePrecificacao = 'unitario' | 'fechado' | 'fechado_com_anexo';

export interface LinhaEscopo {
  grupo: string;
  descricao: string; // voz de ação: "Fornecimento e instalação de ..."
  local?: string;
  quantidade?: number;
  unidade?: string;
  norma?: string;
}

/** Objeto INTERNO — visível só a Admin/Gestor/Financeiro, NUNCA renderizado. */
export interface ComposicaoInterna {
  materiais: number;
  maoDeObra: number;
  logistica: number;
  subtotalCusto: number;
  contingenciaPct: number;
  contingencia: number;
  margem: number;
  precoVenda: number;
}

/** Objeto PÚBLICO limitado — só campos imprimíveis. Sem custo/contingência/margem. */
export interface PropostaPublica {
  numero: string;
  cliente: string;
  data: string;
  regime: RegimePrecificacao;
  contexto?: string;
  escopo: LinhaEscopo[];
  materiais: { descricao: string; quantidade?: number; unidade?: string }[];
  naoIncluido: string[];
  premissas: string[];
  matriz: { item: string; responsavel: 'Contratada' | 'Contratante' }[];
  prazoDias?: number;
  tecnicos?: number;
  garantia: string;
  responsabilidadeTecnica: string;
  precoVenda: number;
}

/* --- Textos padrão VERSIONADOS (10.6) — reproduzíveis como foram aceitos --- */
export const TEXTOS_PADRAO = {
  versao: 1,
  naoIncluido: [
    'Obra civil de qualquer natureza.',
    'Remanejamento de infraestrutura não descrita no escopo.',
    'Fornecimento de energia elétrica e ponto de alimentação dedicado.',
    'Adequações decorrentes de não conformidades de projeto pré-existentes.',
    'Atendimento emergencial fora do horário contratado.',
  ],
  garantia:
    'Garantia de 12 meses sobre os serviços executados e conforme garantia de fábrica dos materiais fornecidos.',
  responsabilidadeTecnica:
    'Serviços sob responsabilidade técnica de engenheiro registrado no CREA, com emissão de ART quando aplicável.',
  matrizBase: [
    { item: 'Fornecimento e instalação dos dispositivos do escopo', responsavel: 'Contratada' as const },
    { item: 'Liberação de acesso e áreas para execução', responsavel: 'Contratante' as const },
    { item: 'Desligamentos programados e janelas de operação', responsavel: 'Contratante' as const },
    { item: 'Teste funcional e comissionamento', responsavel: 'Contratada' as const },
  ],
};

export interface MontarPropostaOpts {
  numero: string;
  cliente: string;
  regime: RegimePrecificacao;
  contingenciaPct: number; // 0.05, 0.15, 0.20...
  margemPct?: number; // markup comercial (default 0.25)
  precoItem?: (pendencia: Pendencia) => number; // preço unitário do catálogo (0 se a precificar)
  valorHora?: number; // usado quando não há como derivar mão de obra
  logistica?: number;
  prazoDias?: number;
  tecnicos?: number;
  premissas?: string[];
  contexto?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Sugestão de contingência a partir das respostas do levantamento (10.3). */
export function sugestaoContingencia(flags: { asBuilt?: boolean; infraNova?: boolean; acessoRestrito?: boolean }): number {
  let pct = 0.05; // substituição em local acessível
  if (flags.infraNova) pct = 0.15;
  if (flags.asBuilt === false) pct = 0.2; // sistema legado sem as-built
  if (flags.acessoRestrito) pct += 0.05;
  return pct;
}

/** Monta a composição interna e o objeto público a partir das pendências. */
export function montarProposta(
  pendencias: Pendencia[],
  opts: MontarPropostaOpts
): { composicao: ComposicaoInterna; publica: PropostaPublica } {
  const precoItem = opts.precoItem || (() => 0);
  const margemPct = opts.margemPct ?? 0.25;

  // Escopo em voz de ação, agrupado por grupo (o PDF reagrupa também).
  const escopo: LinhaEscopo[] = pendencias.map((p) => ({
    grupo: p.grupo || 'Serviços',
    descricao: acaoParaVerbo(p),
    local: p.local,
    quantidade: p.quantidade,
    unidade: p.unidade,
    norma: p.normaReferencia,
  }));

  const materiais = round2(pendencias.reduce((acc, p) => acc + precoItem(p) * (p.quantidade || 1), 0));
  // Regra 70/30 já praticada: material ~30% da execução, mão de obra ~70%.
  const maoDeObra = round2(materiais > 0 ? materiais * (0.7 / 0.3) : (opts.valorHora || 0));
  const logistica = round2(opts.logistica || 0);
  const subtotalCusto = round2(materiais + maoDeObra + logistica);
  const contingencia = round2(subtotalCusto * opts.contingenciaPct);
  const baseComMargem = subtotalCusto + contingencia;
  const margem = round2(baseComMargem * margemPct);
  const precoVenda = round2(baseComMargem + margem);

  const composicao: ComposicaoInterna = {
    materiais,
    maoDeObra,
    logistica,
    subtotalCusto,
    contingenciaPct: opts.contingenciaPct,
    contingencia,
    margem,
    precoVenda,
  };

  // Objeto público: só o que pode ser impresso. NADA de custo/contingência/margem.
  const publica: PropostaPublica = {
    numero: opts.numero,
    cliente: opts.cliente,
    data: new Date().toLocaleDateString('pt-BR'),
    regime: opts.regime,
    contexto: opts.contexto,
    escopo,
    materiais: pendencias
      .filter((p) => p.itemTextoLivre || p.itemCatalogoId)
      .map((p) => ({ descricao: p.itemCatalogoId || p.itemTextoLivre || '', quantidade: p.quantidade, unidade: p.unidade })),
    naoIncluido: TEXTOS_PADRAO.naoIncluido,
    premissas: opts.premissas && opts.premissas.length ? opts.premissas : ['Áreas liberadas para execução nas janelas acordadas.'],
    matriz: TEXTOS_PADRAO.matrizBase,
    prazoDias: opts.prazoDias,
    tecnicos: opts.tecnicos,
    garantia: TEXTOS_PADRAO.garantia,
    responsabilidadeTecnica: TEXTOS_PADRAO.responsabilidadeTecnica,
    precoVenda,
  };

  return { composicao, publica };
}

/** Converte ação recomendada + item em descrição de escopo com verbo de ação (10.6). */
function acaoParaVerbo(p: Pendencia): string {
  const item = p.itemCatalogoId || p.itemTextoLivre || p.descricao || 'item do escopo';
  const map: Record<string, string> = {
    substituir: 'Fornecimento e substituição de',
    instalar: 'Fornecimento e instalação de',
    reposicionar: 'Remanejamento de',
    reparar: 'Reparo de',
    limpar: 'Limpeza técnica de',
    desobstruir: 'Desobstrução de',
    reprogramar: 'Reprogramação de',
    investigar: 'Diagnóstico técnico de',
  };
  const verbo = (p.acaoRecomendada && map[p.acaoRecomendada]) || 'Execução de serviço em';
  return `${verbo} ${item}, com endereçamento e teste funcional`;
}

/* --------------------------- Trava anti-vazamento --------------------------- */

export const TERMOS_PROIBIDOS = ['contingência', 'contingencia', 'margem', 'custo unitário', 'custo unitario', 'criticidade', 'bdi'];

/**
 * Verifica se um texto (extraído do PDF) contém termos internos proibidos.
 * Retorna a lista de termos encontrados (vazio = ok).
 */
export function detectarVazamento(texto: string): string[] {
  const t = texto.toLowerCase();
  return TERMOS_PROIBIDOS.filter((termo) => t.includes(termo));
}

/** Lança se o texto vazar termo interno — usado como guarda em runtime no PDF. */
export function assertSemVazamento(texto: string): void {
  const achados = detectarVazamento(texto);
  if (achados.length > 0) {
    throw new Error(`VAZAMENTO na proposta: termo(s) interno(s) no documento do cliente: ${achados.join(', ')}`);
  }
}
