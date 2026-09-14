import { describe, it, expect } from 'vitest';
import { resolveDocumentoPadrao, DEFAULT_DOC_BY_PEDIDO_TIPO } from './documentos';
import { CommercialProposalData, DocumentosPadrao, Pedido, PedidoTipo } from './types';

/**
 * Emissão a partir do Pedido: o TIPO DE PEDIDO é a fonte de verdade do documento
 * (mapa canônico), eliminando o modal "Qual documento gerar?". Ver
 * [[modalidade-somente-material]] e resolveDocumentoPadrao.
 */

function ped(tipo?: PedidoTipo, over: Partial<CommercialProposalData> = {}): Pedido {
  const proposal = {
    pedidoTipo: tipo,
    objetivo: '', diretrizesNormativas: [], escopoServico: '', entregaveis: [], premissas: [],
    prazoExecucao: '', garantia: '', validadePropostaDias: 15, conclusao: '',
    equipmentItems: [], marcas: [], responsabilidadesContratada: [], responsabilidadesContratante: [],
    valorTotal: 0, composicaoValor: '', formaPagamento: '', faturamento: '', impostos: '',
    ...over,
  } as CommercialProposalData;
  return {
    id: 'ped_1', numeroPedido: 'PED-1', referencia: '', clienteId: 'c', clienteNome: 'Cliente',
    fornecedor: '', dataEmissao: '2026-09-14', responsavelComercialId: '', responsavelComercialNome: '',
    status: 'rascunho', proposal, createdAt: '', updatedAt: '',
  };
}

describe('resolveDocumentoPadrao — Tipo de Pedido é a fonte de verdade', () => {
  it('mapa canônico cobre todos os tipos', () => {
    expect(DEFAULT_DOC_BY_PEDIDO_TIPO).toEqual({
      orcamento: 'orcamento',
      proposta: 'proposta_comercial',
      servico: 'proposta_comercial',
      fornecimento: 'orcamento',
      laudo: 'laudo_tecnico',
    });
  });

  it('Orçamento → orcamento (sem config da empresa)', () => {
    expect(resolveDocumentoPadrao(ped('orcamento'), undefined)).toBe('orcamento');
  });

  it('Proposta comercial → proposta_comercial', () => {
    expect(resolveDocumentoPadrao(ped('proposta'), {})).toBe('proposta_comercial');
  });

  it('Fornecimento de materiais → orcamento (documento enxuto quando somente_material)', () => {
    expect(resolveDocumentoPadrao(ped('fornecimento'), undefined)).toBe('orcamento');
    // Modalidade NÃO altera o roteamento do documento (separação preservada).
    expect(resolveDocumentoPadrao(ped('fornecimento', { modalidade: 'somente_material' }), undefined)).toBe('orcamento');
  });

  it('Serviço/Manutenção → proposta_comercial', () => {
    expect(resolveDocumentoPadrao(ped('servico'), undefined)).toBe('proposta_comercial');
  });

  it('Laudo/Inspeção → laudo_tecnico', () => {
    expect(resolveDocumentoPadrao(ped('laudo'), undefined)).toBe('laudo_tecnico');
  });

  it('Tipo não definido → null (bloqueia emissão, não abre modal)', () => {
    expect(resolveDocumentoPadrao(ped(undefined), undefined)).toBeNull();
    expect(resolveDocumentoPadrao(ped(undefined), {})).toBeNull();
  });

  it('override da empresa (Conta → PDF) vence o canônico', () => {
    const config: DocumentosPadrao = { orcamento: 'nota_produtos' };
    expect(resolveDocumentoPadrao(ped('orcamento'), config)).toBe('nota_produtos');
  });

  it("override 'nenhum' cai no canônico (nunca vira null com tipo definido)", () => {
    const config: DocumentosPadrao = { orcamento: 'nenhum' };
    expect(resolveDocumentoPadrao(ped('orcamento'), config)).toBe('orcamento');
  });

  it('modalidade é independente do Tipo: material_servico não muda o documento', () => {
    expect(resolveDocumentoPadrao(ped('orcamento', { modalidade: 'material_servico' }), undefined)).toBe('orcamento');
    expect(resolveDocumentoPadrao(ped('proposta', { modalidade: 'somente_material' }), undefined)).toBe('proposta_comercial');
  });
});
