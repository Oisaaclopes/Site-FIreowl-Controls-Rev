import { describe, it, expect } from 'vitest';
import path from 'node:path';
import React from 'react';
import { Font, renderToBuffer } from '@react-pdf/renderer';
import { OrcamentoDocument } from './OrcamentoDocument';
import { defaultWarranty, StructuredWarranty } from '../../lib/commercialWarranty';
import { CommercialProposalData, Pedido, CompanyProfile } from '../../lib/types';

/**
 * Smoke de render (Node) do documento comercial. Exercita, ponta a ponta, o
 * caminho de renderização comercial compartilhado (normalizeCommercialProposalData
 * → renderWarranty → unidade canônica → total final). Usa o OrcamentoDocument:
 * ele consome exatamente o mesmo domínio comercial do PropostaDocument, e a capa
 * institucional do PropostaDocument depende de fontes/vetores que o harness de
 * fontes do Node não mede (limitação pré-existente, alheia a esta mudança).
 * A validação visual do PDF de Proposta é feita manualmente (ver checklist).
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
    schemaVersion: 2, areaPrincipal: ['sdai'], tipoServico: 'instalacao',
    objetivo: 'Objetivo', diretrizesNormativas: ['ABNT NBR 17240'], escopoServico: 'Escopo',
    entregaveis: ['ART'], premissas: ['Acesso liberado'], prazoExecucao: '10 dias', garantia: '',
    validadePropostaDias: 15, conclusao: 'Conclusão',
    equipmentItems: [
      { itemNumero: 1, descricao: 'Cabo de incêndio', marcaModelo: 'X', unidade: 'm', quantidade: 150.5, precoUnitario: 4, tipo: 'material' },
      { itemNumero: 2, descricao: 'Detector', marcaModelo: 'Y', unidade: 'un', quantidade: 20, precoUnitario: 100, tipo: 'material' },
      { itemNumero: 3, descricao: 'Integração', marcaModelo: '', unidade: 'h', quantidade: 2.5, precoUnitario: 200, tipo: 'servico' },
    ],
    marcas: [], responsabilidadesContratada: ['Equipe'], responsabilidadesContratante: ['Energia'],
    valorTotal: 3102, composicaoValor: '', formaPagamento: 'Pix', faturamento: 'NF', impostos: 'Inclusos',
    ...over,
  };
  return {
    id: 'ped_smoke', numeroPedido: 'PED-2026-0001', referencia: 'Ref', clienteId: 'c1', clienteNome: 'Cliente X',
    fornecedor: 'Fireowl Controls Ltda.', dataEmissao: '2026-09-02', responsavelComercialId: '', responsavelComercialNome: 'Isaac',
    status: 'rascunho', proposal, createdAt: '', updatedAt: '',
  };
}
const render = (p: Pedido) => renderToBuffer(<OrcamentoDocument pedido={p} companyProfile={company} options={opts} />);
const isPdf = (b: Buffer) => b.slice(0, 5).toString('latin1') === '%PDF-' && b.length > 1000;

describe('Documento comercial render (Node smoke)', () => {
  it('garantia estruturada + quantidade decimal (m, h) renderiza', async () => {
    expect(isPdf(await render(pedido({ warranty: defaultWarranty() })))).toBe(true);
  }, 30000);

  it('garantia legada (string) renderiza — compat. proposta antiga', async () => {
    expect(isPdf(await render(pedido({ garantia: '90 dias mão de obra / 12 meses produto', warranty: undefined, schemaVersion: undefined })))).toBe(true);
  }, 30000);

  it('garantia desabilitada — renderiza sem a seção de garantia', async () => {
    const semGarantia: StructuredWarranty = {
      maoDeObra: { enabled: false, mode: 'dias', value: 90 },
      materiais: { enabled: false, mode: 'meses', value: 12 },
    };
    expect(isPdf(await render(pedido({ warranty: semGarantia })))).toBe(true);
  }, 30000);

  it('total override (valor comercial final) renderiza', async () => {
    expect(isPdf(await render(pedido({ warranty: defaultWarranty(), valorTotal: 5000, valorTotalManual: 5000 })))).toBe(true);
  }, 30000);
});
