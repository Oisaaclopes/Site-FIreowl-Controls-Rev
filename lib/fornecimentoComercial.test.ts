import { describe, it, expect } from 'vitest';
import { calculateCommercialProposalTotals, freteValor, impostosAdicionaisValor } from './commercialTotals';
import { normalizeCommercialProposalData } from './commercialProposal';
import {
  MODALIDADE_LABELS,
  modalidadeEfetiva,
  isSomenteMaterial,
  freteCondicaoTexto,
  impostosCondicaoTexto,
} from './fornecimentoComercial';
import { CommercialProposalData, PedidoEquipmentItem } from './types';

/**
 * Modalidade SOMENTE MATERIAL — cálculo determinístico e rótulos.
 * Ver [[commercialTotals]] e [[FornecimentoMateriaisDocument]].
 */

const materiais: PedidoEquipmentItem[] = [
  { itemNumero: 1, descricao: 'Detector', marcaModelo: 'X', unidade: 'un', quantidade: 10, precoUnitario: 100, tipo: 'material' },
  { itemNumero: 2, descricao: 'Sirene', marcaModelo: 'Y', unidade: 'un', quantidade: 5, precoUnitario: 200, tipo: 'material' },
];
const comServico: PedidoEquipmentItem[] = [
  ...materiais,
  { itemNumero: 3, descricao: 'Instalação', marcaModelo: '', unidade: 'vb', quantidade: 1, precoUnitario: 800, tipo: 'servico' },
];

describe('commercialTotals — frete e impostos (SOMENTE MATERIAL)', () => {
  it('subtotal de produtos = soma dos itens materiais', () => {
    const t = calculateCommercialProposalTotals({ equipmentItems: materiais, onlyMaterials: true });
    expect(t.materialsSubtotal).toBe(2000); // 10*100 + 5*200
    expect(t.calculatedTotal).toBe(2000);
    expect(t.finalTotal).toBe(2000);
  });

  it('frete "valor" soma no total; incluso/a combinar/não incluso NÃO somam', () => {
    const base = { equipmentItems: materiais, onlyMaterials: true } as const;
    expect(calculateCommercialProposalTotals({ ...base, frete: { modo: 'valor', valor: 250 } }).calculatedTotal).toBe(2250);
    expect(calculateCommercialProposalTotals({ ...base, frete: { modo: 'incluso' } }).calculatedTotal).toBe(2000);
    expect(calculateCommercialProposalTotals({ ...base, frete: { modo: 'a_combinar' } }).calculatedTotal).toBe(2000);
    expect(calculateCommercialProposalTotals({ ...base, frete: { modo: 'nao_incluso' } }).calculatedTotal).toBe(2000);
  });

  it('imposto adicional "valor" soma; inclusos/não inclusos NÃO somam', () => {
    const base = { equipmentItems: materiais, onlyMaterials: true } as const;
    expect(calculateCommercialProposalTotals({ ...base, impostosAdicionais: { modo: 'valor', valor: 100 } }).calculatedTotal).toBe(2100);
    expect(calculateCommercialProposalTotals({ ...base, impostosAdicionais: { modo: 'inclusos' } }).calculatedTotal).toBe(2000);
    expect(calculateCommercialProposalTotals({ ...base, impostosAdicionais: { modo: 'nao_inclusos' } }).calculatedTotal).toBe(2000);
  });

  it('frete + imposto + desconto compõem o total geral de forma determinística', () => {
    const comDesc: PedidoEquipmentItem[] = [
      { ...materiais[0], desconto: 150 }, // 1000 - 150 = 850
      materiais[1], // 1000
    ];
    const t = calculateCommercialProposalTotals({
      equipmentItems: comDesc,
      onlyMaterials: true,
      frete: { modo: 'valor', valor: 250 },
      impostosAdicionais: { modo: 'valor', valor: 100 },
    });
    expect(t.discountTotal).toBe(150);
    expect(t.materialsSubtotal).toBe(1850); // líquido do desconto
    expect(t.materialsSubtotal + t.discountTotal).toBe(2000); // bruto dos produtos
    expect(t.calculatedTotal).toBe(2200); // 1850 + 250 + 100
  });

  it('material-only ignora serviços e mão de obra (mas não os apaga)', () => {
    const t = calculateCommercialProposalTotals({ equipmentItems: comServico, maoDeObra: 500, onlyMaterials: true });
    expect(t.servicesSubtotal).toBe(800); // ainda calculado…
    expect(t.itemsSubtotal).toBe(2000); // …mas não entra no subtotal
    expect(t.maoDeObra).toBe(0);
    expect(t.calculatedTotal).toBe(2000);
  });

  it('sem onlyMaterials, serviços e mão de obra entram (comportamento histórico)', () => {
    const t = calculateCommercialProposalTotals({ equipmentItems: comServico, maoDeObra: 500 });
    expect(t.itemsSubtotal).toBe(2800); // 2000 + 800
    expect(t.calculatedTotal).toBe(3300); // + 500 mão de obra
  });

  it('frete "incluso" não duplica no total', () => {
    const t = calculateCommercialProposalTotals({ equipmentItems: materiais, onlyMaterials: true, frete: { modo: 'incluso' } });
    expect(t.freteTotal).toBe(0);
    expect(t.calculatedTotal).toBe(2000);
  });

  it('override manual vence sobre o calculado', () => {
    const t = calculateCommercialProposalTotals({ equipmentItems: materiais, onlyMaterials: true, frete: { modo: 'valor', valor: 250 }, valorTotalManual: 9999 });
    expect(t.finalTotal).toBe(9999);
  });

  it('helpers freteValor/impostosValor só reagem ao modo "valor"', () => {
    expect(freteValor({ modo: 'valor', valor: 30 })).toBe(30);
    expect(freteValor({ modo: 'incluso' })).toBe(0);
    expect(impostosAdicionaisValor({ modo: 'valor', valor: 12.5 })).toBe(12.5);
    expect(impostosAdicionaisValor({ modo: 'nao_inclusos' })).toBe(0);
  });
});

describe('normalizeCommercialProposalData — modalidade material-only', () => {
  const baseProposal = (over: Partial<CommercialProposalData>): CommercialProposalData => ({
    objetivo: '', diretrizesNormativas: [], escopoServico: '', entregaveis: [], premissas: [],
    prazoExecucao: '', garantia: '', validadePropostaDias: 15, conclusao: '',
    equipmentItems: comServico, marcas: [], responsabilidadesContratada: [], responsabilidadesContratante: [],
    valorTotal: 0, composicaoValor: '', formaPagamento: '', faturamento: '', impostos: '',
    ...over,
  });

  it('material-only: valorTotal considera só materiais + frete, sem virar "override histórico"', () => {
    const p = normalizeCommercialProposalData(baseProposal({
      modalidade: 'somente_material',
      frete: { modo: 'valor', valor: 250 },
      valorTotal: 2250,
    }));
    expect(p.valorTotalManual).toBeNull(); // não deve inferir override
    expect(p.valorTotal).toBe(2250); // 2000 materiais + 250 frete
  });

  it('sem modalidade: comportamento histórico (serviços contam)', () => {
    const p = normalizeCommercialProposalData(baseProposal({ valorTotal: 2800 }));
    expect(p.valorTotalManual).toBeNull();
    expect(p.valorTotal).toBe(2800);
  });
});

describe('rótulos e frases da modalidade', () => {
  it('rótulos das três modalidades', () => {
    expect(MODALIDADE_LABELS.servico).toBe('Serviço');
    expect(MODALIDADE_LABELS.material_servico).toBe('Material + Serviço');
    expect(MODALIDADE_LABELS.somente_material).toBe('Somente Material');
  });

  it('modalidadeEfetiva/isSomenteMaterial', () => {
    expect(modalidadeEfetiva(undefined)).toBe('material_servico');
    expect(isSomenteMaterial('somente_material')).toBe(true);
    expect(isSomenteMaterial(undefined)).toBe(false);
  });

  it('frase de frete por modo', () => {
    expect(freteCondicaoTexto({ modo: 'incluso' })).toMatch(/incluso/i);
    expect(freteCondicaoTexto({ modo: 'a_combinar' })).toMatch(/combinar/i);
    expect(freteCondicaoTexto({ modo: 'valor', valor: 250 })).toMatch(/R\$/);
    expect(freteCondicaoTexto(undefined)).toBeNull();
  });

  it('frase de impostos por modo', () => {
    expect(impostosCondicaoTexto({ modo: 'inclusos' })).toMatch(/inclusos/i);
    expect(impostosCondicaoTexto({ modo: 'valor', valor: 50 })).toMatch(/R\$/);
    expect(impostosCondicaoTexto(undefined)).toBeNull();
  });
});
