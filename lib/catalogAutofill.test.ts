import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveCatalogAttributes, applyCatalogAutofill, emptyAssetValues, AssetFormValues } from './technicalAssetForm';
import { TechnicalCatalogItem } from './technicalCatalog';

const item = (over: Partial<TechnicalCatalogItem>): TechnicalCatalogItem => ({ id: 'c1', name: over.model || 'x', ...over } as TechnicalCatalogItem);

describe('deriveCatalogAttributes — só o que o catálogo informa de forma estruturada (§18/§27)', () => {
  it('B) Central endereçável → Tecnologia Endereçável', () => {
    expect(deriveCatalogAttributes('SDAI', 'Central SDAI', item({ technologies: ['Endereçável'] }))).toEqual({ tecnologia: 'Endereçável' });
  });
  it('C) Central convencional → Tecnologia Convencional (via system_type)', () => {
    expect(deriveCatalogAttributes('SDAI', 'Central SDAI', item({ systemType: 'Convencional' }))).toEqual({ tecnologia: 'Convencional' });
  });
  it('I) produto sem atributo estruturado → nada é inventado', () => {
    expect(deriveCatalogAttributes('SDAI', 'Central SDAI', item({ model: 'CIE-1000' }))).toEqual({});
  });
  it('G/§19) nunca deriva dado de instalação (Nº da Central, série…)', () => {
    const d = deriveCatalogAttributes('SDAI', 'Central SDAI', item({ technologies: ['Endereçável'] }));
    expect(d).not.toHaveProperty('central');
    expect(d).not.toHaveProperty('serial');
    expect(d).not.toHaveProperty('qtd_lacos');   // capacidade ≠ instalado
  });
  it('só preenche campo que o grupo POSSUI (Acionador não tem Tecnologia)', () => {
    expect(deriveCatalogAttributes('SDAI', 'Acionador Manual', item({ technologies: ['Endereçável'] }))).toEqual({});
  });
});

describe('applyCatalogAutofill — aplica, recalcula e respeita manual', () => {
  it('A) preenche Tecnologia vazia ao selecionar modelo', () => {
    const v = applyCatalogAutofill('SDAI', 'Central SDAI', emptyAssetValues(), item({ technologies: ['Endereçável'] }));
    expect(v.attrs.tecnologia).toBe('Endereçável');
    expect(v.autoAttrs?.tecnologia).toBe('Endereçável');
  });
  it('D) trocar modelo recalcula (Endereçável → Convencional)', () => {
    let v = applyCatalogAutofill('SDAI', 'Central SDAI', emptyAssetValues(), item({ technologies: ['Endereçável'] }));
    v = applyCatalogAutofill('SDAI', 'Central SDAI', v, item({ id: 'c2', systemType: 'Convencional' }));
    expect(v.attrs.tecnologia).toBe('Convencional');
  });
  it('H/§23) NÃO sobrescreve valor confirmado manualmente pelo técnico', () => {
    let v = applyCatalogAutofill('SDAI', 'Central SDAI', emptyAssetValues(), item({ technologies: ['Endereçável'] }));
    v = { ...v, attrs: { ...v.attrs, tecnologia: 'Híbrida' } };            // técnico ajustou
    v = applyCatalogAutofill('SDAI', 'Central SDAI', v, item({ id: 'c3', systemType: 'Convencional' }));
    expect(v.attrs.tecnologia).toBe('Híbrida');                            // respeitado
  });
  it('F/§24) modelo manual (sem item) não infere e limpa auto anterior', () => {
    let v = applyCatalogAutofill('SDAI', 'Central SDAI', emptyAssetValues(), item({ technologies: ['Endereçável'] }));
    v = applyCatalogAutofill('SDAI', 'Central SDAI', v, undefined);        // "não encontrei no catálogo"
    expect(v.attrs.tecnologia).toBeUndefined();
  });
  it('não mexe em campos de instalação já digitados', () => {
    const start: AssetFormValues = { ...emptyAssetValues(), central: '1', serial: 'ABC-1' };
    const v = applyCatalogAutofill('SDAI', 'Central SDAI', start, item({ technologies: ['Endereçável'] }));
    expect(v.central).toBe('1');
    expect(v.serial).toBe('ABC-1');
  });
});

describe('correção do "modelo some ao escolher fabricante" (manual rastreado, não derivado)', () => {
  const src = readFileSync(resolve(process.cwd(), 'components/clients/TechnicalAssetFields.tsx'), 'utf8');
  it('equip.manual vem de equipManual (não da ausência de catalogItemId)', () => {
    expect(src).toContain('manual: !!value.equipManual');
    expect(src).not.toContain('!value.catalogItemId && !!(value.fabricante');
  });
  it('onEquip aplica autofill do catálogo', () => {
    expect(src).toContain('applyCatalogAutofill');
  });
});
