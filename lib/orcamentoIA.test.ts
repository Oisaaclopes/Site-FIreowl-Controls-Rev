import { describe, expect, it } from 'vitest';
import type { InventoryItem } from './types';
import {
  conferirPlano,
  montarPedidoDoPlano,
  motivoParaEscalar,
  produtoAtualizadoParaEstoque,
  produtoNovoParaEstoque,
  proximoNumeroPedido,
  resolverAcoesProdutos,
  validarPlano,
} from './orcamentoIA';

const EQUIP: [string, number, number, number][] = [
  ['AMT 8000 PRO', 686.34, 892.24, 1],
  ['XG 4G', 314.23, 408.5, 1],
  ['XAT 8000', 313.29, 407.28, 1],
  ['IVP 8000 EX', 414.9, 539.37, 8],
  ['IVP 8000 MW PET', 192.62, 250.41, 8],
  ['XSS 8000', 255.14, 331.68, 2],
  ['REP 8000', 316.4, 411.32, 1],
  ['XAC 8000', 81.18, 105.53, 4],
];
const SERV: [string, number][] = [
  ['Levantamento técnico', 650],
  ['Instalação e fixação', 3200],
  ['Programação da central', 900],
  ['Testes e comissionamento', 1100],
  ['Orientação operacional', 450],
  ['Documentação técnica', 1200],
];

const inventario: InventoryItem[] = [
  { id: 'inv-amt', code: 'AMT 8000 PRO', model: 'AMT 8000 PRO', name: 'Central', category: 'ALARME', quantity: 3, minQuantity: 0, unitPrice: 0, supplier: '', location: '' },
  { id: 'inv-xss', code: 'XSS 8000', model: 'XSS-8000', name: 'Sirene', category: 'ALARME', quantity: 0, minQuantity: 0, unitPrice: 331.68, supplier: '', location: '', costPrice: 255.14, salePrice: 331.68 },
];

function planoAtlas(extra: Record<string, unknown> = {}) {
  return {
    cliente: { clienteId: 'c_atlas', nomeInformado: 'Atlas', candidatosIds: [] },
    dados: {
      titulo: 'Sistema de Alarme Patrimonial sem fio – Academia e Guarita',
      local: 'Academia e Guarita',
      dataEmissao: '2026-11-25',
      validadeDias: 15,
      prazoExecucao: 'Até 3 dias úteis em campo.',
      garantiaServicosDias: 90,
      garantiaMateriais: 'Conforme garantia do fabricante Intelbras',
      formaPagamento: '50% na aprovação e 50% na entrega do sistema comissionado',
      areas: ['alarme', 'inexistente'],
      tipoServico: 'instalacao',
    },
    produtos: EQUIP.map(([m, custo, venda]) => ({
      chave: m, inventoryItemId: null, acao: 'criar', modelo: m, nome: m, descricao: '', marca: 'Intelbras', categoria: 'ALARME', subcategoria: null, unidade: 'UN', custo, venda, codigoFornecedor: '4543589',
    })),
    itens: [
      ...EQUIP.map(([m, , venda, qtd]) => ({ tipo: 'material', produtoChave: m, descricao: m, quantidade: qtd, unidade: 'un', precoUnitario: venda, opcional: false })),
      ...SERV.map(([d, v]) => ({ tipo: 'servico', produtoChave: null, descricao: d, quantidade: 1, unidade: 'vb', precoUnitario: v, opcional: false })),
      { tipo: 'servico', produtoChave: null, descricao: 'Instalação do repetidor REP 8000', quantidade: 1, unidade: 'vb', precoUnitario: 450, opcional: true },
    ],
    textos: {
      objetivo: 'Fornecimento e instalação de alarme.', solucao: 'Central na guarita.',
      responsabilidadesContratada: ['Instalar'], responsabilidadesContratante: ['Ponto elétrico'], naoIncluso: ['Obras civis'], premissas: ['Horário comercial'],
      servicosOfertados: [{ titulo: 'Instalação', itens: ['Instalação e fixação'] }],
    },
    totaisInformados: { equipamentos: 9523.06, servicos: 7500, total: 17023.06 },
    alertas: ['REP 8000 condicional está somado no total.'],
    ...extra,
  };
}

describe('validarPlano', () => {
  it('normaliza áreas, unidades e mantém o plano tipado', () => {
    const { plano, erros } = validarPlano(planoAtlas());
    expect(erros).toEqual([]);
    expect(plano!.dados.areas).toEqual(['alarme']);
    expect(plano!.produtos[0].unidade).toBe('un');
    expect(plano!.itens.filter((i) => i.opcional)).toHaveLength(1);
  });

  it('aponta item que referencia produto fora do plano e plano vazio', () => {
    const p = planoAtlas();
    (p.itens as any[])[0].produtoChave = 'NAO-EXISTE';
    expect(validarPlano(p).erros.join(' ')).toContain('NAO-EXISTE');
    expect(validarPlano(null).plano).toBeNull();
  });
});

describe('conferirPlano', () => {
  it('soma como o editor e deixa o opcional fora do total', () => {
    const { plano } = validarPlano(planoAtlas());
    const c = conferirPlano(plano!, [], [{ id: 'c_atlas' }]);
    expect(c.equipamentos).toBe(9523.06);
    expect(c.servicos).toBe(7500);
    expect(c.total).toBe(17023.06);
    expect(c.opcionais).toBe(450);
    expect(c.custoEquipamentos).toBe(7325.42);
    expect(c.alertas).toEqual([]);
  });

  it('alerta total informado divergente e cliente ausente', () => {
    const { plano } = validarPlano(planoAtlas({ totaisInformados: { equipamentos: null, servicos: null, total: 17473.06 }, cliente: { clienteId: null, nomeInformado: 'Atlas', candidatosIds: ['a', 'b'] } }));
    const c = conferirPlano(plano!, [], []);
    expect(c.alertas.some((a) => a.includes('Total informado'))).toBe(true);
    expect(c.alertas.some((a) => a.includes('Mais de um cliente'))).toBe(true);
  });
});

describe('resolverAcoesProdutos', () => {
  it('nunca cria duplicado: modelo existente vira atualizar/usar', () => {
    const { plano } = validarPlano(planoAtlas());
    const r = resolverAcoesProdutos(plano!, inventario);
    const amt = r.produtos.find((p) => p.chave === 'AMT 8000 PRO')!;
    const xss = r.produtos.find((p) => p.chave === 'XSS 8000')!;
    const xg = r.produtos.find((p) => p.chave === 'XG 4G')!;
    expect(amt).toMatchObject({ inventoryItemId: 'inv-amt', acao: 'atualizar' });
    expect(xss).toMatchObject({ inventoryItemId: 'inv-xss', acao: 'usar' });
    expect(xg).toMatchObject({ inventoryItemId: null, acao: 'criar' });
  });
});

describe('produtos para o estoque', () => {
  it('novo produto entra com saldo 0, markup 1,30 e código do fornecedor nas notas', () => {
    const { plano } = validarPlano(planoAtlas());
    const item = produtoNovoParaEstoque(plano!.produtos[0]);
    expect(item).toMatchObject({ quantity: 0, costPrice: 686.34, salePrice: 892.24, markup: 1.3, profitMargin: 23.08, pricingMode: 'PRICE', brand: 'Intelbras' });
    expect(item.notes).toBe('Código fornecedor: 4543589');
  });

  it('atualização preserva o saldo e não duplica a nota', () => {
    const { plano } = validarPlano(planoAtlas());
    const atual = { ...inventario[0], notes: 'Código fornecedor: 4543589' };
    const upd = produtoAtualizadoParaEstoque(atual, plano!.produtos[0]);
    expect(upd.quantity).toBe(3);
    expect(upd.salePrice).toBe(892.24);
    expect(upd.notes).toBe('Código fornecedor: 4543589');
  });
});

describe('montarPedidoDoPlano', () => {
  it('gera rascunho de orçamento com vínculo ao estoque e opcional só no escopo', () => {
    const { plano } = validarPlano(planoAtlas());
    const ids = Object.fromEntries(EQUIP.map(([m]) => [m, `id-${m}`]));
    const ped = montarPedidoDoPlano(plano!, {
      cliente: { id: 'c_atlas', name: 'ATLAS' }, idsPorChave: ids, numeroPedido: 'PED-2026-349',
      responsavelNome: 'Teste', agora: '2026-11-25T12:00:00.000Z', hoje: '2026-11-25',
    });
    expect(ped.status).toBe('rascunho');
    expect(ped.proposal.pedidoTipo).toBe('orcamento');
    expect(ped.proposal.modalidade).toBe('material_servico');
    expect(ped.proposal.valorTotal).toBe(17023.06);
    expect(ped.proposal.equipmentItems).toHaveLength(14);
    expect(ped.proposal.equipmentItems[0]).toMatchObject({ vinculoEstoqueId: 'id-AMT 8000 PRO', marcaModelo: 'Intelbras · AMT 8000 PRO' });
    expect(ped.proposal.escopoServico).toContain('Local: Academia e Guarita');
    expect(ped.proposal.escopoServico).toContain('Itens opcionais (não inclusos no valor total)');
    expect(ped.proposal.escopoServico).toContain('R$ 17.473,06');
    expect(ped.proposal.warranty).toMatchObject({ maoDeObra: { mode: 'dias', value: 90 }, materiais: { mode: 'personalizado' } });
    expect(ped.proposal.textosMaterializados).toBe(true);
    expect(ped.proposal.condicoesGeraisTexto?.length).toBeGreaterThan(0);
    expect(ped.proposal.diretrizesNormativas.join(' ')).toContain('NBR 5410');
  });
});

describe('motivoParaEscalar', () => {
  it('não escala plano bom, mesmo com total digitado errado pelo usuário', () => {
    const { plano, erros } = validarPlano(planoAtlas({ totaisInformados: { equipamentos: 1, servicos: null, total: null } }));
    expect(motivoParaEscalar(plano, erros)).toBeNull();
  });

  it('escala plano inválido, incompleto ou com equipamento sem produto', () => {
    expect(motivoParaEscalar(null, ['x'])).toMatch(/não devolveu/);
    const ruim = planoAtlas();
    (ruim.itens as any[])[0].produtoChave = 'NAO-EXISTE';
    const v = validarPlano(ruim);
    expect(motivoParaEscalar(v.plano, v.erros)).toMatch(/incompleto/);
    const semVinculo = planoAtlas();
    (semVinculo.itens as any[])[0].produtoChave = null;
    const s = validarPlano(semVinculo);
    expect(motivoParaEscalar(s.plano, s.erros)).toMatch(/sem produto/);
  });
});

describe('proximoNumeroPedido', () => {
  it('usa o maior número do ano + 1, respeitando o contador local', () => {
    const ps = [{ numeroPedido: 'PED-2026-347' }, { numeroPedido: 'PED-2026-348' }, { numeroPedido: 'PED-2025-900' }];
    expect(proximoNumeroPedido(ps, 2026)).toBe('PED-2026-349');
    expect(proximoNumeroPedido(ps, 2026, 400)).toBe('PED-2026-400');
  });
});
