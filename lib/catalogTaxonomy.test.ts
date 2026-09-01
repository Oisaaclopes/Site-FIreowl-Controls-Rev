import { describe, expect, it } from 'vitest';
import {
  CATALOG_TAXONOMY_NODES,
  classifyCatalogItem,
  getCanonicalFamily,
  getTaxonomyChildren,
  getTaxonomyPath,
  normalizeTaxonomyAlias,
  validateTaxonomyTree,
} from './catalogTaxonomy';
import { TECHNICAL_CATALOG_SEED } from './catalogSeed';
import type { InventoryItem } from './types';

// Converte o seed técnico em item classificável (mesmos campos que o backfill lê).
const asItem = (s: (typeof TECHNICAL_CATALOG_SEED)[number]): InventoryItem =>
  ({ id: s.model, code: s.model || '', name: s.name, category: s.category, subcategory: s.subcategory, brand: s.brand, model: s.model, productLine: s.productLine, description: s.name, technicalSpecs: s.technicalSpecs, quantity: 0, minQuantity: 0, unitPrice: 0, supplier: '', location: '' } as InventoryItem);

const find = (model: string) => asItem(TECHNICAL_CATALOG_SEED.find((s) => s.model === model)!);

describe('taxonomia canônica — árvore', () => {
  it('não possui ciclos nem parent inválido', () => {
    expect(validateTaxonomyTree()).toEqual([]);
  });

  it('todo parentCode aponta para nó existente e mesma área', () => {
    const codes = new Set(CATALOG_TAXONOMY_NODES.map((n) => n.code));
    for (const node of CATALOG_TAXONOMY_NODES) {
      if (node.parentCode) expect(codes.has(node.parentCode)).toBe(true);
    }
  });

  it('getTaxonomyPath monta o caminho raiz→nó', () => {
    expect(getTaxonomyPath('SDAI.DETECTORES.FUMACA.END').map((n) => n.code)).toEqual([
      'SDAI.DETECTORES', 'SDAI.DETECTORES.FUMACA', 'SDAI.DETECTORES.FUMACA.END',
    ]);
  });

  it('getCanonicalFamily retorna a família ancestral', () => {
    expect(getCanonicalFamily('CFTV.CAMERAS.IP.BULLET')?.code).toBe('CFTV.CAMERAS');
  });

  it('getTaxonomyChildren respeita sort_order', () => {
    expect(getTaxonomyChildren('SDAI.MODULOS').map((n) => n.code)).toEqual([
      'SDAI.MODULOS.ENTRADA', 'SDAI.MODULOS.SAIDA', 'SDAI.MODULOS.IO', 'SDAI.MODULOS.RELE', 'SDAI.MODULOS.ISOLADOR',
    ]);
  });
});

describe('taxonomia canônica — aliases/sinônimos', () => {
  it('I/O e variantes convergem para Módulo de Entrada e Saída (I/O)', () => {
    for (const t of ['I/O', 'Input Output', 'Input/Output', 'Entrada/Saída', 'Entrada e Saída']) {
      expect(normalizeTaxonomyAlias(t)).toBe('SDAI.MODULOS.IO');
    }
  });

  it('variantes de isolador convergem para Módulo Isolador', () => {
    for (const t of ['Isolador', 'Isolator', 'Isolador de Laço', 'Módulo Isolador', 'Isolator Module']) {
      expect(normalizeTaxonomyAlias(t)).toBe('SDAI.MODULOS.ISOLADOR');
    }
  });

  it('Central SDAI converge para Centrais de Alarme de Incêndio', () => {
    expect(normalizeTaxonomyAlias('Central')).toBe('SDAI.CENTRAIS');
    expect(normalizeTaxonomyAlias('Central de Alarme')).toBe('SDAI.CENTRAIS');
  });

  it('alias desconhecido retorna null', () => {
    expect(normalizeTaxonomyAlias('xpto-inexistente')).toBeNull();
  });
});

describe('taxonomia canônica — classificação determinística', () => {
  it('FSP-951 → Detector / Fumaça / Endereçável', () => {
    const r = classifyCatalogItem(find('FSP-951'));
    expect(r).toEqual({ code: 'SDAI.DETECTORES.FUMACA.END', status: 'CLASSIFICADO' });
    expect(getTaxonomyPath(r.code!).map((n) => n.name)).toEqual(['Detectores', 'Fumaça', 'Endereçável']);
  });

  it('NFS2-3030 → Central de Alarme de Incêndio / Equipamento / Endereçável', () => {
    expect(classifyCatalogItem(find('NFS2-3030'))).toEqual({ code: 'SDAI.CENTRAIS.EQUIP.END', status: 'CLASSIFICADO' });
  });

  it('módulos Edwards SIGA genéricos permanecem REVISAR na família', () => {
    for (const m of ['SIGA-IM', 'SIGA-MM1', 'SIGA-CC1', 'SIGA-CT1']) {
      expect(classifyCatalogItem(find(m))).toEqual({ code: 'SDAI.MODULOS', status: 'REVISAR' });
    }
  });

  it('detectores Edwards/Bosch genéricos permanecem REVISAR na família', () => {
    for (const m of ['SIGA-OSD', 'FAP-425-O']) {
      expect(classifyCatalogItem(find(m))).toEqual({ code: 'SDAI.DETECTORES', status: 'REVISAR' });
    }
  });

  it('FCM-1-REL vai para Relé; FCM-1 para Saída / Controle', () => {
    expect(classifyCatalogItem(find('FCM-1-REL')).code).toBe('SDAI.MODULOS.RELE');
    expect(classifyCatalogItem(find('FCM-1')).code).toBe('SDAI.MODULOS.SAIDA');
  });

  it('Ascael DFX=Fumaça, DTX=Temperatura (convenção de modelo)', () => {
    expect(classifyCatalogItem(find('DFX-i')).code).toBe('SDAI.DETECTORES.FUMACA.END');
    expect(classifyCatalogItem(find('DTX-i')).code).toBe('SDAI.DETECTORES.TEMP.END');
  });

  it('Bosch aspiração → Detectores / Aspiração', () => {
    expect(classifyCatalogItem(find('FAS-420-TM')).code).toBe('SDAI.DETECTORES.ASP');
  });

  it('Intelbras VIP B/D só quando o sufixo é confiável', () => {
    expect(classifyCatalogItem(find('VIP 1230 B')).code).toBe('CFTV.CAMERAS.IP.BULLET');
    expect(classifyCatalogItem(find('VIP 1230 D')).code).toBe('CFTV.CAMERAS.IP.DOME');
    // Ambíguos (PAN/SD): ficam no nó IP, sem forçar forma
    expect(classifyCatalogItem(find('VIP 5180 PAN IA')).code).toBe('CFTV.CAMERAS.IP');
    expect(classifyCatalogItem(find('VIP 3216 SD IR IA')).code).toBe('CFTV.CAMERAS.IP');
  });

  it('VIP 5440 FC+ IA usa technical_specs.housing=bullet', () => {
    expect(classifyCatalogItem(find('VIP 5440 FC+ IA')).code).toBe('CFTV.CAMERAS.IP.BULLET');
  });

  it('gravadores: NVR e DVR/híbrido separados', () => {
    expect(classifyCatalogItem(find('NVD 1304')).code).toBe('CFTV.GRAVADORES.NVR');
    expect(classifyCatalogItem(find('MHDX 1204-C')).code).toBe('CFTV.GRAVADORES.DVR_HIBRIDO');
  });

  it('ALARME e BMS não recebem classificação inventada', () => {
    const alarme = TECHNICAL_CATALOG_SEED.filter((s) => s.category === 'ALARME');
    const bms = TECHNICAL_CATALOG_SEED.filter((s) => s.category === 'BMS');
    for (const s of [...alarme, ...bms]) {
      expect(classifyCatalogItem(asItem(s))).toEqual({ code: null, status: 'NAO_CLASSIFICADO' });
    }
  });

  it('classificação não muta o produto (model/description/part number preservados)', () => {
    const item = find('FSP-951');
    const before = JSON.stringify(item);
    classifyCatalogItem(item);
    expect(JSON.stringify(item)).toBe(before);
  });
});

describe('taxonomia canônica — totais do backfill (espelho do 0070)', () => {
  const count = (area: string) => {
    const items = TECHNICAL_CATALOG_SEED.filter((s) => s.category === area).map(asItem);
    const by = { CLASSIFICADO: 0, REVISAR: 0, NAO_CLASSIFICADO: 0 } as Record<string, number>;
    for (const it of items) by[classifyCatalogItem(it).status]++;
    return { total: items.length, ...by };
  };

  it('SDAI: 80 total = 60 CLASSIFICADO + 20 REVISAR + 0 não classificado', () => {
    expect(count('SDAI')).toEqual({ total: 80, CLASSIFICADO: 60, REVISAR: 20, NAO_CLASSIFICADO: 0 });
  });

  it('CFTV: 77 total = 77 CLASSIFICADO + 0 REVISAR + 0 não classificado', () => {
    expect(count('CFTV')).toEqual({ total: 77, CLASSIFICADO: 77, REVISAR: 0, NAO_CLASSIFICADO: 0 });
  });

  it('ALARME e BMS: 100% NAO_CLASSIFICADO nesta passada', () => {
    expect(count('ALARME').NAO_CLASSIFICADO).toBe(31);
    expect(count('BMS').NAO_CLASSIFICADO).toBe(27);
  });
});
