import { describe, expect, it } from 'vitest';
import {
  CATALOG_TAXONOMY_NODES, CATALOG_TAXONOMY_ALIASES,
  classifyCatalogItem, getTaxonomyPath, normalizeTaxonomyAlias, validateTaxonomyTree,
} from './catalogTaxonomy';
import { normalizedCatalogKey } from './catalogSeed/types';
import type { InventoryItem } from './types';

const item = (brand: string, model: string, sub = ''): InventoryItem =>
  ({ id: 'x', code: model, name: model, category: 'SDAI', subcategory: sub, brand, model, quantity: 0, minQuantity: 0, unitPrice: 0, supplier: '', location: '' } as InventoryItem);
const codeOf = (brand: string, model: string) => classifyCatalogItem(item(brand, model)).code;
const statusOf = (brand: string, model: string) => classifyCatalogItem(item(brand, model)).status;

describe('0072 — nós novos', () => {
  it('árvore sem ciclos/órfãos após 0072', () => {
    expect(validateTaxonomyTree()).toEqual([]);
  });
  it('Módulo de Zona e Multicritério existem com parent correto', () => {
    const byCode = new Map(CATALOG_TAXONOMY_NODES.map((n) => [n.code, n]));
    expect(byCode.get('SDAI.MODULOS.ZONA')?.parentCode).toBe('SDAI.MODULOS');
    expect(byCode.get('SDAI.DETECTORES.MULTICRITERIO')?.parentCode).toBe('SDAI.DETECTORES');
    expect(byCode.get('SDAI.DETECTORES.MULTICRITERIO.END')?.parentCode).toBe('SDAI.DETECTORES.MULTICRITERIO');
  });
  it('aliases novos resolvem sem ambiguidade', () => {
    expect(normalizeTaxonomyAlias('Zone Module')).toBe('SDAI.MODULOS.ZONA');
    expect(normalizeTaxonomyAlias('Endereçador de Zona')).toBe('SDAI.MODULOS.ZONA');
    expect(normalizeTaxonomyAlias('Multisensor')).toBe('SDAI.DETECTORES.MULTICRITERIO');
    expect(normalizeTaxonomyAlias('Multicritério')).toBe('SDAI.DETECTORES.MULTICRITERIO');
    // nenhum normalized aponta para nós diferentes
    const byNorm = new Map<string, Set<string>>();
    for (const a of CATALOG_TAXONOMY_ALIASES) { const k = normalizedCatalogKey(a.alias); (byNorm.get(k) ?? byNorm.set(k, new Set()).get(k)!).add(a.code); }
    expect([...byNorm.values()].filter((s) => s.size > 1)).toEqual([]);
  });
});

describe('0072 — classificação revisada dos 23 modelos', () => {
  const CLASS: Array<[string, string, string]> = [
    // Bosch
    ['Bosch', 'FAP-425-O', 'SDAI.DETECTORES.FUMACA.END'],
    ['Bosch', 'FAP-425-DO', 'SDAI.DETECTORES.FUMACA.END'],
    ['Bosch', 'FAP-425-OT', 'SDAI.DETECTORES.MULTICRITERIO.END'],
    ['Bosch', 'FAP-425-DOT', 'SDAI.DETECTORES.MULTICRITERIO.END'],
    ['Bosch', 'FAH-425-T-R', 'SDAI.DETECTORES.TEMP.END'],
    // Edwards detectores
    ['Edwards', 'SIGA-OSD', 'SDAI.DETECTORES.FUMACA.END'],
    ['Edwards', 'SIGA-PD', 'SDAI.DETECTORES.FUMACA.END'],
    ['Edwards', 'SIGA-PS', 'SDAI.DETECTORES.FUMACA.END'],
    ['Edwards', 'SIGA-HRD', 'SDAI.DETECTORES.TEMP.END'],
    ['Edwards', 'SIGA-HFS', 'SDAI.DETECTORES.TEMP.END'],
    ['Edwards', 'SIGA-IPHS', 'SDAI.DETECTORES.MULTICRITERIO.END'],
    // Edwards módulos
    ['Edwards', 'SIGA-CT1', 'SDAI.MODULOS.ENTRADA'],
    ['Edwards', 'SIGA-CT2', 'SDAI.MODULOS.ENTRADA'],
    ['Edwards', 'SIGA-MM1', 'SDAI.MODULOS.ENTRADA'],
    ['Edwards', 'SIGA-CC1', 'SDAI.MODULOS.SAIDA'],
    ['Edwards', 'SIGA-CC2', 'SDAI.MODULOS.SAIDA'],
    ['Edwards', 'SIGA-IM', 'SDAI.MODULOS.ISOLADOR'],
    ['Edwards', 'SIGA-IM2', 'SDAI.MODULOS.ISOLADOR'],
    // Zona
    ['Intelbras', 'MDZ 521 V2', 'SDAI.MODULOS.ZONA'],
    ['Tecnohold', 'MCB485TH', 'SDAI.MODULOS.ZONA'],
    // Acionadores
    ['Intelbras', 'AME 566', 'SDAI.ACIONADORES.END'],
    ['Tecnohold', 'AMET12 IP-67', 'SDAI.ACIONADORES.END'],
  ];

  it('22 modelos promovidos para CLASSIFICADO no nó folha correto', () => {
    for (const [brand, model, code] of CLASS) {
      expect(classifyCatalogItem(item(brand, model)), `${model}`).toEqual({ code, status: 'CLASSIFICADO' });
    }
  });

  it('FAP-520 permanece REVISAR na família Detectores (não classificar por engano)', () => {
    expect(classifyCatalogItem(item('Bosch', 'FAP-520'))).toEqual({ code: 'SDAI.DETECTORES', status: 'REVISAR' });
  });

  it('caminhos finais coerentes', () => {
    expect(getTaxonomyPath(codeOf('Bosch', 'FAP-425-OT')!).map((n) => n.name)).toEqual(['Detectores', 'Multicritério', 'Endereçável']);
    expect(getTaxonomyPath(codeOf('Intelbras', 'MDZ 521 V2')!).map((n) => n.name)).toEqual(['Módulos', 'Módulo de Zona']);
    expect(getTaxonomyPath(codeOf('Edwards', 'SIGA-CC1')!).map((n) => n.name)).toEqual(['Módulos', 'Saída / Controle']);
  });

  it('revisão é por MODELO (independe da subcategoria legada)', () => {
    // subcategoria genérica "Detector" não impede a promoção do modelo revisado
    expect(codeOf('Edwards', 'SIGA-OSD')).toBe('SDAI.DETECTORES.FUMACA.END');
    expect(statusOf('Edwards', 'SIGA-OSD')).toBe('CLASSIFICADO');
  });
});

describe('0072 — intactos', () => {
  it('CFTV permanece intacto', () => {
    expect(classifyCatalogItem({ id: 'c', code: '', name: '', category: 'CFTV', subcategory: 'Câmera IP', brand: 'Intelbras', model: 'VIP 1230 B', quantity: 0, minQuantity: 0, unitPrice: 0, supplier: '', location: '' } as InventoryItem).code).toBe('CFTV.CAMERAS.IP.BULLET');
  });
  it('SDAI não revisado intacto (FSP-951 pela regra de subcategoria)', () => {
    expect(classifyCatalogItem({ id: 'f', code: 'FSP-951', name: '', category: 'SDAI', subcategory: 'Detector de fumaça', brand: 'Notifier', model: 'FSP-951', description: 'endereçável', quantity: 0, minQuantity: 0, unitPrice: 0, supplier: '', location: '' } as InventoryItem).code).toBe('SDAI.DETECTORES.FUMACA.END');
  });
});
