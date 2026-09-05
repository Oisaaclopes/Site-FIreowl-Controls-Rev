import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  manufacturersFromCatalog, modelsForManufacturer, areaMatches, groupMatchesSubcategory, subcategoriesForArea, TechnicalCatalogItem,
} from './technicalCatalog';

// Catálogo sintético: subcategory usa a taxonomia LEGADA do estoque ("Central",
// "Detector óptico de fumaça"…), NÃO os grupos canônicos da Base ("Central SDAI").
const cat = (over: Partial<TechnicalCatalogItem>): TechnicalCatalogItem => ({ id: Math.random().toString(36).slice(2), name: over.model || 'x', ...over } as TechnicalCatalogItem);
const CATALOG: TechnicalCatalogItem[] = [
  cat({ category: 'SDAI', subcategory: 'Central', brand: 'Intelbras', model: 'AMT 2018' }),
  cat({ category: 'SDAI', subcategory: 'Detector óptico de fumaça', brand: 'Intelbras', model: 'VDF 480' }),
  cat({ category: 'SDAI', subcategory: 'Central', brand: 'Notifier', model: 'NFS2-320' }),
  cat({ category: 'SDAI', subcategory: 'Detector óptico de fumaça', brand: 'Bosch', model: 'FAP-425' }),
  cat({ category: 'SDAI', subcategory: 'Acionador manual', brand: 'Tecnohold', model: 'AM-100' }),
  cat({ category: 'CFTV', subcategory: 'Câmera', brand: 'Hikvision', model: 'DS-2CD' }),
  cat({ category: 'Controle de Acesso', subcategory: 'Controladora', brand: 'Control iD', model: 'iDBox' }),
];

describe('CORREÇÃO 3D — taxonomia Base × catálogo (§3/§7/§8)', () => {
  it('A) Central SDAI retorna fabricantes de "Central" do catálogo legado', () => {
    const m = manufacturersFromCatalog(CATALOG, 'SDAI', 'Central SDAI');
    expect(m).toEqual(expect.arrayContaining(['Intelbras', 'Notifier']));
    expect(m).not.toContain('Bosch');       // detector não entra em Central
    expect(m).not.toContain('Hikvision');   // CFTV não entra em SDAI
  });

  it('Detector de Fumaça casa a família de detector', () => {
    const m = manufacturersFromCatalog(CATALOG, 'SDAI', 'Detector de Fumaça');
    expect(m).toContain('Bosch');
    expect(m).not.toContain('Notifier');
  });

  it('B) fabricante selecionado filtra modelos por área+grupo (§8)', () => {
    // Intelbras tem central E detector; ao registrar Central, mostra só a central.
    const central = modelsForManufacturer(CATALOG, 'Intelbras', 'SDAI', 'Central SDAI').map((x) => x.model);
    expect(central).toEqual(['AMT 2018']);
    const detector = modelsForManufacturer(CATALOG, 'Intelbras', 'SDAI', 'Detector de Fumaça').map((x) => x.model);
    expect(detector).toEqual(['VDF 480']);
  });

  it('D) grupo canônico "Central SDAI" resolve subcategoria legada "Central"', () => {
    expect(groupMatchesSubcategory('Central SDAI', 'Central')).toBe(true);
    expect(groupMatchesSubcategory('Repetidora de SDAI', 'Repetidora')).toBe(true);
    expect(groupMatchesSubcategory('Central SDAI', 'Câmera')).toBe(false);
  });

  it('F) fallback: grupo sem correspondência cai para os fabricantes da ÁREA', () => {
    // "Fonte / Alimentação" não existe como subcategoria SDAI no catálogo sintético.
    const m = manufacturersFromCatalog(CATALOG, 'SDAI', 'Fonte / Alimentação');
    expect(m.length).toBeGreaterThan(0);    // não fica vazio
    expect(m).toEqual(expect.arrayContaining(['Intelbras', 'Notifier', 'Bosch', 'Tecnohold']));
    expect(m).not.toContain('Hikvision');   // segue restrito à área
  });

  it('C) sem filtro de saldo — item existe no catálogo mesmo sem estoque', () => {
    // a view technical_catalog não expõe quantity; o seletor nunca filtra por saldo.
    const m = manufacturersFromCatalog(CATALOG, 'CFTV', 'Câmera');
    expect(m).toEqual(['Hikvision']);
  });

  it('catálogo vazio → lista vazia (fallback manual assume na UI §9)', () => {
    expect(manufacturersFromCatalog([], 'SDAI', 'Central SDAI')).toEqual([]);
  });

  it('areaMatches tolera rótulos (Controle de Acesso) e caixa', () => {
    expect(areaMatches('SDAI', 'SDAI')).toBe(true);
    expect(areaMatches('sdai', 'SDAI')).toBe(true);
    expect(areaMatches('Controle de Acesso', 'CONTROLE_ACESSO')).toBe(true);
    expect(areaMatches('CFTV', 'SDAI')).toBe(false);
    const m = manufacturersFromCatalog(CATALOG, 'CONTROLE_ACESSO', 'Controladora');
    expect(m).toEqual(['Control iD']);
  });

  it('subcategoriesForArea usa o casamento tolerante de área', () => {
    expect(subcategoriesForArea(CATALOG, 'SDAI')).toEqual(expect.arrayContaining(['Central', 'Acionador manual']));
    expect(subcategoriesForArea(CATALOG, 'SDAI')).not.toContain('Câmera');
  });
});

describe('E) cadastro manual e Levantamento usam a MESMA fonte (§10/§14-E)', () => {
  const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
  it('ambos renderizam TechnicalAssetFields (que consome EquipmentIdentifier→catálogo)', () => {
    expect(read('components/clients/ClientTechnicalBase.tsx')).toContain('<TechnicalAssetFields');
    expect(read('components/clients/TechnicalSurveyFlow.tsx')).toContain('<TechnicalAssetFields');
    expect(read('components/clients/TechnicalAssetFields.tsx')).toContain('EquipmentIdentifier');
  });
});
