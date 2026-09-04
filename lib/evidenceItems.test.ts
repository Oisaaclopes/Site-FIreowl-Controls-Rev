import { describe, expect, it } from 'vitest';
import { buildEvidenceCategoryOptions, coarseFromSubcategory, countPhotosByMoment, equipmentToItemFields, photosForItemMoment } from './evidenceItems';
import { FieldPhoto, FieldPhotoMoment } from './fieldPhotos';
import { TechnicalCatalogItem } from './technicalCatalog';

const photo = (over: Partial<FieldPhoto>): FieldPhoto => ({
  id: Math.random().toString(36).slice(2), sessionId: 's', clientId: 'c',
  storagePathOriginal: 'o', capturadoEm: '2026-01-01T00:00:00Z', clientUuid: 'u', syncStatus: 'sincronizado', ...over,
});
const p = (itemId: string, moment: FieldPhotoMoment) => photo({ evidenceItemId: itemId, evidenceMoment: moment });

describe('countPhotosByMoment (§16/§56)', () => {
  const photos = [
    p('i1', 'ANTES'), p('i1', 'DURANTE'), p('i1', 'DURANTE'), p('i1', 'DEPOIS'), p('i1', 'DEPOIS'),
    p('i2', 'ANTES'),
    photo({ evidenceItemId: undefined, evidenceMoment: 'CENTRAL_ANTES' }), // central geral, sem item
  ];
  it('conta por momento de UM item (1 antes, 2 durante, 2 depois)', () => {
    expect(countPhotosByMoment(photos, 'i1')).toEqual({ antes: 1, durante: 2, depois: 2 });
  });
  it('não mistura fotos de outro item nem fotos sem item', () => {
    expect(countPhotosByMoment(photos, 'i2')).toEqual({ antes: 1, durante: 0, depois: 0 });
  });
  it('item inexistente → zeros', () => {
    expect(countPhotosByMoment(photos, 'x')).toEqual({ antes: 0, durante: 0, depois: 0 });
  });
});

describe('photosForItemMoment (§14/§57)', () => {
  const photos = [p('i1', 'DEPOIS'), p('i1', 'DEPOIS'), p('i1', 'ANTES'), p('i2', 'DEPOIS')];
  it('retorna só as fotos do item no momento pedido', () => {
    expect(photosForItemMoment(photos, 'i1', 'DEPOIS')).toHaveLength(2);
    expect(photosForItemMoment(photos, 'i1', 'ANTES')).toHaveLength(1);
    expect(photosForItemMoment(photos, 'i2', 'DEPOIS')).toHaveLength(1);
  });
});

describe('categorias por área / taxonomia (§25/§26/§37)', () => {
  const cat = (category: string, subcategory: string): TechnicalCatalogItem => ({ id: Math.random().toString(36).slice(2), name: subcategory, category, subcategory });
  const catalog = [
    cat('SDAI', 'Acionador Manual'), cat('SDAI', 'Sirenes/Sinalizadores'),
    cat('SDAI', 'Detectores'), cat('SDAI', 'Centrais'), cat('CFTV', 'Câmeras'),
  ];

  it('OS SDAI recebe categorias SDAI da taxonomia + genéricas', () => {
    const opts = buildEvidenceCategoryOptions(catalog, 'sdai').map((o) => o.label);
    expect(opts).toContain('Acionador Manual');
    expect(opts).toContain('Detectores');
    expect(opts).toContain('Infraestrutura');
    expect(opts).toContain('Cabeamento');
    expect(opts).toContain('Outro');
    expect(opts).not.toContain('Câmeras'); // CFTV não vaza para SDAI
  });

  it('mapeia subcategoria para categoria coarse', () => {
    expect(coarseFromSubcategory('Centrais')).toBe('CENTRAL');
    expect(coarseFromSubcategory('Acionador Manual')).toBe('EQUIPAMENTO');
    expect(coarseFromSubcategory('Cabeamento estruturado')).toBe('CABEAMENTO');
    expect(coarseFromSubcategory('Infraestrutura / eletroduto')).toBe('INFRAESTRUTURA');
  });

  it('a opção de categoria carrega a subcategoria para filtrar equipamento', () => {
    const acionador = buildEvidenceCategoryOptions(catalog, 'SDAI').find((o) => o.label === 'Acionador Manual');
    expect(acionador?.subcategory).toBe('Acionador Manual');
    expect(acionador?.coarse).toBe('EQUIPAMENTO');
  });

  it('sem área/sem taxonomia → só genéricas coarse (não assume SDAI, §33)', () => {
    const opts = buildEvidenceCategoryOptions([], undefined).map((o) => o.coarse);
    expect(opts).toEqual(['EQUIPAMENTO', 'CENTRAL', 'INFRAESTRUTURA', 'CABEAMENTO', 'OUTRO']);
  });
});

describe('equipmentToItemFields (§8/§42)', () => {
  it('mapeia catálogo → campos do item sem inventar', () => {
    expect(equipmentToItemFields({ catalogItemId: 'inv1', brand: 'Tecnohold', model: 'Avalon' }))
      .toEqual({ catalogItemId: 'inv1', manufacturer: 'Tecnohold', model: 'Avalon' });
  });
  it('manual (sem catalogItemId) preserva fabricante/modelo digitados', () => {
    expect(equipmentToItemFields({ brand: 'Marca X', model: 'Modelo Y', manual: true } as any))
      .toEqual({ catalogItemId: undefined, manufacturer: 'Marca X', model: 'Modelo Y' });
  });
  it('vazio → tudo indefinido (não cria produto/estoque)', () => {
    expect(equipmentToItemFields(undefined)).toEqual({ catalogItemId: undefined, manufacturer: undefined, model: undefined });
    expect(equipmentToItemFields({ brand: '  ' })).toEqual({ catalogItemId: undefined, manufacturer: undefined, model: undefined });
  });
});
