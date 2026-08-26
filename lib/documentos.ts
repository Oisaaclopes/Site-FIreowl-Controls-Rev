import { DocumentType, PedidoTipo, DocumentosPadrao, Pedido } from './types';

/** Rótulos das 8 opções do modal "Qual documento gerar?". */
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  orcamento: 'Orçamento',
  proposta_comercial: 'Proposta comercial',
  ordem_servico: 'Ordem de serviço',
  lista_produtos: 'Lista de produtos',
  nota_servico: 'Nota de serviço',
  nota_produtos: 'Nota de produtos',
  laudo_tecnico: 'Laudo técnico',
  personalizado: 'Personalizado',
};

/** Ícone (Material Symbols) por documento — usado no modal e na config. */
export const DOCUMENT_TYPE_ICONS: Record<DocumentType, string> = {
  orcamento: 'request_quote',
  proposta_comercial: 'description',
  ordem_servico: 'assignment',
  lista_produtos: 'inventory_2',
  nota_servico: 'receipt_long',
  nota_produtos: 'receipt',
  laudo_tecnico: 'verified',
  personalizado: 'tune',
};

/** Ordem de exibição das opções no modal. */
export const DOCUMENT_TYPE_ORDER: DocumentType[] = [
  'orcamento',
  'proposta_comercial',
  'ordem_servico',
  'lista_produtos',
  'nota_servico',
  'nota_produtos',
  'laudo_tecnico',
  'personalizado',
];

/**
 * Documentos que já possuem gerador real. Fase 1: apenas a Proposta Comercial.
 * As demais opções aparecem, mas avisam "em desenvolvimento".
 */
export const DOCUMENTOS_IMPLEMENTADOS: DocumentType[] = ['proposta_comercial', 'orcamento', 'ordem_servico', 'lista_produtos', 'nota_servico', 'nota_produtos'];

export function isDocumentoImplementado(doc: DocumentType): boolean {
  return DOCUMENTOS_IMPLEMENTADOS.includes(doc);
}

/** Rótulos e ordem dos tipos de pedido (config e seletor da proposta). */
export const PEDIDO_TIPO_LABELS: Record<PedidoTipo, string> = {
  orcamento: 'Orçamento',
  proposta: 'Proposta comercial',
  servico: 'Serviço / Manutenção',
  fornecimento: 'Fornecimento de materiais',
  laudo: 'Laudo / Inspeção',
};

export const PEDIDO_TIPO_ORDER: PedidoTipo[] = ['orcamento', 'proposta', 'servico', 'fornecimento', 'laudo'];

/**
 * Opções de configuração do documento, escolhidas na tela que abre depois de
 * definir o tipo de documento. Valem para todos os documentos (as que não se
 * aplicam a um documento — ex.: preços numa Lista de Produtos — são ignoradas).
 */
export interface DocOptions {
  dataHoje: boolean;
  showValorUnitario: boolean;
  showSubtotal: boolean;
  showDescricaoDetalhada: boolean;
  showCamposPersonalizados: boolean;
  showAssinaturaCliente: boolean;
  showLogo: boolean;
}

export const DEFAULT_DOC_OPTIONS: DocOptions = {
  dataHoje: false,
  showValorUnitario: true,
  showSubtotal: true,
  showDescricaoDetalhada: true,
  showCamposPersonalizados: false,
  showAssinaturaCliente: true,
  showLogo: true,
};

/** Campos exibidos na tela de configuração (na ordem). */
export const DOC_OPTION_FIELDS: { key: keyof DocOptions; label: string; hint?: string }[] = [
  { key: 'dataHoje', label: 'Gerar com a data de hoje', hint: 'Usa a data atual no lugar da data de emissão do pedido.' },
  { key: 'showValorUnitario', label: 'Mostrar valor unitário' },
  { key: 'showSubtotal', label: 'Mostrar subtotais / totais por item', hint: 'Desligue este e o valor unitário para enviar com valor fechado (só o total).' },
  { key: 'showDescricaoDetalhada', label: 'Mostrar descrição detalhada', hint: 'Inclui marca/modelo dos itens.' },
  { key: 'showCamposPersonalizados', label: 'Mostrar campos personalizados' },
  { key: 'showAssinaturaCliente', label: 'Mostrar campo de assinatura do cliente' },
];

/** Documentos que têm valores (preços) — os toggles de valor só fazem sentido neles. */
export const DOCUMENTOS_COM_VALORES: DocumentType[] = ['orcamento', 'proposta_comercial', 'nota_servico', 'nota_produtos'];

/** Tipo do pedido (guardado no JSONB da proposta na Fase 1). */
export function getPedidoTipo(pedido: Pedido): PedidoTipo | undefined {
  return pedido.proposal?.pedidoTipo;
}

/**
 * Resolve o documento padrão para um pedido, dada a config da empresa.
 * Retorna o DocumentType padrão, ou null quando não há padrão (deve perguntar).
 */
export function resolveDocumentoPadrao(pedido: Pedido, config: DocumentosPadrao | undefined): DocumentType | null {
  const tipo = getPedidoTipo(pedido);
  if (!tipo || !config) return null;
  const escolhido = config[tipo];
  if (!escolhido || escolhido === 'nenhum') return null;
  return escolhido;
}
