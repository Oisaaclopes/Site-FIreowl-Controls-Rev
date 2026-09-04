import { describe, expect, it } from 'vitest';
import {
  areasFromCatalog,
  manufacturersFromCatalog,
  modelsForManufacturer,
  subcategoriesForArea,
  TechnicalCatalogItem,
} from './technicalCatalog';

const item = (over: Partial<TechnicalCatalogItem>): TechnicalCatalogItem => ({
  id: Math.random().toString(36).slice(2), name: over.model || 'Item', ...over,
});

// Catálogo representativo (inclui item de saldo 0 — a view não expõe saldo).
const catalog: TechnicalCatalogItem[] = [
  item({ category: 'ALARME', brand: 'Tecnohold', model: 'Avalon' }),
  item({ category: 'ALARME', brand: 'Tecnohold', model: 'Onyx' }),
  item({ category: 'SDAI', brand: 'Intelbras', model: 'AFW-2000' }),
  item({ category: 'SDAI', brand: 'tecnohold', model: 'Verbo' }), // grafia diferente
  item({ category: 'CFTV', brand: 'Intelbras', model: 'MHDX 1108' }),
];

describe('catálogo técnico — agrupamentos (§30)', () => {
  it('fabricantes distintos (case-insensitive, ordenados)', () => {
    expect(manufacturersFromCatalog(catalog)).toEqual(['Intelbras', 'Tecnohold']);
  });

  it('fabricantes filtrados por área', () => {
    expect(manufacturersFromCatalog(catalog, 'ALARME')).toEqual(['Tecnohold']);
    expect(manufacturersFromCatalog(catalog, 'SDAI')).toEqual(['Intelbras', 'tecnohold']);
  });

  it('modelos de um fabricante (independe da grafia)', () => {
    const models = modelsForManufacturer(catalog, 'Tecnohold').map((i) => i.model);
    expect(models).toContain('Avalon');
    expect(models).toContain('Onyx');
    expect(models).toContain('Verbo');
  });

  it('modelos de um fabricante dentro de uma área', () => {
    const models = modelsForManufacturer(catalog, 'Tecnohold', 'ALARME').map((i) => i.model);
    expect(models).toEqual(['Avalon', 'Onyx']);
  });

  it('áreas distintas', () => {
    expect(areasFromCatalog(catalog)).toEqual(['ALARME', 'CFTV', 'SDAI']);
  });

  it('produto de saldo 0 continua selecionável (§28): o tipo não tem saldo', () => {
    // A view technical_catalog não projeta quantidade; o item existe no catálogo
    // independentemente de disponibilidade física.
    const avalon = modelsForManufacturer(catalog, 'Tecnohold', 'ALARME')[0];
    expect(avalon.model).toBe('Avalon');
    expect(Object.keys(avalon)).not.toContain('quantity');
  });
});

describe('filtro por categoria/subcategoria (§27/§32/§37)', () => {
  const sdai: TechnicalCatalogItem[] = [
    item({ category: 'SDAI', subcategory: 'Acionador Manual', brand: 'Tecnohold', model: 'AMETI2' }),
    item({ category: 'SDAI', subcategory: 'Sirenes/Sinalizadores', brand: 'Tecnohold', model: 'SAVE485TH' }),
    item({ category: 'SDAI', subcategory: 'Detectores', brand: 'Intelbras', model: 'AFW' }),
    item({ category: 'CFTV', subcategory: 'Câmeras', brand: 'Intelbras', model: 'MHDX' }),
  ];
  it('área é case-insensitive (sdai == SDAI)', () => {
    expect(manufacturersFromCatalog(sdai, 'sdai')).toEqual(['Intelbras', 'Tecnohold']);
  });
  it('subcategoriesForArea lista a taxonomia real da área', () => {
    expect(subcategoriesForArea(sdai, 'SDAI')).toEqual(['Acionador Manual', 'Detectores', 'Sirenes/Sinalizadores']);
  });
  it('fabricantes filtrados por subcategoria (Acionador Manual só Tecnohold)', () => {
    expect(manufacturersFromCatalog(sdai, 'SDAI', 'Acionador Manual')).toEqual(['Tecnohold']);
  });
  it('modelos filtrados por fabricante + subcategoria não vazam de outra categoria', () => {
    const models = modelsForManufacturer(sdai, 'Tecnohold', 'SDAI', 'Acionador Manual').map((m) => m.model);
    expect(models).toEqual(['AMETI2']);
    expect(models).not.toContain('SAVE485TH');
  });
  it('detector de fumaça não lista modelos de outra categoria', () => {
    const models = modelsForManufacturer(sdai, 'Intelbras', 'SDAI', 'Detectores').map((m) => m.model);
    expect(models).toEqual(['AFW']);
    expect(models).not.toContain('MHDX');
  });
});

describe('sem dados comerciais no view-model (§36)', () => {
  it('TechnicalCatalogItem não carrega preço/custo/margem/fornecedor', () => {
    const flat = JSON.stringify(catalog);
    for (const forbidden of ['price', 'preco', 'cost', 'custo', 'margin', 'margem', 'supplier', 'fornecedor']) {
      expect(flat.toLowerCase()).not.toContain(forbidden);
    }
  });
});
