import { describe, expect, it } from 'vitest';
import { countPhotosByMoment, equipmentToItemFields, photosForItemMoment } from './evidenceItems';
import { FieldPhoto, FieldPhotoMoment } from './fieldPhotos';

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
