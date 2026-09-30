import { describe, expect, it } from 'vitest';
import {
  CATALOG_TAXONOMY_NODES, CATALOG_TAXONOMY_ALIASES,
  classifyCatalogItem, getCanonicalFamily, getTaxonomyChildren, normalizeTaxonomyAlias, validateTaxonomyTree,
} from './catalogTaxonomy';
import { normalizedCatalogKey } from './catalogSeed/types';
import type { InventoryItem } from './types';

const item = (category: string, subcategory: string, model = 'X'): InventoryItem =>
  ({ id: 'x', code: model, name: model, category, subcategory, brand: 'Intelbras', model, quantity: 0, minQuantity: 0, unitPrice: 0, supplier: '', location: '' } as InventoryItem);

describe('0115 — Periféricos e Componentes CFTV', () => {
  it('árvore íntegra e família nova depois de Gravadores', () => {
    expect(validateTaxonomyTree()).toEqual([]);
    expect(getTaxonomyChildren(null, 'CFTV').map((n) => n.code)).toEqual(['CFTV.CAMERAS', 'CFTV.GRAVADORES', 'CFTV.PERIFERICOS']);
    expect(getTaxonomyChildren('CFTV.PERIFERICOS').map((n) => n.name)).toEqual([
      'Armazenamento', 'Energia', 'Rede', 'Cabos', 'Conectores e Balun', 'Acessórios e Instalação', 'Monitores e Visualização',
    ]);
  });

  it('todo nó novo pertence à família Periféricos', () => {
    const novos = CATALOG_TAXONOMY_NODES.filter((n) => n.code.startsWith('CFTV.PERIFERICOS.'));
    expect(novos.length).toBe(31);
    for (const n of novos) expect(getCanonicalFamily(n.code)?.code).toBe('CFTV.PERIFERICOS');
  });

  it('aliases sem colisão e sem roubar termos do SDAI', () => {
    const byNorm = new Map<string, Set<string>>();
    for (const a of CATALOG_TAXONOMY_ALIASES) { const k = normalizedCatalogKey(a.alias); (byNorm.get(k) ?? byNorm.set(k, new Set()).get(k)!).add(a.code); }
    expect([...byNorm.values()].filter((s) => s.size > 1)).toEqual([]);
    expect(normalizeTaxonomyAlias('Monitor')).toBe('SDAI.MODULOS.ENTRADA');
    expect(normalizeTaxonomyAlias('Bateria')).toBe('SDAI.BATERIAS');
    expect(normalizeTaxonomyAlias('Nobreak')).toBe('CFTV.PERIFERICOS.ENERGIA.NOBREAK');
  });

  it('classifica CFTV pela subcategoria legada', () => {
    const cases: Array<[string, string]> = [
      ['HD', 'CFTV.PERIFERICOS.ARMAZENAMENTO.HD'],
      ['Disco rígido', 'CFTV.PERIFERICOS.ARMAZENAMENTO.HD'],
      ['Nobreak', 'CFTV.PERIFERICOS.ENERGIA.NOBREAK'],
      ['Fonte 12V', 'CFTV.PERIFERICOS.ENERGIA.FONTE'],
      ['Switch PoE', 'CFTV.PERIFERICOS.REDE.SWITCH_POE'],
      ['Cabo Coaxial', 'CFTV.PERIFERICOS.CABOS.COAXIAL'],
      ['Balun', 'CFTV.PERIFERICOS.CONECTORES.BALUN'],
      ['Rack', 'CFTV.PERIFERICOS.ACESSORIOS.RACK'],
    ];
    for (const [sub, code] of cases) expect(classifyCatalogItem(item('CFTV', sub))).toEqual({ code, status: 'CLASSIFICADO' });
  });

  it('não classifica pela família genérica nem fora do CFTV', () => {
    expect(classifyCatalogItem(item('CFTV', 'Periférico')).status).toBe('NAO_CLASSIFICADO');
    expect(classifyCatalogItem(item('CFTV', 'Coisa qualquer')).status).toBe('NAO_CLASSIFICADO');
    expect(classifyCatalogItem(item('ALARME', 'Nobreak')).status).toBe('NAO_CLASSIFICADO');
  });
});
