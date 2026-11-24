import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultWarranty } from '../../lib/commercialWarranty';
import { SECAO_KEYS, alternarSecao, flagDaSecao, igualAoPadrao, secoesPadraoDoTipo, SecaoDocKey, FlagsSecoes } from '../../lib/documentoSecoes';
import { CommercialProposalData, Pedido, CompanyProfile } from '../../lib/types';

/**
 * Regressão: seção posta em "Não" no editor NÃO pode sair no PDF.
 * O react-pdf vira HTML simples para lermos o texto do documento (só a lógica
 * de quais seções entram; o layout real é coberto pelos smokes de render).
 */
vi.mock('@react-pdf/renderer', () => {
  // Só o texto importa: descarta estilos/props do react-pdf (e o `render` dos fixos).
  const box = (tag: string) => {
    const Box = ({ children }: { children?: React.ReactNode }) => React.createElement(tag, null, children);
    Box.displayName = `Pdf(${tag})`;
    return Box;
  };
  const vazio = () => null;
  return {
    Document: box('div'), Page: box('section'), View: box('div'), Text: box('span'), Link: box('span'),
    Svg: vazio, Path: vazio, Line: vazio, Rect: vazio, Circle: vazio, G: vazio, Polygon: vazio, Polyline: vazio, Defs: vazio, LinearGradient: vazio, Stop: vazio, Image: vazio,
    StyleSheet: { create: <T,>(s: T) => s },
    Font: { register: () => {}, registerHyphenationCallback: () => {}, clear: () => {} },
  };
});

const { PropostaDocument } = await import('./PropostaDocument');
const { OrcamentoDocument } = await import('../documentos/OrcamentoDocument');

const company: CompanyProfile = {
  razaoSocial: 'Fireowl Controls Ltda.', nomeFantasia: 'Fireowl Controls', cnpj: '00.000.000/0001-00',
  endereco: 'Londrina/PR', telefone: '', email: '', regimeTributario: 'Simples Nacional',
};

function pedido(over: Partial<CommercialProposalData>): Pedido {
  const proposal: CommercialProposalData = {
    schemaVersion: 2, areaPrincipal: ['sdai'], tipoServico: 'instalacao',
    objetivo: 'Objetivo', diretrizesNormativas: ['ABNT NBR 17240'], escopoServico: 'Escopo detalhado',
    entregaveis: ['ART registrada'], premissas: ['Acesso liberado'], incluso: ['Instalação'], naoIncluso: ['Obra civil'],
    prazoExecucao: '10 dias', garantia: '', warranty: defaultWarranty(),
    validadePropostaDias: 15, conclusao: 'Conclusão',
    equipmentItems: [
      { itemNumero: 1, descricao: 'Detector', marcaModelo: 'Y', unidade: 'un', quantidade: 2, precoUnitario: 100, tipo: 'material' },
      { itemNumero: 2, descricao: 'Integração', marcaModelo: '', unidade: 'h', quantidade: 1, precoUnitario: 200, tipo: 'servico' },
    ],
    marcas: [], responsabilidadesContratada: ['Equipe'], responsabilidadesContratante: ['Energia'],
    valorTotal: 400, composicaoValor: '', formaPagamento: 'Pix', faturamento: 'NF', impostos: 'Inclusos',
    ...over,
  };
  return {
    id: 'ped_t', numeroPedido: 'PED-2026-0001', referencia: 'Ref', clienteId: 'c1', clienteNome: 'Cliente X',
    fornecedor: 'Fireowl Controls Ltda.', dataEmissao: '2026-09-02', responsavelComercialId: '', responsavelComercialNome: 'Isaac',
    status: 'rascunho', proposal, createdAt: '', updatedAt: '',
  };
}

/**
 * Reproduz o que o editor grava ao pôr uma seção em "Não" (setSecao + payload):
 * flag `incluirX`, o acoplamento Termo de Aceite → Aceite e a regra de só gravar
 * a lista quando difere do padrão do tipo.
 */
function desligarNoEditor(tipo: 'proposta' | 'servico' | 'orcamento', key: SecaoDocKey): Partial<CommercialProposalData> {
  const flags: FlagsSecoes = {};
  const flag = flagDaSecao(key);
  if (flag) flags[flag] = false;
  let sel = alternarSecao(secoesPadraoDoTipo(tipo, {}), key, false);
  if (key === 'termoAceite') sel = alternarSecao(sel, 'aceite', false);
  return { pedidoTipo: tipo, ...flags, secoesDocumento: igualAoPadrao(sel, tipo, flags) ? undefined : sel };
}

const texto = (el: React.ReactElement) => renderToStaticMarkup(el).replace(/<[^>]+>/g, '\n').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
const proposta = (over: Partial<CommercialProposalData>) => texto(<PropostaDocument pedido={pedido(over)} companyProfile={company} options={{}} />);
const orcamento = (over: Partial<CommercialProposalData>, options: Record<string, unknown> = {}) =>
  texto(<OrcamentoDocument pedido={pedido(over)} companyProfile={company} options={{ showCapa: false, ...options }} />);
const contar = (t: string, s: string) => t.split(s).length - 1;

describe('Seção em "Não" não sai no PDF', () => {
  it.each(['proposta', 'servico'] as const)('%s: Termo de Aceite em Não tira o termo e o bloco final de aceite', (tipo) => {
    const base = proposta({ pedidoTipo: tipo });
    expect(base).toContain('Termo de Aceite da Proposta');
    expect(base).toContain('De acordo & Aceite da Proposta');
    const off = proposta(desligarNoEditor(tipo, 'termoAceite'));
    expect(off).not.toContain('Termo de Aceite da Proposta');
    expect(off).not.toContain('Aceite da Proposta');
  });

  it('Proposta: só o Aceite (assinaturas) em Não mantém o Termo', () => {
    const off = proposta(desligarNoEditor('proposta', 'aceite'));
    expect(off).toContain('Termo de Aceite da Proposta');
    expect(off).not.toContain('De acordo & Aceite da Proposta');
  });

  it('Proposta: cada seção em Não tira algo do documento', () => {
    const todas = [...SECAO_KEYS];
    const linhas = (t: string) => t.split('\n').filter(Boolean).length;
    const base = linhas(proposta({ pedidoTipo: 'proposta', secoesDocumento: todas, textosMaterializados: false }));
    for (const k of SECAO_KEYS) {
      const off = linhas(proposta({ pedidoTipo: 'proposta', secoesDocumento: todas.filter((x) => x !== k), textosMaterializados: false }));
      expect(off, k).toBeLessThan(base);
    }
  });

  it('Orçamento antigo (sem seleção) segue com uma assinatura', () => {
    expect(contar(orcamento({ pedidoTipo: 'orcamento' }), 'De acordo & Aceite')).toBe(1);
  });

  it('Orçamento: Aceite em Sim sai uma vez só; em Não não sai', () => {
    const padrao = secoesPadraoDoTipo('orcamento');
    expect(padrao).toContain('aceite');
    expect(contar(orcamento({ pedidoTipo: 'orcamento', secoesDocumento: [...SECAO_KEYS] }), 'De acordo & Aceite')).toBe(1);
    expect(orcamento(desligarNoEditor('orcamento', 'aceite'))).not.toContain('De acordo & Aceite');
    expect(orcamento(desligarNoEditor('orcamento', 'termoAceite'))).not.toContain('De acordo & Aceite');
  });

  it('Orçamento: opção "sem assinatura do cliente" também vale com seleção', () => {
    expect(orcamento({ pedidoTipo: 'orcamento', secoesDocumento: [...SECAO_KEYS] }, { showAssinaturaCliente: false })).not.toContain('De acordo & Aceite');
  });
});
