/* =====================================================================
 * Orçamento com IA — Fase 1 (texto → plano revisável → rascunho).
 *
 * Fluxo: a Edge Function `gerar-orcamento` devolve um PLANO (JSON). Este
 * módulo PURO valida o plano, confere os totais com a MESMA função do editor
 * ([[commercialTotals]]) e monta o Pedido em rascunho no formato que o editor
 * grava (textos-padrão materializados). A IA nunca grava nada: quem grava é a
 * tela, depois da aprovação do usuário.
 * ===================================================================== */
import type { Client, CommercialProposalData, InventoryItem, Pedido, PedidoEquipmentItem } from './types';
import { calculateCommercialProposalTotals, lineTotal, roundMoney } from './commercialTotals';
import { computePricing } from './priceFormation';
import { SECOES_TEXTO, fonteDaSecaoLista, fonteServicos, servicosOfertadosPadrao } from './propostaMaterializacao';
import { CARTA_APRESENTACAO } from './propostaTextos';
import { getNormativeReferences } from './normasReferencia';
import { AREAS_PROPOSTA, TIPOS_SERVICO } from './propostaTitulo';
import { defaultWarranty, type StructuredWarranty } from './commercialWarranty';
import { COMMERCIAL_SCHEMA_VERSION } from './commercialProposal';
import { normalizeUnitCode } from './commercialUnits';

export type AcaoProduto = 'usar' | 'atualizar' | 'criar';

export interface PlanoProduto {
  /** Chave interna do plano (normalmente o modelo) — liga itens a produtos. */
  chave: string;
  inventoryItemId: string | null;
  acao: AcaoProduto;
  modelo: string;
  nome: string;
  descricao: string;
  marca: string;
  categoria: string;
  subcategoria: string | null;
  unidade: string;
  custo: number | null;
  venda: number | null;
  codigoFornecedor: string | null;
}

export interface PlanoItem {
  tipo: 'material' | 'servico';
  produtoChave: string | null;
  descricao: string;
  quantidade: number;
  unidade: string;
  precoUnitario: number;
  /** Opcional = aparece no documento, mas NÃO soma no total. */
  opcional: boolean;
}

export interface PlanoOrcamentoIA {
  cliente: { clienteId: string | null; nomeInformado: string; candidatosIds: string[] };
  dados: {
    titulo: string;
    local: string | null;
    dataEmissao: string | null;
    validadeDias: number | null;
    prazoExecucao: string | null;
    garantiaServicosDias: number | null;
    garantiaMateriais: string | null;
    formaPagamento: string | null;
    areas: string[];
    tipoServico: string;
  };
  produtos: PlanoProduto[];
  itens: PlanoItem[];
  textos: {
    objetivo: string;
    solucao: string;
    responsabilidadesContratada: string[];
    responsabilidadesContratante: string[];
    naoIncluso: string[];
    premissas: string[];
    servicosOfertados: { titulo: string; itens: string[] }[];
  };
  totaisInformados: { equipamentos: number | null; servicos: number | null; total: number | null };
  alertas: string[];
}

// ----------------------------------------------------------------------------
// Validação / saneamento do JSON da IA (nunca confiar no formato recebido).
// ----------------------------------------------------------------------------

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

const AREA_IDS = new Set(AREAS_PROPOSTA.map((a) => a.id));
const TIPO_IDS = new Set(TIPOS_SERVICO.map((t) => t.id));

export interface ResultadoValidacao {
  plano: PlanoOrcamentoIA | null;
  erros: string[];
}

/** Converte a resposta crua da IA num plano tipado; erros impedem a revisão. */
export function validarPlano(raw: unknown): ResultadoValidacao {
  const erros: string[] = [];
  const r = obj(raw);
  if (!Object.keys(r).length) return { plano: null, erros: ['A IA não devolveu um plano válido.'] };

  const c = obj(r.cliente);
  const d = obj(r.dados);
  const t = obj(r.textos);
  const tot = obj(r.totaisInformados);

  const produtos: PlanoProduto[] = (Array.isArray(r.produtos) ? r.produtos : []).map((p) => {
    const o = obj(p);
    const acao = (['usar', 'atualizar', 'criar'] as const).includes(o.acao as AcaoProduto) ? (o.acao as AcaoProduto) : 'criar';
    const modelo = str(o.modelo);
    return {
      chave: str(o.chave) || modelo,
      inventoryItemId: strOrNull(o.inventoryItemId),
      acao,
      modelo,
      nome: str(o.nome) || modelo,
      descricao: str(o.descricao),
      marca: str(o.marca),
      categoria: str(o.categoria) || 'OUTROS',
      subcategoria: strOrNull(o.subcategoria),
      unidade: normalizeUnitCode(str(o.unidade) || 'un'),
      custo: num(o.custo),
      venda: num(o.venda),
      codigoFornecedor: strOrNull(o.codigoFornecedor),
    };
  });
  for (const p of produtos) {
    if (!p.chave) erros.push('Há um produto sem modelo/identificação.');
    if (p.acao !== 'criar' && !p.inventoryItemId) erros.push(`Produto "${p.chave}" marcado como existente, mas sem id do estoque.`);
  }

  const chaves = new Set(produtos.map((p) => p.chave));
  const itens: PlanoItem[] = (Array.isArray(r.itens) ? r.itens : []).map((i) => {
    const o = obj(i);
    const tipo = o.tipo === 'servico' ? 'servico' : 'material';
    return {
      tipo,
      produtoChave: tipo === 'material' ? strOrNull(o.produtoChave) : null,
      descricao: str(o.descricao),
      quantidade: num(o.quantidade) ?? 0,
      unidade: normalizeUnitCode(str(o.unidade) || (tipo === 'servico' ? 'vb' : 'un')),
      precoUnitario: roundMoney(num(o.precoUnitario) ?? 0),
      opcional: o.opcional === true,
    };
  });
  if (!itens.length) erros.push('O plano não tem itens.');
  itens.forEach((i, idx) => {
    if (!i.descricao) erros.push(`Item ${idx + 1} sem descrição.`);
    if (i.quantidade <= 0) erros.push(`Item ${idx + 1} ("${i.descricao}") com quantidade inválida.`);
    if (i.produtoChave && !chaves.has(i.produtoChave)) erros.push(`Item ${idx + 1} aponta para um produto que não está no plano (${i.produtoChave}).`);
  });

  const areas = strList(d.areas).filter((a) => AREA_IDS.has(a));
  const tipoServico = TIPO_IDS.has(str(d.tipoServico)) ? str(d.tipoServico) : 'outro';
  const servicosOfertados = (Array.isArray(t.servicosOfertados) ? t.servicosOfertados : [])
    .map((g) => ({ titulo: str(obj(g).titulo), itens: strList(obj(g).itens) }))
    .filter((g) => g.titulo && g.itens.length);

  const plano: PlanoOrcamentoIA = {
    cliente: { clienteId: strOrNull(c.clienteId), nomeInformado: str(c.nomeInformado), candidatosIds: strList(c.candidatosIds) },
    dados: {
      titulo: str(d.titulo),
      local: strOrNull(d.local),
      dataEmissao: /^\d{4}-\d{2}-\d{2}$/.test(str(d.dataEmissao)) ? str(d.dataEmissao) : null,
      validadeDias: num(d.validadeDias),
      prazoExecucao: strOrNull(d.prazoExecucao),
      garantiaServicosDias: num(d.garantiaServicosDias),
      garantiaMateriais: strOrNull(d.garantiaMateriais),
      formaPagamento: strOrNull(d.formaPagamento),
      areas,
      tipoServico,
    },
    produtos,
    itens,
    textos: {
      objetivo: str(t.objetivo),
      solucao: str(t.solucao),
      responsabilidadesContratada: strList(t.responsabilidadesContratada),
      responsabilidadesContratante: strList(t.responsabilidadesContratante),
      naoIncluso: strList(t.naoIncluso),
      premissas: strList(t.premissas),
      servicosOfertados,
    },
    totaisInformados: { equipamentos: num(tot.equipamentos), servicos: num(tot.servicos), total: num(tot.total) },
    alertas: strList(r.alertas),
  };
  if (!plano.dados.titulo) erros.push('O plano não tem título.');
  return { plano, erros };
}

const chaveModelo = (s?: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Corrige as ações de produto contra o estoque REAL (a IA pode errar):
 * id inexistente → procura pelo modelo; "criar" de um modelo que já existe →
 * vira atualização/uso do item existente. Nunca cria duplicado.
 */
export function resolverAcoesProdutos(plano: PlanoOrcamentoIA, inventory: InventoryItem[]): PlanoOrcamentoIA {
  const porId = new Map(inventory.map((i) => [i.id, i]));
  const porModelo = new Map<string, InventoryItem>();
  for (const i of inventory) {
    const k = chaveModelo(i.model);
    if (k && !porModelo.has(k)) porModelo.set(k, i);
  }
  const produtos = plano.produtos.map((p) => {
    const existente = (p.inventoryItemId && porId.get(p.inventoryItemId)) || porModelo.get(chaveModelo(p.modelo));
    if (!existente) return { ...p, inventoryItemId: null, acao: 'criar' as const };
    const custo = p.custo ?? existente.costPrice ?? null;
    const venda = p.venda ?? existente.salePrice ?? null;
    const mudou = (a: number | null, b: number | null | undefined) => a != null && (b == null || Math.abs(a - b) > 0.005);
    const acao: AcaoProduto = mudou(custo, existente.costPrice) || mudou(venda, existente.salePrice) ? 'atualizar' : 'usar';
    return { ...p, inventoryItemId: existente.id, acao, custo, venda };
  });
  return { ...plano, produtos };
}

/**
 * Fase 1.1 — decide se o plano do modo RÁPIDO (Haiku) deve ser refeito no
 * AVANÇADO (Opus). Só falhas que indicam erro da IA (formato/estrutura), nunca
 * inconsistências do próprio texto do usuário (ex.: total digitado errado).
 * Devolve o motivo (para mostrar na tela) ou null.
 */
export function motivoParaEscalar(plano: PlanoOrcamentoIA | null, erros: string[]): string | null {
  if (!plano) return 'a IA rápida não devolveu um plano válido';
  if (erros.length) return 'o plano da IA rápida veio incompleto';
  if (plano.itens.some((i) => i.tipo === 'material' && !i.opcional && !i.produtoChave)) return 'a IA rápida deixou equipamento sem produto vinculado';
  if (!plano.produtos.length && plano.itens.some((i) => i.tipo === 'material')) return 'a IA rápida não identificou os produtos';
  return null;
}

// ----------------------------------------------------------------------------
// Conferência (determinística — não depende da IA).
// ----------------------------------------------------------------------------

export interface ConferenciaPlano {
  equipamentos: number;
  servicos: number;
  total: number;
  /** Soma dos itens opcionais (fora do total). */
  opcionais: number;
  custoEquipamentos: number;
  /** Alertas calculados pelo sistema (somam-se aos alertas da IA). */
  alertas: string[];
}

const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Itens do plano no formato do editor (sem opcionais), para usar a conta oficial. */
function itensParaTotais(plano: PlanoOrcamentoIA): PedidoEquipmentItem[] {
  return plano.itens
    .filter((i) => !i.opcional)
    .map((i, idx) => ({ itemNumero: idx + 1, tipo: i.tipo, descricao: i.descricao, marcaModelo: '', unidade: i.unidade, quantidade: i.quantidade, precoUnitario: i.precoUnitario }));
}

export function conferirPlano(plano: PlanoOrcamentoIA, inventory: InventoryItem[], clients: Pick<Client, 'id'>[]): ConferenciaPlano {
  const alertas: string[] = [];
  const totals = calculateCommercialProposalTotals({ equipmentItems: itensParaTotais(plano) });
  const opcionais = roundMoney(plano.itens.filter((i) => i.opcional).reduce((s, i) => s + lineTotal(i), 0));
  const porChave = new Map(plano.produtos.map((p) => [p.chave, p]));
  const porId = new Map(inventory.map((i) => [i.id, i]));

  let custoEquipamentos = 0;
  for (const it of plano.itens) {
    if (it.opcional || it.tipo !== 'material') continue;
    const p = it.produtoChave ? porChave.get(it.produtoChave) : undefined;
    const custo = p?.custo ?? (p?.inventoryItemId ? porId.get(p.inventoryItemId)?.costPrice : undefined);
    if (custo != null) custoEquipamentos += custo * it.quantidade;
    if (p?.venda != null && Math.abs(p.venda - it.precoUnitario) > 0.005) {
      alertas.push(`"${it.descricao}": preço no orçamento (${brl(it.precoUnitario)}) difere do preço de venda do produto (${brl(p.venda)}).`);
    }
    if (it.tipo === 'material' && !p) alertas.push(`"${it.descricao}" não está vinculado a um produto do estoque.`);
  }

  for (const p of plano.produtos) {
    if (p.inventoryItemId && !porId.has(p.inventoryItemId)) alertas.push(`Produto "${p.modelo}" aponta para um item que não existe no estoque — será tratado como novo.`);
    if (p.custo != null && p.venda != null && p.venda < p.custo) alertas.push(`Produto "${p.modelo}": venda (${brl(p.venda)}) abaixo do custo (${brl(p.custo)}).`);
  }

  const cmp = (rotulo: string, informado: number | null, calculado: number) => {
    if (informado != null && Math.abs(roundMoney(informado) - calculado) > 0.01) {
      alertas.push(`${rotulo} informado (${brl(informado)}) não confere com a soma dos itens (${brl(calculado)}).`);
    }
  };
  cmp('Subtotal de equipamentos', plano.totaisInformados.equipamentos, totals.materialsSubtotal);
  cmp('Subtotal de serviços', plano.totaisInformados.servicos, totals.servicesSubtotal);
  cmp('Total', plano.totaisInformados.total, totals.finalTotal);

  if (!plano.cliente.clienteId) {
    alertas.push(plano.cliente.candidatosIds.length > 1 ? 'Mais de um cliente corresponde ao nome informado — escolha qual usar.' : 'Cliente não encontrado no cadastro — escolha um cliente existente.');
  } else if (!clients.some((c) => c.id === plano.cliente.clienteId)) {
    alertas.push('O cliente indicado pela IA não está no cadastro — escolha um cliente existente.');
  }

  return {
    equipamentos: totals.materialsSubtotal,
    servicos: totals.servicesSubtotal,
    total: totals.finalTotal,
    opcionais,
    custoEquipamentos: roundMoney(custoEquipamentos),
    alertas,
  };
}

// ----------------------------------------------------------------------------
// Produtos: payloads para criar / atualizar no estoque.
// ----------------------------------------------------------------------------

function precificar(custo: number | null, venda: number | null) {
  if (custo == null || venda == null) return null;
  const r = computePricing(custo, 'PRICE', venda);
  return r.price == null ? null : r;
}

function notaCodigoFornecedor(notas: string | undefined, codigo: string | null): string | undefined {
  if (!codigo) return notas;
  const linha = `Código fornecedor: ${codigo}`;
  if ((notas || '').includes(linha)) return notas;
  return [notas?.trim(), linha].filter(Boolean).join('\n');
}

/** Item novo do estoque (saldo 0 — orçamento NÃO lança entrada de estoque). */
export function produtoNovoParaEstoque(p: PlanoProduto): InventoryItem {
  const pr = precificar(p.custo, p.venda);
  return {
    id: '',
    code: p.modelo || p.chave,
    name: p.nome || p.modelo,
    model: p.modelo || undefined,
    brand: p.marca || undefined,
    category: p.categoria,
    subcategory: p.subcategoria || undefined,
    description: p.descricao || undefined,
    unit: normalizeUnitCode(p.unidade),
    quantity: 0,
    minQuantity: 0,
    supplier: '',
    location: '',
    stockManaged: true,
    catalogOnly: false,
    productType: 'EQUIPMENT',
    catalogStatus: 'ATIVO',
    costPrice: pr?.cost ?? p.custo ?? undefined,
    salePrice: pr?.price ?? p.venda ?? undefined,
    unitPrice: pr?.price ?? p.venda ?? 0,
    profitMargin: pr?.margin ?? undefined,
    markup: pr?.markup ?? undefined,
    pricingMode: 'PRICE',
    notes: notaCodigoFornecedor(undefined, p.codigoFornecedor),
  };
}

/** Atualização de preço/cadastro de um item existente (nunca toca o saldo). */
export function produtoAtualizadoParaEstoque(atual: InventoryItem, p: PlanoProduto): InventoryItem {
  const pr = precificar(p.custo ?? atual.costPrice ?? null, p.venda ?? atual.salePrice ?? null);
  return {
    ...atual,
    brand: atual.brand || p.marca || undefined,
    description: atual.description || p.descricao || undefined,
    unit: atual.unit || normalizeUnitCode(p.unidade),
    costPrice: pr?.cost ?? atual.costPrice,
    salePrice: pr?.price ?? atual.salePrice,
    unitPrice: pr?.price ?? atual.unitPrice,
    profitMargin: pr?.margin ?? atual.profitMargin,
    markup: pr?.markup ?? atual.markup,
    pricingMode: pr ? 'PRICE' : atual.pricingMode,
    notes: notaCodigoFornecedor(atual.notes, p.codigoFornecedor),
  };
}

// ----------------------------------------------------------------------------
// Número do pedido e montagem do rascunho.
// ----------------------------------------------------------------------------

/** Próximo PED-AAAA-N: maior número já usado no ano + 1 (respeita o contador local). */
export function proximoNumeroPedido(pedidos: Pick<Pedido, 'numeroPedido'>[], ano: number, minimo = 0): string {
  const prefixo = `PED-${ano}-`;
  const maior = pedidos.reduce((m, p) => {
    if (!p.numeroPedido?.startsWith(prefixo)) return m;
    const n = Number(p.numeroPedido.slice(prefixo.length));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `${prefixo}${Math.max(maior + 1, minimo)}`;
}

export interface ContextoMontagem {
  cliente: Pick<Client, 'id' | 'name'>;
  /** chave do produto no plano → id do item no estoque (após criar/atualizar). */
  idsPorChave: Record<string, string>;
  numeroPedido: string;
  responsavelNome: string;
  /** ISO de agora (injetável para teste). */
  agora: string;
  /** Data padrão quando o plano não traz uma (YYYY-MM-DD). */
  hoje: string;
}

function montarEscopo(plano: PlanoOrcamentoIA): string {
  const partes: string[] = [];
  if (plano.dados.local) partes.push(`Local: ${plano.dados.local}`);
  if (plano.textos.solucao) partes.push(`Solução\n\n${plano.textos.solucao}`);
  const opcionais = plano.itens.filter((i) => i.opcional);
  if (opcionais.length) {
    const linhas = opcionais.map((i) => {
      const qtd = i.quantidade !== 1 ? `${i.quantidade} × ` : '';
      return `${qtd}${i.descricao} — ${brl(lineTotal(i))}`;
    });
    const base = calculateCommercialProposalTotals({ equipmentItems: itensParaTotais(plano) }).finalTotal;
    const extra = roundMoney(opcionais.reduce((s, i) => s + lineTotal(i), 0));
    partes.push(`Itens opcionais (não inclusos no valor total)\n\n${linhas.join('\n')}\n\nValor total com os opcionais: ${brl(roundMoney(base + extra))}.`);
  }
  return partes.join('\n\n');
}

function montarGarantia(plano: PlanoOrcamentoIA): { warranty: StructuredWarranty; texto: string } {
  const w = defaultWarranty();
  if (plano.dados.garantiaServicosDias != null && plano.dados.garantiaServicosDias > 0) {
    w.maoDeObra = { enabled: true, mode: 'dias', value: Math.round(plano.dados.garantiaServicosDias) };
  }
  if (plano.dados.garantiaMateriais) {
    w.materiais = { enabled: true, mode: 'personalizado', textoPersonalizado: plano.dados.garantiaMateriais };
  }
  const mao = w.maoDeObra.mode === 'dias' ? `${w.maoDeObra.value} dias` : '';
  const mat = w.materiais.mode === 'personalizado' ? w.materiais.textoPersonalizado || '' : `${w.materiais.value} meses`;
  return { warranty: w, texto: [mao && `Mão de obra: ${mao}`, mat && `Materiais/equipamentos: ${mat}`].filter(Boolean).join('. ') };
}

/** Monta o Pedido (rascunho, tipo Orçamento) a partir do plano aprovado. */
export function montarPedidoDoPlano(plano: PlanoOrcamentoIA, ctx: ContextoMontagem): Pedido {
  const porChave = new Map(plano.produtos.map((p) => [p.chave, p]));
  const equipmentItems: PedidoEquipmentItem[] = plano.itens
    .filter((i) => !i.opcional)
    .map((i, idx) => {
      const p = i.produtoChave ? porChave.get(i.produtoChave) : undefined;
      const vinculo = i.produtoChave ? ctx.idsPorChave[i.produtoChave] : undefined;
      const item: PedidoEquipmentItem = {
        itemNumero: idx + 1,
        tipo: i.tipo,
        descricao: i.descricao,
        marcaModelo: p ? [p.marca, p.modelo].filter(Boolean).join(' · ') : '',
        unidade: i.unidade,
        quantidade: i.quantidade,
        precoUnitario: i.precoUnitario,
      };
      if (i.tipo === 'material' && vinculo) item.vinculoEstoqueId = vinculo;
      return item;
    });

  const temMaterial = equipmentItems.some((i) => i.tipo !== 'servico');
  const temServico = equipmentItems.some((i) => i.tipo === 'servico');
  const modalidade = temMaterial && !temServico ? 'somente_material' : temServico && !temMaterial ? 'servico' : 'material_servico';
  const areaPrincipal = plano.dados.areas.length ? plano.dados.areas : ['outro'];
  const tipoServico = plano.dados.tipoServico;
  const totals = calculateCommercialProposalTotals({ equipmentItems, onlyMaterials: modalidade === 'somente_material' });
  const { warranty, texto: garantia } = montarGarantia(plano);

  const textos: Record<string, string[]> = {};
  for (const s of SECOES_TEXTO) textos[s.campo] = s.padrao();
  const servicosOfertados = plano.textos.servicosOfertados.length ? plano.textos.servicosOfertados : servicosOfertadosPadrao();
  const secaoFonte: Record<string, 'padrao' | 'personalizado'> = {};
  for (const s of SECOES_TEXTO) secaoFonte[s.key] = fonteDaSecaoLista(s.campo, textos[s.campo]);
  secaoFonte.servicos = fonteServicos(servicosOfertados);
  secaoFonte.carta = 'padrao';

  const formaPagamento = plano.dados.formaPagamento || '';
  const proposal: CommercialProposalData = {
    schemaVersion: COMMERCIAL_SCHEMA_VERSION,
    pedidoTipo: 'orcamento',
    modalidade,
    nivelProposta: 'tecnica',
    areaPrincipal,
    tipoServico,
    tituloManual: plano.dados.titulo,
    tituloEditadoManualmente: true,
    referenciaEditadaManualmente: true,
    experienciaAuto: true,
    objetivo: plano.textos.objetivo,
    cartaApresentacao: CARTA_APRESENTACAO.join('\n'),
    diretrizesNormativas: getNormativeReferences({ areaPrincipal, tipoServico, modalidade }),
    diretrizesEditadasManualmente: false,
    escopoServico: montarEscopo(plano),
    entregaveis: [],
    premissas: plano.textos.premissas,
    incluso: [],
    naoIncluso: plano.textos.naoIncluso,
    slaTabela: [],
    prazoExecucao: plano.dados.prazoExecucao || '',
    garantia,
    warranty,
    validadePropostaDias: plano.dados.validadeDias && plano.dados.validadeDias > 0 ? Math.round(plano.dados.validadeDias) : 15,
    validadePropostaComplemento: 'dias corridos a partir da emissão',
    conclusao: 'Permanecemos à disposição para eventuais esclarecimentos adicionais e renovamos nossos votos de estima.',
    equipmentItems,
    marcas: [],
    responsabilidadesContratada: plano.textos.responsabilidadesContratada,
    responsabilidadesContratante: plano.textos.responsabilidadesContratante,
    valorTotal: totals.finalTotal,
    valorTotalManual: null,
    recorrente: false,
    maoDeObra: 0,
    composicaoValor: '',
    formaPagamento,
    formasPagamento: [],
    condicoesPagamento: formaPagamento ? [formaPagamento] : [],
    faturamento: '',
    impostos: 'Inclusos, Simples Nacional (Anexo III)',
    incluirMultas: true,
    incluirLimitacao: true,
    incluirConfidencialidade: true,
    incluirCondicoesGerais: true,
    incluirSeguranca: true,
    incluirTermoAceite: true,
    embalagemTransporteTexto: textos.embalagemTransporteTexto,
    segurancaTrabalhoTexto: textos.segurancaTrabalhoTexto,
    precosObsTexto: textos.precosObsTexto,
    impostosObsTexto: textos.impostosObsTexto,
    multasAtrasoTexto: textos.multasAtrasoTexto,
    limitacaoRespTexto: textos.limitacaoRespTexto,
    confidencialidadeTexto: textos.confidencialidadeTexto,
    termoAceiteTexto: textos.termoAceiteTexto,
    condicoesGeraisTexto: textos.condicoesGeraisTexto,
    servicosOfertados,
    textosMaterializados: true,
    secaoFonte,
  };

  return {
    id: `ped_${Date.parse(ctx.agora) || Date.now()}`,
    numeroPedido: ctx.numeroPedido,
    referencia: plano.dados.titulo,
    clienteId: ctx.cliente.id,
    clienteNome: ctx.cliente.name,
    fornecedor: 'Fireowl Controls Ltda.',
    dataEmissao: plano.dados.dataEmissao || ctx.hoje,
    responsavelComercialId: 'u1',
    responsavelComercialNome: ctx.responsavelNome,
    status: 'rascunho',
    proposal,
    createdAt: ctx.agora,
    updatedAt: ctx.agora,
  };
}
