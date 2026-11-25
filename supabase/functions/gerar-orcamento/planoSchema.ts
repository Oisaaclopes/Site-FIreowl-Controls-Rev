// Formato fixo do PLANO de orçamento.
// Módulo PURO: usado pela Edge Function e testado no Vitest.
//
// Histórico (25/11/2026): com structured outputs (output_config.format) a API
// recusou este schema — primeiro por 17 uniões (limite 16) e depois por
// "compiled grammar is too large". Por isso o schema vai DESCRITO no prompt e a
// resposta é lida por extrairJson(); quem garante o formato é validarPlano()
// (lib/orcamentoIA.ts) e, se falhar, a tela sobe para a IA avançada.

const AREAS = ['sdai', 'cftv', 'acesso', 'alarme', 'bms', 'integracao', 'seguranca', 'engenharia', 'outro'];
const TIPOS = ['manut_corretiva', 'manut_preventiva', 'contrato_manut', 'contrato_inspecao', 'inspecao', 'instalacao', 'implantacao', 'retrofit', 'adequacao', 'projeto', 'comissionamento', 'integracao_serv', 'fornecimento', 'outro'];

const S = { type: 'string' } as const;
const SN = { type: ['string', 'null'] } as const;
const NN = { type: ['number', 'null'] } as const;
const LIST = { type: 'array', items: S } as const;
const objeto = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

// Formato fixo do plano (structured outputs). Espelha lib/orcamentoIA.ts.
// A API aceita no máximo 16 campos com união de tipos (nullable): textos
// opcionais usam string VAZIA ("" = não informado); só números ficam nullable.
export const PLANO_SCHEMA = objeto({
  cliente: objeto({ clienteId: SN, nomeInformado: S, candidatosIds: LIST }),
  dados: objeto({
    titulo: S,
    local: S,
    dataEmissao: S,
    validadeDias: NN,
    prazoExecucao: S,
    garantiaServicosDias: NN,
    garantiaMateriais: S,
    formaPagamento: S,
    areas: { type: 'array', items: { type: 'string', enum: AREAS } },
    tipoServico: { type: 'string', enum: TIPOS },
  }),
  produtos: {
    type: 'array',
    items: objeto({
      chave: S,
      inventoryItemId: S,
      acao: { type: 'string', enum: ['usar', 'atualizar', 'criar'] },
      modelo: S,
      nome: S,
      descricao: S,
      marca: S,
      categoria: S,
      subcategoria: S,
      unidade: S,
      custo: NN,
      venda: NN,
      codigoFornecedor: S,
    }),
  },
  itens: {
    type: 'array',
    items: objeto({
      tipo: { type: 'string', enum: ['material', 'servico'] },
      produtoChave: S,
      descricao: S,
      quantidade: { type: 'number' },
      unidade: S,
      precoUnitario: { type: 'number' },
      opcional: { type: 'boolean' },
    }),
  },
  textos: objeto({
    objetivo: S,
    solucao: S,
    responsabilidadesContratada: LIST,
    responsabilidadesContratante: LIST,
    naoIncluso: LIST,
    premissas: LIST,
    servicosOfertados: { type: 'array', items: objeto({ titulo: S, itens: LIST }) },
  }),
  totaisInformados: objeto({ equipamentos: NN, servicos: NN, total: NN }),
  alertas: LIST,
});

/**
 * Extrai o objeto JSON da resposta em texto do modelo (tolera cercas ```json e
 * texto antes/depois). Devolve null se não houver JSON válido.
 */
export function extrairJson(texto: string): unknown {
  const semCerca = texto.replace(/```(?:json)?/gi, '');
  const ini = semCerca.indexOf('{');
  const fim = semCerca.lastIndexOf('}');
  if (ini < 0 || fim <= ini) return null;
  try {
    return JSON.parse(semCerca.slice(ini, fim + 1));
  } catch {
    return null;
  }
}
