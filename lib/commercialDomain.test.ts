import { describe, expect, it } from 'vitest';
import {
  COMMERCIAL_UNITS, normalizeUnitCode, unitAllowsDecimals, normalizeQuantity,
  isCanonicalUnit, formatUnitDisplay, groupCommercialUnits, quantityUnitError,
  searchCommercialUnits, UNIT_CATEGORY_LABELS, UNIT_CATEGORY_ORDER,
  validateCustomUnit, registerCustomUnit, getCustomUnits, allUnits, unitByCode,
} from './commercialUnits';
import {
  defaultWarranty, normalizeCommercialWarranty, renderWarranty, isLegacyWarranty,
  isStructuredWarranty, warrantyHasEnabledButEmptyLeg, StructuredWarranty,
} from './commercialWarranty';
import {
  calculateCommercialProposalTotals, roundMoney, lineTotal,
} from './commercialTotals';
import { normalizeCommercialProposalData, COMMERCIAL_SCHEMA_VERSION } from './commercialProposal';
import type { CommercialProposalData, PedidoEquipmentItem } from './types';

const item = (o: Partial<PedidoEquipmentItem>): PedidoEquipmentItem => ({
  itemNumero: 1, descricao: '', marcaModelo: '', unidade: 'un', quantidade: 1, precoUnitario: 0, ...o,
});
const proposal = (o: Partial<CommercialProposalData>): CommercialProposalData => ({
  objetivo: '', diretrizesNormativas: [], escopoServico: '', entregaveis: [], premissas: [],
  prazoExecucao: '', garantia: '', validadePropostaDias: 15, conclusao: '', equipmentItems: [],
  marcas: [], responsabilidadesContratada: [], responsabilidadesContratante: [], valorTotal: 0,
  composicaoValor: '', formaPagamento: '', faturamento: '', impostos: '', ...o,
});

/* ---------------------------------------------------------------- Unidades */
describe('unidades canônicas', () => {
  it('catálogo tem siglas únicas', () => {
    const codes = COMMERCIAL_UNITS.map((u) => u.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
  it('(5) produto em un — inteiro, sem decimais', () => {
    expect(normalizeUnitCode('un')).toBe('un');
    expect(unitAllowsDecimals('un')).toBe(false);
    expect(normalizeQuantity(3.7, 'un')).toBe(4);
  });
  it('(6) cabo em m — aceita decimais', () => {
    expect(normalizeUnitCode('metros')).toBe('m');
    expect(unitAllowsDecimals('m')).toBe(true);
  });
  it('(7) quantidade decimal preservada em m', () => {
    expect(normalizeQuantity(150.5, 'm')).toBe(150.5);
    expect(normalizeQuantity(2.5, 'h')).toBe(2.5);
    expect(normalizeQuantity(7.25, 'kg')).toBe(7.25);
  });
  it('(8) unidade não fracionável bloqueia decimal', () => {
    expect(normalizeQuantity(2.5, 'un')).toBe(3);
    expect(normalizeQuantity(1.2, 'vb')).toBe(1);
  });
  it('aliases previsíveis normalizam para sigla', () => {
    expect(normalizeUnitCode('UN')).toBe('un');
    expect(normalizeUnitCode('Unidade')).toBe('un');
    expect(normalizeUnitCode('UN - Unidade')).toBe('un');
    expect(normalizeUnitCode('metro')).toBe('m');
    expect(normalizeUnitCode('M2')).toBe('m²');
    expect(normalizeUnitCode('litro')).toBe('L');
    expect(normalizeUnitCode('VB')).toBe('vb');
    expect(normalizeUnitCode('verba')).toBe('vb');
  });
  it('m² e m³ e L canônicos passam intactos', () => {
    expect(normalizeUnitCode('m²')).toBe('m²');
    expect(normalizeUnitCode('m³')).toBe('m³');
    expect(normalizeUnitCode('L')).toBe('L');
    expect(isCanonicalUnit('m²')).toBe(true);
  });
  it('valor desconhecido é preservado (não descartado)', () => {
    expect(normalizeUnitCode('xyz')).toBe('xyz');
    expect(isCanonicalUnit('xyz')).toBe(false);
    expect(formatUnitDisplay('xyz')).toBe('xyz');
  });
  it('vazio → un', () => {
    expect(normalizeUnitCode('')).toBe('un');
    expect(normalizeUnitCode(undefined)).toBe('un');
  });
  it('agrupa na ordem oficial com labels PT-BR', () => {
    const groups = groupCommercialUnits();
    // 'personalizado' só aparece quando há unidades custom (vazio em Node).
    const catsComBase = UNIT_CATEGORY_ORDER.filter((c) => c !== 'personalizado');
    expect(groups.map((group) => group.category)).toEqual(catsComBase);
    expect(groups.map((group) => group.label)).toEqual(catsComBase.map((category) => UNIT_CATEGORY_LABELS[category]));
    expect(groups.find((group) => group.category === 'tempo')?.units.map((unit) => unit.code)).toContain('visita');
    expect(groups.find((group) => group.category === 'comercial')?.units.map((unit) => unit.code)).toEqual(['vb']);
  });
  it('busca por label e sigla ignora caixa e acentos', () => {
    expect(searchCommercialUnits('METRO').map((unit) => unit.code)).toEqual(expect.arrayContaining(['mm', 'cm', 'm', 'km', 'm²', 'm³']));
    expect(searchCommercialUnits('quilometro').map((unit) => unit.code)).toContain('km');
    expect(searchCommercialUnits('kg').map((unit) => unit.code)).toEqual(['kg']);
    expect(searchCommercialUnits('litro').map((unit) => unit.code)).toEqual(expect.arrayContaining(['mL', 'L']));
  });
  it('(16) unidade personalizada não duplica canônica (direto ou por alias)', () => {
    expect(validateCustomUnit('Metro', 'm').ok).toBe(false);
    expect(validateCustomUnit('Metro', 'm').canonicalSuggestion).toBe('m');
    // alias também é barrado e orienta à sigla canônica
    const viaAlias = validateCustomUnit('Unidade', 'unidade');
    expect(viaAlias.ok).toBe(false);
    expect(viaAlias.canonicalSuggestion).toBe('un');
  });
  it('unidade personalizada válida registra, aparece no grupo e respeita allowDecimals', () => {
    const v = validateCustomUnit('  Ponto  ', ' pt ');
    expect(v).toMatchObject({ ok: true, code: 'pt', label: 'Ponto' });
    registerCustomUnit({ code: v.code!, label: v.label!, allowDecimals: false });
    expect(getCustomUnits().some((u) => u.code === 'pt')).toBe(true);
    expect(unitByCode('pt')?.category).toBe('personalizado');
    expect(allUnits().some((u) => u.code === 'pt')).toBe(true);
    // allowDecimals=false → decimal é rejeitado; código preservado
    expect(normalizeUnitCode('pt')).toBe('pt');
    expect(unitAllowsDecimals('pt')).toBe(false);
    expect(quantityUnitError(2.5, 'pt')).toContain("'pt'");
    // aparece no grupo Personalizado do seletor
    expect(groupCommercialUnits().find((g) => g.category === 'personalizado')?.units.map((u) => u.code)).toContain('pt');
    // uma personalizada decimal aceita fração
    registerCustomUnit({ code: 'bob', label: 'Bobina', allowDecimals: true });
    expect(quantityUnitError(2.5, 'bob')).toBeNull();
  });
  it('sigla/nome vazios ou grandes demais são rejeitados', () => {
    expect(validateCustomUnit('', 'pt').ok).toBe(false);
    expect(validateCustomUnit('Ponto', '').ok).toBe(false);
    expect(validateCustomUnit('Ponto', 'abcdefghi').ok).toBe(false); // >8
  });
  it('troca decimal para unidade inteira informa erro sem arredondar', () => {
    expect(quantityUnitError(2.5, 'un')).toBe("A unidade 'un' aceita somente quantidades inteiras.");
    expect(quantityUnitError(2.5, 'm')).toBeNull();
    expect(normalizeUnitCode('Metro')).toBe('m');
  });
});

/* ---------------------------------------------------------------- Garantia */
describe('garantia estruturada', () => {
  it('(1) proposta antiga com garantia string vira modo legado, texto preservado', () => {
    const w = normalizeCommercialWarranty('90 dias mão de obra / 12 meses produto');
    expect(isLegacyWarranty(w)).toBe(true);
    const r = renderWarranty(w);
    expect(r.legacyText).toBe('90 dias mão de obra / 12 meses produto');
    expect(r.hasAny).toBe(true);
  });
  it('(2) proposta nova com garantia estruturada renderiza pernas', () => {
    const w = defaultWarranty();
    expect(isStructuredWarranty(w)).toBe(true);
    const r = renderWarranty(w);
    expect(r.maoDeObra).toBe('90 dias');
    expect(r.materiais).toBe('12 meses');
    expect(r.hasAny).toBe(true);
  });
  it('(3) garantia desabilitada não aparece', () => {
    const w: StructuredWarranty = {
      maoDeObra: { enabled: false, mode: 'dias', value: 90 },
      materiais: { enabled: false, mode: 'meses', value: 12 },
    };
    const r = renderWarranty(w);
    expect(r.hasAny).toBe(false);
    expect(r.maoDeObra).toBeUndefined();
    expect(r.materiais).toBeUndefined();
  });
  it('(4) garantia personalizada usa exatamente o texto informado', () => {
    const w: StructuredWarranty = {
      maoDeObra: { enabled: true, mode: 'personalizado', textoPersonalizado: '5 anos totais' },
      materiais: { enabled: true, mode: 'fabricante' },
    };
    const r = renderWarranty(w);
    expect(r.maoDeObra).toBe('5 anos totais');
    expect(r.materiais).toBe('Conforme garantia do fabricante');
  });
  it('default de garantia é fonte única (90 dias / 12 meses)', () => {
    const w = defaultWarranty();
    expect(w.maoDeObra).toEqual({ enabled: true, mode: 'dias', value: 90 });
    expect(w.materiais).toEqual({ enabled: true, mode: 'meses', value: 12 });
  });
  it('perna ativa sem condição válida é sinalizada', () => {
    const w: StructuredWarranty = {
      maoDeObra: { enabled: true, mode: 'personalizado', textoPersonalizado: '' },
      materiais: { enabled: true, mode: 'meses', value: 12 },
    };
    expect(warrantyHasEnabledButEmptyLeg(w)).toBe(true);
  });
  it('string vazia → legado vazio, seção some', () => {
    const r = renderWarranty(normalizeCommercialWarranty(''));
    expect(r.hasAny).toBe(false);
  });
});

/* ----------------------------------------------------------------- Preços */
describe('formação de preço — fonte única', () => {
  it('roundMoney evita erro de ponto flutuante', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(1.005)).toBe(1.01);
  });
  it('lineTotal = preço×qtd − desconto, nunca negativo', () => {
    expect(lineTotal({ precoUnitario: 10, quantidade: 3, desconto: 5 })).toBe(25);
    expect(lineTotal({ precoUnitario: 10, quantidade: 1, desconto: 50 })).toBe(0);
  });
  it('quantidade decimal entra no cálculo', () => {
    expect(lineTotal({ precoUnitario: 4, quantidade: 150.5 })).toBe(602);
  });
  it('(11) total calculado = itens + mão de obra', () => {
    const t = calculateCommercialProposalTotals({
      equipmentItems: [item({ precoUnitario: 100, quantidade: 2, tipo: 'material' }), item({ precoUnitario: 50, quantidade: 1, tipo: 'servico' })],
      maoDeObra: 30,
    });
    expect(t.materialsSubtotal).toBe(200);
    expect(t.servicesSubtotal).toBe(50);
    expect(t.calculatedTotal).toBe(280);
    expect(t.finalTotal).toBe(280);
    expect(t.manualOverride).toBeNull();
  });
  it('(12) override é respeitado', () => {
    const t = calculateCommercialProposalTotals({
      equipmentItems: [item({ precoUnitario: 100, quantidade: 2 })],
      valorTotalManual: 175,
    });
    expect(t.calculatedTotal).toBe(200);
    expect(t.manualOverride).toBe(175);
    expect(t.finalTotal).toBe(175);
  });
});

/* ------------------------------------------------------ Normalizador proposal */
describe('normalizeCommercialProposalData', () => {
  it('(19) proposal v1 (garantia string) normaliza p/ legado, sem quebrar', () => {
    const p = normalizeCommercialProposalData(proposal({ garantia: '90 dias / 12 meses', valorTotal: 0 }));
    expect(isLegacyWarranty(p.warranty)).toBe(true);
    expect(p.schemaVersion).toBe(1);
    expect(p.valorTotalManual).toBeNull();
  });
  it('(20) proposal v2 (garantia estruturada + override) normaliza', () => {
    const p = normalizeCommercialProposalData(proposal({
      schemaVersion: 2, warranty: defaultWarranty(), valorTotalManual: 999, valorTotal: 999,
      equipmentItems: [item({ precoUnitario: 100, quantidade: 2 })],
    }));
    expect(isStructuredWarranty(p.warranty)).toBe(true);
    expect(p.schemaVersion).toBe(2);
    expect(p.valorTotalManual).toBe(999);
    expect(p.valorTotal).toBe(999);
  });
  it('(13) recupera override histórico não-sinalizado ao reabrir', () => {
    // v1: total gravado (175) diverge do calculado (200) → infere override.
    const p = normalizeCommercialProposalData(proposal({
      valorTotal: 175, equipmentItems: [item({ precoUnitario: 100, quantidade: 2 })],
    }));
    expect(p.valorTotalManual).toBe(175);
    expect(p.valorTotal).toBe(175);
  });
  it('não infere override quando total gravado bate com o calculado', () => {
    const p = normalizeCommercialProposalData(proposal({
      valorTotal: 200, equipmentItems: [item({ precoUnitario: 100, quantidade: 2 })],
    }));
    expect(p.valorTotalManual).toBeNull();
  });
  it('(14) round-trip: normalizar 2x é estável', () => {
    const raw = proposal({
      schemaVersion: 2, warranty: defaultWarranty(), valorTotalManual: 500, valorTotal: 500,
      equipmentItems: [item({ precoUnitario: 100, quantidade: 2, unidade: 'm' })],
    });
    const once = normalizeCommercialProposalData(raw);
    const twice = normalizeCommercialProposalData(once);
    expect(twice.warranty).toEqual(once.warranty);
    expect(twice.valorTotal).toBe(once.valorTotal);
    expect(twice.valorTotalManual).toBe(once.valorTotalManual);
  });
  it('schema version corrente é 2', () => {
    expect(COMMERCIAL_SCHEMA_VERSION).toBe(2);
  });
  it('(9)(10) normalizar NÃO muta a unidade snapshot dos itens', () => {
    const raw = proposal({
      equipmentItems: [item({ unidade: 'm', quantidade: 150.5 }), item({ unidade: 'un', quantidade: 3, itemNumero: 2 })],
    });
    const p = normalizeCommercialProposalData(raw);
    expect(p.equipmentItems[0].unidade).toBe('m');
    expect(p.equipmentItems[0].quantidade).toBe(150.5);
    expect(p.equipmentItems[1].unidade).toBe('un');
    // O snapshot do item é independente de qualquer cadastro de estoque atual.
    expect(raw.equipmentItems[0].unidade).toBe('m');
  });
  it('(21) serviço com unidade canônica é preservado/normalizado', () => {
    expect(normalizeUnitCode('visita')).toBe('visita');
    expect(normalizeUnitCode('H')).toBe('h');
    expect(normalizeUnitCode('vb')).toBe('vb');
  });
  it('(24) proposta e orçamento partem do MESMO total normalizado', () => {
    const raw = proposal({ valorTotal: 5000, valorTotalManual: 5000, schemaVersion: 2, equipmentItems: [item({ precoUnitario: 100, quantidade: 2 })] });
    // Ambos os documentos chamam normalizeCommercialProposalData → mesmo valorTotal.
    const a = normalizeCommercialProposalData(raw);
    const b = normalizeCommercialProposalData(raw);
    expect(a.valorTotal).toBe(5000);
    expect(a.valorTotal).toBe(b.valorTotal);
  });
});
