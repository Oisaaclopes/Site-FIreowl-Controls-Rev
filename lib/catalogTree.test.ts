import { describe, expect, it } from 'vitest';
import {
  TaxonomyNode, TaxonomyAlias, buildCatalogTree, nodeChildren, nodePath,
  areaFamilies, countsByNode, countsByArea, productsUnderNode, productPathNames, searchCatalog,
} from './catalogTree';
import type { InventoryItem } from './types';

// Mini-árvore fiel (subset SDAI + CFTV) com ids/parent explícitos.
const N = (id: string, code: string, parentId: string | null, name: string, area: string, sortOrder: number): TaxonomyNode =>
  ({ id, code, parentId, name, area, sortOrder, nodeType: 'X', active: true });

const nodes: TaxonomyNode[] = [
  N('s', 'SDAI.DETECTORES', null, 'Detectores', 'SDAI', 20),
  N('sf', 'SDAI.DETECTORES.FUMACA', 's', 'Fumaça', 'SDAI', 10),
  N('sfe', 'SDAI.DETECTORES.FUMACA.END', 'sf', 'Endereçável', 'SDAI', 10),
  N('st', 'SDAI.DETECTORES.TEMP', 's', 'Temperatura', 'SDAI', 20),
  N('sir', 'SDAI.SINALIZADORES', null, 'Sirenes / Sinalizadores', 'SDAI', 55),
  N('sire', 'SDAI.SINALIZADORES.END', 'sir', 'Endereçável', 'SDAI', 10),
  N('c', 'CFTV.CAMERAS', null, 'Câmeras', 'CFTV', 10),
  N('cip', 'CFTV.CAMERAS.IP', 'c', 'IP', 'CFTV', 10),
  N('cb', 'CFTV.CAMERAS.IP.BULLET', 'cip', 'Bullet', 'CFTV', 10),
];

const P = (id: string, category: string, canonicalTaxonomyId: string | undefined, over: Partial<InventoryItem> = {}): InventoryItem =>
  ({ id, code: id, name: id, category, quantity: 0, minQuantity: 0, unitPrice: 0, supplier: '', location: '', canonicalTaxonomyId, classificationStatus: 'CLASSIFICADO', ...over } as InventoryItem);

const products: InventoryItem[] = [
  P('FSP-951', 'SDAI', 'sfe', { brand: 'Notifier', model: 'FSP-951', description: 'Detector endereçável' }),
  P('DTE 521', 'SDAI', 'st', { brand: 'Intelbras', model: 'DTE 521' }),
  P('SAV 521 E', 'SDAI', 'sire', { brand: 'Intelbras', model: 'SAV 521 E', description: 'Sirene audiovisual' }),
  P('VIP 1230 B', 'CFTV', 'cb', { brand: 'Intelbras', model: 'VIP 1230 B' }),
  P('PLA0014', 'SDAI', undefined, { brand: 'Tecnohold', model: 'PLA0014', classificationStatus: 'NAO_CLASSIFICADO', subcategory: '' }),
  P('SIGA-OSD', 'SDAI', 's', { brand: 'Edwards', model: 'SIGA-OSD', classificationStatus: 'REVISAR' }),
];

const tree = buildCatalogTree(nodes);
const aliases: TaxonomyAlias[] = [
  { alias: 'Strobe', normalized: 'strobe', nodeId: 'sir' },
  { alias: 'Sounder', normalized: 'sounder', nodeId: 'sir' },
];

describe('catalogTree — montagem', () => {
  it('famílias por área ordenadas por sort_order', () => {
    expect(areaFamilies(tree, 'SDAI').map((n) => n.name)).toEqual(['Detectores', 'Sirenes / Sinalizadores']);
    expect(areaFamilies(tree, 'CFTV').map((n) => n.name)).toEqual(['Câmeras']);
  });

  it('filhos diretos por sort_order', () => {
    expect(nodeChildren(tree, 's').map((n) => n.name)).toEqual(['Fumaça', 'Temperatura']);
  });

  it('breadcrumb raiz→nó', () => {
    expect(nodePath(tree, 'sfe').map((n) => n.name)).toEqual(['Detectores', 'Fumaça', 'Endereçável']);
  });
});

describe('catalogTree — contagens (descendentes)', () => {
  it('conta produtos de todo o ramo, não só diretos', () => {
    const c = countsByNode(tree, products);
    expect(c.get('s')).toBe(3);   // FSP-951 + DTE 521 + SIGA-OSD (direto na família)
    expect(c.get('sf')).toBe(1);  // FSP-951
    expect(c.get('sfe')).toBe(1);
    expect(c.get('sir')).toBe(1); // SAV 521 E
    expect(c.get('c')).toBe(1);   // VIP 1230 B (via Bullet)
    expect(c.get('cip')).toBe(1);
  });

  it('contagem por área via category', () => {
    const a = countsByArea(products);
    expect(a.get('SDAI')).toBe(5);
    expect(a.get('CFTV')).toBe(1);
  });

  it('produtos sob um nó intermediário = todo o ramo', () => {
    expect(productsUnderNode(tree, products, 's').map((p) => p.id).sort()).toEqual(['DTE 521', 'FSP-951', 'SIGA-OSD']);
    expect(productsUnderNode(tree, products, 'c').map((p) => p.id)).toEqual(['VIP 1230 B']);
  });

  it('productPathNames devolve caminho ou null', () => {
    expect(productPathNames(tree, products[0])).toEqual(['Detectores', 'Fumaça', 'Endereçável']);
    expect(productPathNames(tree, products[4])).toBeNull(); // PLA0014 sem canonical
  });
});

describe('catalogTree — busca', () => {
  it('normaliza modelo (FSP951 / FSP-951 / FSP 951)', () => {
    for (const q of ['FSP951', 'FSP-951', 'FSP 951']) {
      expect(searchCatalog(tree, products, aliases, q)!.products.map((p) => p.id)).toContain('FSP-951');
    }
  });

  it('acha por alias/sinônimo (Strobe → Sirenes)', () => {
    const r = searchCatalog(tree, products, aliases, 'Strobe')!;
    expect(r.products.map((p) => p.id)).toContain('SAV 521 E');
  });

  it('acha por fabricante e por nome de família', () => {
    expect(searchCatalog(tree, products, aliases, 'Intelbras')!.products.length).toBeGreaterThanOrEqual(2);
    expect(searchCatalog(tree, products, aliases, 'Câmeras')!.products.map((p) => p.id)).toContain('VIP 1230 B');
  });

  it('produto NAO_CLASSIFICADO ainda é encontrado por modelo', () => {
    expect(searchCatalog(tree, products, aliases, 'PLA0014')!.products.map((p) => p.id)).toContain('PLA0014');
  });

  it('busca vazia retorna null', () => {
    expect(searchCatalog(tree, products, aliases, '   ')).toBeNull();
  });
});

describe('catalogTree — REVISAR / NAO_CLASSIFICADO visíveis', () => {
  it('REVISAR aparece sob a família e no filtro', () => {
    expect(productsUnderNode(tree, products, 's').some((p) => p.id === 'SIGA-OSD')).toBe(true);
    expect(products.filter((p) => p.classificationStatus === 'REVISAR').map((p) => p.id)).toEqual(['SIGA-OSD']);
  });

  it('produto sem taxonomia não some (aparece no filtro NAO_CLASSIFICADO)', () => {
    expect(products.filter((p) => p.classificationStatus === 'NAO_CLASSIFICADO').map((p) => p.id)).toEqual(['PLA0014']);
  });
});
