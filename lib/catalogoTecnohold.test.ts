import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TECNOHOLD_SDAI } from './catalogoTecnohold';
import { deriveCatalogAttributes } from './technicalAssetForm';
import { TechnicalCatalogItem } from './technicalCatalog';

/* REVISÃO Tecnohold — dados mestres. */

describe('catálogo Tecnohold — nomenclatura oficial (§13/§18)', () => {
  it('não há mais modelos sintéticos "CIE-E*"', () => {
    expect(TECNOHOLD_SDAI.some((p) => /CIE-E/i.test(p.model || '') || /CIE-E/i.test(p.name))).toBe(false);
  });
  it('centrais endereçáveis usam a linha oficial Avalon Evolution', () => {
    const centrais = TECNOHOLD_SDAI.filter((p) => p.subcategory === 'Central de Alarme Endereçável');
    expect(centrais.length).toBe(6);
    for (const c of centrais) {
      expect(c.model).toMatch(/^Avalon Evolution (65|125|250) \((ABS|Metálica)\)$/);
      expect(c.productLine).toBe('Avalon Evolution');
      expect(c.technology).toBe('Endereçável');
      // SKU real do fabricante preservado
      expect(c.code).toMatch(/^PAIE485TH\d+E\.\d+$/);
    }
  });
  it('SKUs reais preservados (code) e únicos', () => {
    const codes = TECNOHOLD_SDAI.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
  it('todo item endereçável/convencional tem technology; detector linear é Convencional (§7)', () => {
    const linear = TECNOHOLD_SDAI.find((p) => p.code === 'DTLIN01');
    expect(linear?.technology).toBe('Convencional');
    const dfe = TECNOHOLD_SDAI.find((p) => p.code === 'DFE485THP1B02');
    expect(dfe?.technology).toBe('Endereçável');
  });
});

describe('autopreenchimento a partir do modelo Tecnohold (§21)', () => {
  // Simula o item do catálogo (view) com system_type derivado da migration 0102.
  const asCatalogItem = (technology?: string): TechnicalCatalogItem =>
    ({ id: 'x', name: 'Avalon Evolution 125 (ABS)', category: 'SDAI', subcategory: 'Central de Alarme Endereçável', brand: 'Tecnohold', model: 'Avalon Evolution 125 (ABS)', systemType: technology } as TechnicalCatalogItem);

  it('Central endereçável → Tecnologia Endereçável', () => {
    expect(deriveCatalogAttributes('SDAI', 'Central SDAI', asCatalogItem('Endereçável'))).toEqual({ tecnologia: 'Endereçável' });
  });
  it('sem atributo estruturado não inventa (§27)', () => {
    expect(deriveCatalogAttributes('SDAI', 'Central SDAI', asCatalogItem(undefined))).toEqual({});
  });
});

describe('migration 0102 — saneamento seguro por SKU', () => {
  const mig = readFileSync(resolve(process.cwd(), 'lib/db/migrations/0102_tecnohold_catalog_cleanup.sql'), 'utf8');
  it('atualiza por code exato + brand Tecnohold, sem LIKE nem massa', () => {
    expect(mig).toContain("brand='Tecnohold' and code='PAIE485TH65E.00'");
    expect(mig).not.toMatch(/like\s+'/i);
    expect(mig).not.toMatch(/update[\s\S]{0,120}where\s+brand\s*=\s*'Tecnohold'\s*;/i); // nunca update de toda a marca
  });
  it('não altera dados comerciais (§19)', () => {
    expect(mig).not.toMatch(/cost_price\s*=/);
    expect(mig).not.toMatch(/sale_price\s*=/);
    expect(mig).not.toMatch(/quantity\s*=/);
  });
});
