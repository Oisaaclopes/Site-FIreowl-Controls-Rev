import { describe, it, expect } from 'vitest';
import path from 'node:path';
import React from 'react';
import { Font, renderToBuffer } from '@react-pdf/renderer';
import { FornecimentoMateriaisDocument } from './FornecimentoMateriaisDocument';
import { OrcamentoDocument } from './OrcamentoDocument';
import { CommercialProposalData, Pedido, CompanyProfile } from '../../lib/types';

/**
 * Smoke de render (Node) do documento SOMENTE MATERIAL (Orçamento Comercial de
 * Fornecimento). Confirma que a variação por modalidade renderiza PDF válido —
 * inclusive a delegação a partir do OrcamentoDocument.
 */

const fontFile = (f: string) => path.resolve(process.cwd(), 'public/fonts', f);
Font.clear();
Font.register({ family: 'Roboto', fonts: [
  { src: fontFile('Roboto-Regular.ttf') },
  { src: fontFile('Roboto-Bold.ttf'), fontWeight: 700 },
  { src: fontFile('Roboto-Italic.ttf'), fontStyle: 'italic' },
]});
Font.register({ family: 'Poppins', fonts: [
  { src: fontFile('Poppins-SemiBold.ttf'), fontWeight: 600 },
  { src: fontFile('Poppins-Bold.ttf'), fontWeight: 700 },
]});
Font.register({ family: 'Helvetica', fonts: [
  { src: fontFile('Roboto-Regular.ttf') },
  { src: fontFile('Roboto-Bold.ttf'), fontWeight: 700 },
]});

const company: CompanyProfile = {
  razaoSocial: 'Fireowl Controls Ltda.', nomeFantasia: 'Fireowl Controls', cnpj: '00.000.000/0001-00',
  endereco: 'Londrina/PR', telefone: '', email: '', regimeTributario: 'Simples Nacional',
};
const opts = { showCapa: false } as const;

function pedido(over: Partial<CommercialProposalData>): Pedido {
  const proposal: CommercialProposalData = {
    schemaVersion: 2, modalidade: 'somente_material',
    objetivo: '', diretrizesNormativas: [], escopoServico: '', entregaveis: [], premissas: [],
    prazoExecucao: 'Até 10 dias úteis', garantia: '', validadePropostaDias: 10, conclusao: '',
    equipmentItems: [
      { itemNumero: 1, descricao: 'Detector de fumaça', descricaoDetalhada: 'Óptico', marcaModelo: 'Bosch · FAP-425', unidade: 'un', quantidade: 20, precoUnitario: 100, tipo: 'material' },
      { itemNumero: 2, descricao: 'Sirene', marcaModelo: 'X', unidade: 'un', quantidade: 5, precoUnitario: 200, desconto: 100, tipo: 'material' },
      // serviço cadastrado: deve ser preservado no pedido, mas NÃO aparecer no doc
      { itemNumero: 3, descricao: 'Instalação', marcaModelo: '', unidade: 'vb', quantidade: 1, precoUnitario: 500, tipo: 'servico' },
    ],
    marcas: [], responsabilidadesContratada: [], responsabilidadesContratante: [],
    valorTotal: 0, composicaoValor: '', formaPagamento: 'Pix', faturamento: '', impostos: '',
    formasPagamento: ['Pix'], condicoesPagamento: ['À vista'],
    frete: { modo: 'valor', valor: 250 },
    impostosAdicionais: { modo: 'inclusos' },
    observacoesComerciais: 'Disponibilidade sujeita à confirmação.',
    ...over,
  };
  return {
    id: 'ped_fornec', numeroPedido: 'PED-2026-0009', referencia: 'Venda de materiais', clienteId: 'c1', clienteNome: 'Cliente X',
    fornecedor: 'Fireowl Controls Ltda.', dataEmissao: '2026-09-10', responsavelComercialId: '', responsavelComercialNome: 'Isaac',
    status: 'rascunho', proposal, createdAt: '', updatedAt: '',
  };
}
const isPdf = (b: Buffer) => b.slice(0, 5).toString('latin1') === '%PDF-' && b.length > 1000;

describe('SOMENTE MATERIAL — render (Node smoke)', () => {
  it('documento de fornecimento renderiza PDF válido', async () => {
    const buf = await renderToBuffer(<FornecimentoMateriaisDocument pedido={pedido({})} companyProfile={company} options={opts} />);
    expect(isPdf(buf)).toBe(true);
  }, 30000);

  it('OrcamentoDocument delega para o documento enxuto quando modalidade = somente_material', async () => {
    const buf = await renderToBuffer(<OrcamentoDocument pedido={pedido({})} companyProfile={company} options={opts} />);
    expect(isPdf(buf)).toBe(true);
  }, 30000);

  it('poucos produtos, sem frete/impostos, sem observações — ainda renderiza', async () => {
    const buf = await renderToBuffer(
      <FornecimentoMateriaisDocument
        pedido={pedido({ frete: { modo: 'incluso' }, impostosAdicionais: { modo: 'inclusos' }, observacoesComerciais: undefined, equipmentItems: [
          { itemNumero: 1, descricao: 'Bateria 12V 7Ah', marcaModelo: 'Z', unidade: 'un', quantidade: 2, precoUnitario: 90, tipo: 'material' },
        ] })}
        companyProfile={company}
        options={opts}
      />
    );
    expect(isPdf(buf)).toBe(true);
  }, 30000);
});
