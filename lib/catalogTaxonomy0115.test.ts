import { describe, expect, it } from 'vitest';
import {
  CATALOG_TAXONOMY_NODES, CATALOG_TAXONOMY_ALIASES,
  classifyCatalogItem, getCanonicalFamily, getTaxonomyChildren, getTransversalFamilies,
  getTaxonomyPath, normalizeTaxonomyAlias, validateTaxonomyTree,
} from './catalogTaxonomy';
import { normalizedCatalogKey } from './catalogSeed/types';
import type { InventoryItem } from './types';

const byCode = new Map(CATALOG_TAXONOMY_NODES.map((n) => [n.code, n]));

describe('0115 — famílias específicas de CFTV (sem nível intermediário)', () => {
  it('árvore íntegra (scope/area/pai-filho)', () => {
    expect(validateTaxonomyTree()).toEqual([]);
  });

  it('CFTV → Família → Tipo, após Câmeras e Gravadores (preservados)', () => {
    expect(getTaxonomyChildren(null, 'CFTV').map((n) => n.name)).toEqual([
      'Câmeras', 'Gravadores', 'Armazenamento', 'Transmissão de Vídeo', 'Acessórios de Instalação', 'Visualização e Operação',
    ]);
    expect(getTaxonomyChildren('CFTV.ARMAZENAMENTO').map((n) => n.name)).toEqual(['Disco Rígido (HD)', 'SSD', 'Cartão de Memória']);
    expect(getTaxonomyChildren('CFTV.TRANSMISSAO').map((n) => n.name)).toEqual(['Balun', 'Extensor / Conversor de Vídeo']);
    expect(getTaxonomyChildren('CFTV.ACESSORIOS').map((n) => n.name)).toEqual(['Suportes', 'Caixas de Passagem / Herméticas']);
    expect(getTaxonomyChildren('CFTV.VISUALIZACAO').map((n) => n.name)).toEqual(['Monitor', 'Mesa Controladora / Joystick']);
    // profundidade 2 (Área → Família → Tipo): o HD fica logo abaixo da família
    expect(getTaxonomyPath('CFTV.ARMAZENAMENTO.HD').map((n) => n.code)).toEqual(['CFTV.ARMAZENAMENTO', 'CFTV.ARMAZENAMENTO.HD']);
    expect(getCanonicalFamily('CFTV.TRANSMISSAO.BALUN')?.code).toBe('CFTV.TRANSMISSAO');
    expect(byCode.get('CFTV.CAMERAS.IP.BULLET')?.parentCode).toBe('CFTV.CAMERAS.IP');
  });

  it('nenhum resquício de CFTV.PERIFERICOS', () => {
    expect(CATALOG_TAXONOMY_NODES.filter((n) => n.code.includes('PERIFERICOS'))).toEqual([]);
    expect(CATALOG_TAXONOMY_ALIASES.filter((a) => a.code.includes('PERIFERICOS'))).toEqual([]);
  });

  it('não classifica produtos novos por conta própria (backfill fica para a 0119)', () => {
    const it0 = { id: 'x', code: 'X', name: 'X', category: 'CFTV', subcategory: 'HD', brand: 'WD', model: 'WD22PURZ', quantity: 0, minQuantity: 0, unitPrice: 0, supplier: '', location: '' } as InventoryItem;
    expect(classifyCatalogItem(it0).status).toBe('NAO_CLASSIFICADO');
  });
});

describe('0116/0117 — domínio TRANSVERSAL Infraestrutura', () => {
  it('famílias INFRA na raiz, scope TRANSVERSAL e area null', () => {
    expect(getTransversalFamilies().map((n) => n.name)).toEqual(['Energia', 'Rede', 'Cabeamento', 'Racks e Organização']);
    const infra = CATALOG_TAXONOMY_NODES.filter((n) => n.code.startsWith('INFRA.'));
    expect(infra.length).toBe(4 + 4 + 5 + 6 + 4);
    for (const n of infra) { expect(n.scope).toBe('TRANSVERSAL'); expect(n.area).toBeNull(); }
    // Infraestrutura não aparece como família de nenhuma área comercial
    for (const a of ['SDAI', 'CFTV', 'ALARME', 'BMS', 'CONTROLE_ACESSO'] as const) {
      expect(getTaxonomyChildren(null, a).some((n) => n.code.startsWith('INFRA.'))).toBe(false);
    }
  });

  it('tipos aprovados', () => {
    expect(getTaxonomyChildren('INFRA.ENERGIA').map((n) => n.name)).toEqual(['Fonte', 'Nobreak', 'Bateria', 'Proteção Elétrica (DPS)']);
    expect(getTaxonomyChildren('INFRA.REDE').map((n) => n.name)).toEqual(['Switch', 'Switch PoE', 'Injetor / Extensor PoE', 'Roteador / Access Point', 'Conversor de Mídia']);
    expect(getTaxonomyChildren('INFRA.CABEAMENTO').map((n) => n.name)).toEqual(['Cabo UTP', 'Cabo Coaxial', 'Fibra Óptica', 'Cabo de Energia / PP', 'Cabo HDMI / VGA', 'Conectores']);
    expect(getTaxonomyChildren('INFRA.RACKS').map((n) => n.name)).toEqual(['Rack', 'Patch Panel', 'Organizador de Cabos', 'Acessórios de Rack']);
  });

  it('SDAI.BATERIAS e SDAI.ALIMENTACAO permanecem intactos', () => {
    expect(byCode.get('SDAI.BATERIAS.SELADA')).toMatchObject({ scope: 'AREA', area: 'SDAI', parentCode: 'SDAI.BATERIAS' });
    expect(byCode.get('SDAI.ALIMENTACAO.AUXILIAR')).toMatchObject({ scope: 'AREA', area: 'SDAI', parentCode: 'SDAI.ALIMENTACAO' });
  });
});

describe('aliases 0115/0117', () => {
  it('sem colisão (um termo → um nó) e sem roubar termos do SDAI', () => {
    const byNorm = new Map<string, Set<string>>();
    for (const a of CATALOG_TAXONOMY_ALIASES) { const k = normalizedCatalogKey(a.alias); (byNorm.get(k) ?? byNorm.set(k, new Set()).get(k)!).add(a.code); }
    expect([...byNorm.values()].filter((s) => s.size > 1)).toEqual([]);
    expect(normalizeTaxonomyAlias('Monitor')).toBe('SDAI.MODULOS.ENTRADA');
    expect(normalizeTaxonomyAlias('Bateria')).toBe('SDAI.BATERIAS');
    expect(normalizeTaxonomyAlias('Fonte Nobreak')).toBe('SDAI.ALIMENTACAO.AUXILIAR');
    expect(normalizeTaxonomyAlias('Fonte Auxiliar')).toBe('SDAI.ALIMENTACAO.AUXILIAR');
  });

  it('referências aprovadas resolvem', () => {
    expect(normalizeTaxonomyAlias('HD')).toBe('CFTV.ARMAZENAMENTO.HD');
    expect(normalizeTaxonomyAlias('Balun')).toBe('CFTV.TRANSMISSAO.BALUN');
    expect(normalizeTaxonomyAlias('Nobreak')).toBe('INFRA.ENERGIA.NOBREAK');
    expect(normalizeTaxonomyAlias('Switch PoE')).toBe('INFRA.REDE.SWITCH_POE');
    expect(normalizeTaxonomyAlias('Patch Panel')).toBe('INFRA.RACKS.PATCH_PANEL');
    expect(normalizeTaxonomyAlias('Conector RJ45')).toBe('INFRA.CABEAMENTO.CONECTORES');
  });

  it('todo alias aponta para nó existente', () => {
    expect(CATALOG_TAXONOMY_ALIASES.filter((a) => !byCode.has(a.code))).toEqual([]);
  });
});
