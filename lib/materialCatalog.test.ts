import { describe, expect, it } from 'vitest';
import {
  groupsInArea, itemsInAreaGroup, brandsInAreaGroup, productsInAreaGroup,
  searchCatalogItems, UNCLASSIFIED_GROUP, NO_BRAND,
} from './catalogSelection';
import type { InventoryItem } from './types';

/* MELHORIA UX — seletor inteligente de materiais da proposta. */

const item = (o: Partial<InventoryItem>): InventoryItem => ({
  id: Math.random().toString(36).slice(2), code: '', name: '', category: '', quantity: 0, minQuantity: 0, unitPrice: 0, supplier: '', location: '', ...o,
} as InventoryItem);

const inv: InventoryItem[] = [
  item({ id: 's1', code: 'DFE485THP1B02', category: 'SDAI', subcategory: 'Detector de Fumaça Endereçável (Óptico)', brand: 'Tecnohold', model: 'DFE485TH', salePrice: 140, unit: 'un', quantity: 4 }),
  item({ id: 's2', code: '4610050', category: 'SDAI', subcategory: 'Detector de Fumaça Endereçável (Óptico)', brand: 'Intelbras', model: 'DFE 523', salePrice: 150, unit: 'un', quantity: 0 }),
  item({ id: 's3', code: 'PAIE', category: 'SDAI', subcategory: 'Central de Alarme Endereçável', brand: 'Tecnohold', model: 'Avalon Evolution 125', salePrice: 1200, unit: 'un', quantity: 0 }),
  item({ id: 's4', code: 'SEMCAT', category: 'SDAI', subcategory: '', brand: '', model: 'Bornes diversos', salePrice: 5, unit: 'un', quantity: 10 }),
  item({ id: 'c1', code: 'DS-2CD', category: 'CFTV', subcategory: 'Câmera Bullet', brand: 'Hikvision', model: 'DS-2CD', salePrice: 500, unit: 'un', quantity: 2 }),
];

describe('Área → Grupo (A/K)', () => {
  it('A) Proposta SDAI não lista grupos de CFTV', () => {
    const g = groupsInArea(inv, 'SDAI').map((x) => x.label);
    expect(g).toContain('Detector de Fumaça Endereçável (Óptico)');
    expect(g).toContain('Central de Alarme Endereçável');
    expect(g).not.toContain('Câmera Bullet');
  });
  it('K) item sem classificação vira bucket "Não classificados" (por último, visível)', () => {
    const g = groupsInArea(inv, 'SDAI');
    const last = g[g.length - 1];
    expect(last.key).toBe(UNCLASSIFIED_GROUP);
    expect(last.count).toBe(1);
    expect(itemsInAreaGroup(inv, 'SDAI', UNCLASSIFIED_GROUP).map((i) => i.id)).toEqual(['s4']);
  });
});

describe('Grupo → Fabricante → Produto (B/C/D/E)', () => {
  const detector = groupsInArea(inv, 'SDAI').find((g) => g.label.startsWith('Detector'))!.key;
  const central = groupsInArea(inv, 'SDAI').find((g) => g.label.startsWith('Central'))!.key;

  it('B) grupo filtra fabricantes', () => {
    expect(brandsInAreaGroup(inv, 'SDAI', detector)).toEqual(['Intelbras', 'Tecnohold']);
    expect(brandsInAreaGroup(inv, 'SDAI', central)).toEqual(['Tecnohold']);
  });
  it('C) fabricante filtra produtos', () => {
    expect(productsInAreaGroup(inv, 'SDAI', detector, 'Tecnohold').map((i) => i.model)).toEqual(['DFE485TH']);
  });
  it('D) grupos diferentes → conjuntos de fabricantes diferentes', () => {
    expect(brandsInAreaGroup(inv, 'SDAI', detector)).not.toEqual(brandsInAreaGroup(inv, 'SDAI', central));
  });
  it('E) fabricantes diferentes → produtos diferentes', () => {
    const tec = productsInAreaGroup(inv, 'SDAI', detector, 'Tecnohold').map((i) => i.id);
    const int = productsInAreaGroup(inv, 'SDAI', detector, 'Intelbras').map((i) => i.id);
    expect(tec).toEqual(['s1']);
    expect(int).toEqual(['s2']);
  });
  it('produto sem fabricante fica sob "Sem fabricante" (NO_BRAND), não some', () => {
    expect(brandsInAreaGroup(inv, 'SDAI', UNCLASSIFIED_GROUP)).toContain(NO_BRAND);
    expect(productsInAreaGroup(inv, 'SDAI', UNCLASSIFIED_GROUP, NO_BRAND).map((i) => i.id)).toEqual(['s4']);
  });
});

describe('Busca direta (F/G)', () => {
  it('F) encontra por código/SKU', () => {
    expect(searchCatalogItems(inv, 'DFE485', 'SDAI').map((i) => i.id)).toEqual(['s1']);
  });
  it('G) encontra por modelo', () => {
    expect(searchCatalogItems(inv, 'Avalon', 'SDAI').map((i) => i.id)).toEqual(['s3']);
  });
  it('busca restrita à área por padrão (SDAI não traz CFTV)', () => {
    expect(searchCatalogItems(inv, 'DS-2CD', 'SDAI')).toEqual([]);
    expect(searchCatalogItems(inv, 'DS-2CD').map((i) => i.id)).toEqual(['c1']); // sem área = todas
  });
});

describe('Saldo e seleção (H/I)', () => {
  it('H) produto com saldo 0 continua disponível', () => {
    const detector = groupsInArea(inv, 'SDAI').find((g) => g.label.startsWith('Detector'))!.key;
    const p = productsInAreaGroup(inv, 'SDAI', detector, 'Intelbras');
    expect(p.find((i) => i.id === 's2')?.quantity).toBe(0);
    expect(p.length).toBe(1);
  });
  it('I) item selecionável carrega id/nome/unidade/preço p/ resolver', () => {
    const [it] = searchCatalogItems(inv, 'DFE485', 'SDAI');
    expect(it.id).toBe('s1');
    expect(it.model).toBe('DFE485TH');
    expect(it.unit).toBe('un');
    expect(it.salePrice).toBe(140);
  });
});
