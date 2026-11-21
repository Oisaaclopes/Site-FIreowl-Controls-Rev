import { describe, it, expect } from 'vitest';
import path from 'node:path';
import React from 'react';
import { Font, renderToBuffer } from '@react-pdf/renderer';
import { OrcamentoDocument } from './OrcamentoDocument';
import { LaudoTecnicoDocument } from './LaudoTecnicoDocument';
import { PersonalizadoDocument } from './PersonalizadoDocument';
import { defaultWarranty } from '../../lib/commercialWarranty';
import { SECAO_KEYS, alternarSecao, secoesPadraoDoTipo } from '../../lib/documentoSecoes';
import { CommercialProposalData, Pedido, CompanyProfile } from '../../lib/types';

/**
 * Smoke de render (Node) das seções personalizáveis do documento do Pedido
 * ([[lib/documentoSecoes]]): Orçamento com seções extras, Laudo com seções
 * comerciais e o tipo Personalizado montado do zero. Também confere que pedido
 * antigo (sem `secoesDocumento`) segue com o mesmo nº de páginas.
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
// Textos itálicos sem família explícita caem em Helvetica (no navegador é a
// fonte embutida); aqui a sobrescrevemos com Roboto, inclusive o itálico.
Font.register({ family: 'Helvetica', fonts: [
  { src: fontFile('Roboto-Regular.ttf') },
  { src: fontFile('Roboto-Bold.ttf'), fontWeight: 700 },
  { src: fontFile('Roboto-Italic.ttf'), fontStyle: 'italic' },
]});

const company: CompanyProfile = {
  razaoSocial: 'Fireowl Controls Ltda.', nomeFantasia: 'Fireowl Controls', cnpj: '00.000.000/0001-00',
  endereco: 'Londrina/PR', telefone: '', email: '', regimeTributario: 'Simples Nacional',
};

function pedido(over: Partial<CommercialProposalData>): Pedido {
  const proposal: CommercialProposalData = {
    schemaVersion: 2, areaPrincipal: ['sdai'], tipoServico: 'instalacao',
    objetivo: 'Objetivo', diretrizesNormativas: ['ABNT NBR 17240'], escopoServico: 'Escopo detalhado',
    entregaveis: ['ART registrada', 'As-built'], premissas: ['Acesso liberado'], incluso: ['Instalação'], naoIncluso: ['Obra civil'],
    prazoExecucao: '10 dias', garantia: '', warranty: defaultWarranty(),
    validadePropostaDias: 15, conclusao: 'Conclusão',
    equipmentItems: [
      { itemNumero: 1, descricao: 'Detector', marcaModelo: 'Y', unidade: 'un', quantidade: 20, precoUnitario: 100, tipo: 'material' },
      { itemNumero: 2, descricao: 'Integração', marcaModelo: '', unidade: 'h', quantidade: 2.5, precoUnitario: 200, tipo: 'servico' },
    ],
    marcas: [], responsabilidadesContratada: ['Equipe'], responsabilidadesContratante: ['Energia'],
    valorTotal: 2500, composicaoValor: '', formaPagamento: 'Pix', faturamento: 'NF', impostos: 'Inclusos',
    ...over,
  };
  return {
    id: 'ped_smoke', numeroPedido: 'PED-2026-0001', referencia: 'Ref', clienteId: 'c1', clienteNome: 'Cliente X',
    fornecedor: 'Fireowl Controls Ltda.', dataEmissao: '2026-09-02', responsavelComercialId: '', responsavelComercialNome: 'Isaac',
    status: 'rascunho', proposal, createdAt: '', updatedAt: '',
  };
}

const isPdf = (b: Buffer) => b.slice(0, 5).toString('latin1') === '%PDF-' && b.length > 1000;
const pages = (b: Buffer) => (b.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
const orc = (p: Pedido) => renderToBuffer(<OrcamentoDocument pedido={p} companyProfile={company} options={{ showCapa: false }} />);

describe('Seções do documento — render (Node smoke)', () => {
  it('Orçamento antigo (sem seleção) e com o padrão explícito renderizam', async () => {
    const antigo = await orc(pedido({ pedidoTipo: 'orcamento' }));
    const padrao = await orc(pedido({ pedidoTipo: 'orcamento', secoesDocumento: secoesPadraoDoTipo('orcamento') }));
    expect(isPdf(antigo)).toBe(true);
    expect(isPdf(padrao)).toBe(true);
    expect(pages(padrao)).toBe(pages(antigo));
  }, 30000);

  it('Orçamento com todas as seções (premissas, entregáveis, cláusulas…) cresce', async () => {
    const antigo = await orc(pedido({ pedidoTipo: 'orcamento' }));
    const todas = await orc(pedido({ pedidoTipo: 'orcamento', secoesDocumento: [...SECAO_KEYS] }));
    expect(isPdf(todas)).toBe(true);
    expect(pages(todas)).toBeGreaterThan(pages(antigo));
  }, 30000);

  it('Orçamento com seções desligadas renderiza', async () => {
    const sel = alternarSecao(alternarSecao(secoesPadraoDoTipo('orcamento'), 'precos', false), 'garantia', false);
    expect(isPdf(await orc(pedido({ pedidoTipo: 'orcamento', secoesDocumento: sel })))).toBe(true);
  }, 30000);

  it('Orçamento: Objetivo em Não, Diretrizes em Sim, só Lista de Serviços e ordem trocada', async () => {
    const b = await orc(pedido({ pedidoTipo: 'orcamento', secoesDocumento: ['normas', 'itensServicos', 'premissas', 'garantia'], ordemSecoes: ['garantia', 'premissas', 'normas'] }));
    expect(isPdf(b)).toBe(true);
  }, 30000);

  it('Laudo com ordem própria e Diretrizes sem Objetivo renderiza', async () => {
    const b = await renderToBuffer(<LaudoTecnicoDocument pedido={pedido({ pedidoTipo: 'laudo', secoesDocumento: ['normas', 'conclusao', 'itens'], ordemSecoes: ['conclusao', 'itens'] })} companyProfile={company} />);
    expect(isPdf(b)).toBe(true);
  }, 30000);

  it('Laudo com seções comerciais extras renderiza', async () => {
    const b = await renderToBuffer(<LaudoTecnicoDocument pedido={pedido({ pedidoTipo: 'laudo', secoesDocumento: ['visao', 'premissas', 'garantia'] })} companyProfile={company} />);
    expect(isPdf(b)).toBe(true);
  }, 30000);

  it('Personalizado: vazio e montado do zero', async () => {
    const data = { titulo: 'Documento X', campos: [], incluirItens: false, incluirAssinatura: true };
    const vazio = await renderToBuffer(<PersonalizadoDocument pedido={pedido({ pedidoTipo: 'personalizado', secoesDocumento: [] })} companyProfile={company} data={data} />);
    const cheio = await renderToBuffer(<PersonalizadoDocument pedido={pedido({ pedidoTipo: 'personalizado', secoesDocumento: [...SECAO_KEYS] })} companyProfile={company} data={data} />);
    expect(isPdf(vazio)).toBe(true);
    expect(isPdf(cheio)).toBe(true);
    expect(pages(cheio)).toBeGreaterThan(pages(vazio));
  }, 30000);
});
