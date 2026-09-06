import { describe, expect, it } from 'vitest';
import {
  itemsInScope, manufacturersInScope, modelsInScope,
  allManufacturers, normalizeBrand, findExistingBrand, modelAttrs,
  canonicalFamilyGroups, productsInFamily, brandsInFamily, UNCLASSIFIED_GROUP,
} from './catalogSelection';
import { buildCatalogTree, TaxonomyNode } from './catalogTree';
import type { InventoryItem } from './types';

/* MELHORIA — cadastro inteligente de produto: fabricante/modelo. */

const item = (o: Partial<InventoryItem>): InventoryItem => ({
  id: Math.random().toString(36).slice(2), code: '', name: '', category: '', quantity: 0, minQuantity: 0, unitPrice: 0, supplier: '', location: '', ...o,
} as InventoryItem);

const catalog: InventoryItem[] = [
  item({ id: 'a', category: 'SDAI', subcategory: 'Detector de Fumaça Endereçável (Óptico)', brand: 'Intelbras', model: 'DFE 523', systemType: 'Endereçável' }),
  item({ id: 'b', category: 'SDAI', subcategory: 'Detector de Fumaça Endereçável (Óptico)', brand: 'Tecnohold', model: 'DFE485TH', systemType: 'Endereçável', productLine: 'Safira/Avalon' }),
  item({ id: 'c', category: 'SDAI', subcategory: 'Central de Alarme Endereçável', brand: 'Intelbras', model: 'CIE 1125' }),
  item({ id: 'd', category: 'CFTV', subcategory: 'Câmera Bullet', brand: 'Hikvision', model: 'DS-2CD', quantity: 0 }),
];

describe('fabricantes (K/L/M/N/O)', () => {
  it('K) fabricantes conhecidos = marcas cadastradas ∪ catálogo, ordenados', () => {
    const list = allManufacturers(catalog, ['Bosch', 'Edwards']);
    expect(list).toEqual(['Bosch', 'Edwards', 'Hikvision', 'Intelbras', 'Tecnohold']);
  });
  it('L) a lista é escaneável/buscável (contém a marca procurada)', () => {
    expect(allManufacturers(catalog, []).some((b) => b.toLowerCase().includes('tecno'))).toBe(true);
  });
  it('M) normalização evita marca duplicada por caixa/espaço/acento', () => {
    expect(normalizeBrand('  TECNOHOLD ')).toBe(normalizeBrand('Tecnohold'));
    expect(findExistingBrand('tecnohold', ['Intelbras', 'Tecnohold'])).toBe('Tecnohold');
    expect(findExistingBrand(' Intelbras', ['Intelbras'])).toBe('Intelbras');
  });
  it('N/O) marca genuinamente nova não casa existente (então será criada e selecionada)', () => {
    expect(findExistingBrand('Honeywell', ['Intelbras', 'Tecnohold'])).toBeUndefined();
  });
});

describe('modelos (P/Q/R/S)', () => {
  it('P) modelo filtrado por área + família + fabricante', () => {
    const detectorGroup = 'Detector';
    const models = modelsInScope(catalog, { area: 'SDAI', group: detectorGroup, brand: 'Tecnohold' });
    expect(models.map((m) => m.model)).toEqual(['DFE485TH']);
  });
  it('P) fabricantes do grupo Detector em SDAI', () => {
    const brands = manufacturersInScope(catalog, { area: 'SDAI', group: 'Detector' });
    expect(brands).toEqual(['Intelbras', 'Tecnohold']);
  });
  it('Q) modelo existente tem id selecionável', () => {
    const models = modelsInScope(catalog, { area: 'SDAI', group: 'Central', brand: 'Intelbras' });
    expect(models.find((m) => m.model === 'CIE 1125')?.id).toBe('c');
  });
  it('R) troca de fabricante muda o conjunto de modelos (não mistura marcas)', () => {
    const tecno = modelsInScope(catalog, { area: 'SDAI', group: 'Detector', brand: 'Tecnohold' });
    const intel = modelsInScope(catalog, { area: 'SDAI', group: 'Detector', brand: 'Intelbras' });
    expect(tecno.every((m) => m.brand === 'Tecnohold')).toBe(true);
    expect(intel.every((m) => m.brand === 'Intelbras')).toBe(true);
  });
  it('S) leitura pura: itemsInScope não cria/injeta itens (nenhum estoque fake)', () => {
    const scope = itemsInScope(catalog, { area: 'SDAI', group: 'Detector' });
    expect(scope.length).toBeLessThanOrEqual(catalog.length);
    expect(scope.every((i) => catalog.includes(i))).toBe(true);
  });
});

describe('escopo — área e saldo (proposta reutiliza)', () => {
  it('Proposta SDAI não lista CFTV', () => {
    expect(manufacturersInScope(catalog, { area: 'SDAI' })).not.toContain('Hikvision');
  });
  it('produto com saldo 0 continua elegível', () => {
    const cftv = itemsInScope(catalog, { area: 'CFTV' });
    expect(cftv.find((i) => i.id === 'd')).toBeTruthy();
  });
  it('fallback: nó/grupo sem itens não zera a lista (permanece no escopo da área)', () => {
    const scope = itemsInScope(catalog, { area: 'SDAI', group: 'Grupo Inexistente XYZ' });
    expect(scope.length).toBeGreaterThan(0);
  });
});

describe('autopreenchimento estruturado (T/U)', () => {
  it('T) atributos estruturados existentes são devolvidos', () => {
    expect(modelAttrs(catalog[1])).toEqual({ systemType: 'Endereçável', productLine: 'Safira/Avalon' });
  });
  it('U) atributo ausente não é inventado', () => {
    expect(modelAttrs(catalog[2])).toEqual({}); // CIE 1125 sem systemType/line no dado
  });
});

describe('§10.2/§10.3 — Pedido usa a MESMA taxonomia canônica do Estoque', () => {
  const N = (id: string, parentId: string | null, name: string, area: string, sortOrder: number): TaxonomyNode =>
    ({ id, code: id, parentId, name, area, sortOrder, nodeType: 'X', active: true });
  const nodes: TaxonomyNode[] = [
    N('det', null, 'Detectores', 'SDAI', 20),
    N('det-fum', 'det', 'Fumaça', 'SDAI', 10),
    N('cen', null, 'Centrais de Alarme de Incêndio', 'SDAI', 10),
  ];
  const tree = buildCatalogTree(nodes);
  const it2 = (o: Partial<InventoryItem>): InventoryItem => item(o);
  const sdai: InventoryItem[] = [
    it2({ id: 'p1', category: 'SDAI', canonicalTaxonomyId: 'det-fum', brand: 'Intelbras', model: 'DFE 523' }),
    it2({ id: 'p2', category: 'SDAI', canonicalTaxonomyId: 'cen', brand: 'Intelbras', model: 'CIE 1125' }),
    it2({ id: 'p3', category: 'SDAI', canonicalTaxonomyId: undefined, brand: 'Tecnohold', model: 'X', classificationStatus: 'NAO_CLASSIFICADO' }),
  ];

  it('agrupa por FAMÍLIA canônica (não pela subcategoria granular)', () => {
    const groups = canonicalFamilyGroups(tree, sdai, 'SDAI');
    const labels = groups.map((g) => g.label);
    expect(labels).toContain('Detectores');
    expect(labels).toContain('Centrais de Alarme de Incêndio');
    // Bucket de não classificados sempre por último.
    expect(labels[labels.length - 1]).toBe('Outros / Não classificados');
  });

  it('produtos saem do ramo canônico e o bucket cobre itens sem classificação', () => {
    expect(productsInFamily(tree, sdai, 'det').map((p) => p.id)).toEqual(['p1']);
    expect(productsInFamily(tree, sdai, UNCLASSIFIED_GROUP).map((p) => p.id)).toEqual(['p3']);
    expect(brandsInFamily(tree, sdai, 'det')).toEqual(['Intelbras']);
  });
});
