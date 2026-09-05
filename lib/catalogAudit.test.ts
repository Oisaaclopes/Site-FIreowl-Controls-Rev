import { describe, expect, it } from 'vitest';
import { auditCatalog, CANONICAL_AREAS } from './catalogAudit';
import type { InventoryItem } from './types';

/* AUDITORIA DE QUALIDADE DO CATÁLOGO (instrumento read-only). */

const item = (o: Partial<InventoryItem>): InventoryItem => ({
  id: Math.random().toString(36).slice(2), code: '', name: '', category: '', quantity: 0, minQuantity: 0, unitPrice: 0, supplier: '', location: '', ...o,
} as InventoryItem);

const sample: InventoryItem[] = [
  item({ id: 'a', category: 'SDAI', subcategory: 'Detector', brand: 'Intelbras', model: 'DFC 421', canonicalTaxonomyId: 'n1' }),
  item({ id: 'b', category: 'SDAI', subcategory: 'Detector', brand: 'INTELBRAS', model: 'DFC-421' }), // dup marca (caixa) + dup modelo
  item({ id: 'c', category: 'SDAI', subcategory: '', brand: '', model: '' }),                          // sem família/marca/modelo
  item({ id: 'd', category: '', subcategory: 'Câmera', brand: 'Hikvision', model: 'DS-2CD' }),          // sem área
  item({ id: 'e', category: 'PORTARIA', subcategory: 'Leitor', brand: 'Control iD', model: 'iDFlex' }), // área fora do canônico
  item({ id: 'f', category: 'SDAI', subcategory: 'Central', brand: 'Tecnohold', model: 'Avalon 125', stockManaged: false }), // somente catálogo
];

describe('auditCatalog — contagens por área', () => {
  const a = auditCatalog(sample);
  it('total geral', () => { expect(a.total).toBe(6); });
  it('área SDAI agrega e conta família/canônica/somente catálogo', () => {
    const sdai = a.areas.find((x) => x.area === 'SDAI')!;
    expect(sdai.total).toBe(4); // a,b,c,f
    expect(sdai.withBrand).toBe(3); // a,b,f
    expect(sdai.unclassifiedFamily).toBe(1); // c
    expect(sdai.canonicalClassified).toBe(1); // a
    expect(sdai.catalogOnly).toBe(1); // f
  });
  it('item sem área vira bucket "SEM ÁREA"', () => {
    expect(a.areas.find((x) => x.area === 'SEM ÁREA')?.total).toBe(1);
  });
});

describe('auditCatalog — faltantes e área não canônica', () => {
  const a = auditCatalog(sample);
  it('missingCategory / missingBrand / missingModel / missingSubcategory', () => {
    expect(a.missingCategory.map((i) => i.id)).toEqual(['d']);
    expect(a.missingBrand.map((i) => i.id)).toEqual(['c']);
    expect(a.missingModel.map((i) => i.id)).toEqual(['c']);
    expect(a.missingSubcategory.map((i) => i.id)).toEqual(['c']);
  });
  it('area fora do conjunto canônico é sinalizada (PORTARIA)', () => {
    expect(a.areaOutsideCanonical.map((i) => i.id)).toEqual(['e']);
    expect(CANONICAL_AREAS).toContain('CONTROLE_ACESSO');
  });
});

describe('auditCatalog — duplicidades (só candidatos, não corrige)', () => {
  const a = auditCatalog(sample);
  it('marca duplicada por caixa: Intelbras/INTELBRAS', () => {
    const dup = a.brandDuplicates.find((d) => d.normalized === 'intelbras');
    expect(dup?.variants.slice().sort()).toEqual(['INTELBRAS', 'Intelbras']);
    expect(dup?.variants).toHaveLength(2);
  });
  it('modelo duplicado no mesmo contexto: DFC 421 / DFC-421', () => {
    const dup = a.modelDuplicates.find((d) => d.normalizedModel === 'dfc421');
    expect(dup?.items.map((i) => i.id).sort()).toEqual(['a', 'b']);
  });
  it('não inventa duplicidade quando contexto difere', () => {
    const two = [item({ category: 'SDAI', subcategory: 'Detector', brand: 'X', model: 'M1' }), item({ category: 'CFTV', subcategory: 'Detector', brand: 'X', model: 'M1' })];
    expect(auditCatalog(two).modelDuplicates).toEqual([]);
  });
});
