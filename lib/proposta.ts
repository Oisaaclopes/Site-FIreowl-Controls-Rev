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
  garantia: GarantiaPublica;
  responsabilidadeTecnica: string;
  precoVenda: number;
}

/* --------------------------- Garantia (Parte 10) --------------------------- */

export type GarantiaMateriaisModo = 'conforme_fabricante' | 'unificada' | 'por_item';

/** Piso legal do serviço: 90 dias (3 meses). Travado na lógica, não só no front. */
export const GARANTIA_SERVICO_PISO_MESES = 3;

/**
 * Configuração de garantia por proposta. Nomes-espelho da spec ao lado:
 *  servicoMeses          → garantia_servico_meses (piso 3)
 *  servicoExibir         → garantia_servico_exibir
 *  materiaisModo         → garantia_materiais_modo
 *  materiaisMeses        → garantia_materiais_meses (modo 'unificada')
 *  preexistenteExibir    → garantia_preexistente_exibir
 *  condicionadaPreventiva→ garantia_condicionada_preventiva
 *  observacoes           → garantia_observacoes
 */
export interface GarantiaConfig {
  servicoMeses: number;
  servicoExibir: boolean;
  materiaisModo: GarantiaMateriaisModo;
  materiaisMeses?: number;
  preexistenteExibir: boolean;
  condicionadaPreventiva: boolean;
  observacoes?: string;
}

export const GARANTIA_PADRAO: GarantiaConfig = {
  servicoMeses: 12,
  servicoExibir: true,
  materiaisModo: 'conforme_fabricante',
  preexistenteExibir: true,
  condicionadaPreventiva: false,
};

/**
 * Exclusões de garantia (situações NÃO cobertas) — texto padrão versionado.
 * IMPORTANTE: esta lista é SEMPRE renderizada por inteiro. Ocultar uma linha da
 * TABELA de garantia (servicoExibir/preexistenteExibir=false) é escolha visual e
 * NÃO remove a exclusão correspondente daqui — a delimitação legal permanece.
 */
export const GARANTIA_EXCLUSOES: string[] = [
  'Mau uso, operação indevida ou intervenção de terceiros não autorizados.',
  'Vandalismo, furto, sinistro, descarga atmosférica ou surto elétrico.',
  'Infiltração, alagamento ou incêndio.',
  'Ausência de manutenção preventiva no período.',
  'Alteração de layout ou obra posterior que afete a instalação.',
  'Componentes preexistentes não substituídos nesta contratação.',
  'Materiais fornecidos pelo contratante.',
];

const CONDICIONANTE_PREVENTIVA =
  'A garantia do serviço fica condicionada à realização de manutenção preventiva periódica conforme ABNT NBR 17240, executada pela Fireowl Controls ou por empresa tecnicamente habilitada, com comprovação documental.';

export interface GarantiaLinha {
  objeto: string;
  prazo: string;
  observacao?: string;
}

/** Objeto público de garantia (sem nada interno). Vai ao PDF. */
export interface GarantiaPublica {
  linhas: GarantiaLinha[];
  condicionadaPreventiva: boolean;
  textoCondicionante?: string;
  observacoes?: string;
  exclusoes: string[];
}

const mesesLabel = (m: number) => `${m} ${m === 1 ? 'mês' : 'meses'}`;

/** Aplica o piso legal (>= 3 meses) — travado aqui, independe do input do front. */
export function normalizarGarantia(cfg: GarantiaConfig): GarantiaConfig {
  const servicoMeses = Math.max(GARANTIA_SERVICO_PISO_MESES, Math.floor(cfg.servicoMeses || 0));
  const materiaisMeses =
    cfg.materiaisMeses != null && !Number.isNaN(cfg.materiaisMeses)
      ? Math.max(1, Math.floor(cfg.materiaisMeses))
      : undefined;
  return { ...cfg, servicoMeses, materiaisMeses };
}

/** Avisos não-bloqueantes p/ a tela (ex.: serviço com garantia maior que material). */
export function avisosGarantia(cfg: GarantiaConfig): string[] {
  const c = normalizarGarantia(cfg);
  const avisos: string[] = [];
  if (c.materiaisModo === 'unificada' && c.materiaisMeses != null && c.servicoMeses > c.materiaisMeses) {
    avisos.push(
      `A garantia de serviço (${mesesLabel(c.servicoMeses)}) excede a de material (${mesesLabel(
        c.materiaisMeses
      )}). Você pode ficar responsável pelo material além do prazo coberto pelo fornecedor.`
    );
  }
  return avisos;
}

/** Monta o objeto público de garantia a partir da config (piso já aplicado). */
export function montarGarantiaPublica(cfg: GarantiaConfig): GarantiaPublica {
  const c = normalizarGarantia(cfg);
  const linhas: GarantiaLinha[] = [];
  if (c.servicoExibir) {
    linhas.push({ objeto: 'Serviço executado', prazo: mesesLabel(c.servicoMeses) });
  }
  let prazoMat = 'Conforme garantia do fabricante';
  let obsMat: string | undefined;
  if (c.materiaisModo === 'unificada' && c.materiaisMeses != null) {
    prazoMat = mesesLabel(c.materiaisMeses);
  } else if (c.materiaisModo === 'por_item') {
    obsMat = 'Prazo por item — ver ficha técnica de cada material.';
  }
  linhas.push({ objeto: 'Materiais fornecidos', prazo: prazoMat, observacao: obsMat });
  if (c.preexistenteExibir) {
    linhas.push({ objeto: 'Sistema preexistente', prazo: 'Sem garantia', observacao: 'Não coberto por esta contratação.' });
  }
  return {
    linhas,
    condicionadaPreventiva: c.condicionadaPreventiva,
    textoCondicionante: c.condicionadaPreventiva ? CONDICIONANTE_PREVENTIVA : undefined,
    observacoes: c.observacoes?.trim() || undefined,
    exclusoes: GARANTIA_EXCLUSOES,
  };
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
  /** Valor de mão de obra informado manualmente (sobrescreve a regra 70/30). */
  maoDeObraOverride?: number | null;
  logistica?: number;
  prazoDias?: number;
  tecnicos?: number;
  premissas?: string[];
  contexto?: string;
  garantia?: GarantiaConfig; // config de garantia da proposta (default: GARANTIA_PADRAO)
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
  // Mão de obra: valor manual quando informado; senão a regra 70/30 já praticada
  // (material ~30% da execução, mão de obra ~70%).
  const maoDeObra = round2(
    opts.maoDeObraOverride !== undefined && opts.maoDeObraOverride !== null
      ? opts.maoDeObraOverride
      : materiais > 0
      ? materiais * (0.7 / 0.3)
      : opts.valorHora || 0
  );
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
    garantia: montarGarantiaPublica(opts.garantia || GARANTIA_PADRAO),
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
