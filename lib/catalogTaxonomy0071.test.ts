import { describe, expect, it } from 'vitest';
import {
  CATALOG_TAXONOMY_NODES,
  CATALOG_TAXONOMY_ALIASES,
  classifyCatalogItem,
  getTaxonomyPath,
  getTaxonomyChildren,
  normalizeTaxonomyAlias,
  validateTaxonomyTree,
} from './catalogTaxonomy';
import type { InventoryItem } from './types';
import { normalizedCatalogKey } from './catalogSeed/types';

// Item mínimo classificável a partir dos campos reais de produção.
const item = (p: Partial<InventoryItem>): InventoryItem => ({ id: 'x', code: p.model || '', name: '', category: 'SDAI', quantity: 0, minQuantity: 0, unitPrice: 0, supplier: '', location: '', ...p } as InventoryItem);

// Amostra fiel dos 51 SDAI NAO_CLASSIFICADO de produção (marca | modelo | subcategory).
const PROD_51: Array<[string, string, string]> = [
  ['Intelbras', 'CIE - 2500', 'Central de Alarme Endereçável'],
  ['Intelbras', 'CIE 1125', 'Central de Alarme Endereçável'],
  ['Intelbras', 'CIE 2500', 'Central de Alarme Endereçável'],
  ['Intelbras', 'CIE 1060', 'Central de Alarme Endereçável'],
  ['Intelbras', 'CIE 1250', 'Central de Alarme Endereçável'],
  ['Tecnohold', 'CIE-E065 ABS', 'Central de Alarme Endereçável'],
  ['Tecnohold', 'CIE-E125 ABS', 'Central de Alarme Endereçável'],
  ['Tecnohold', 'CIE-E250 ABS', 'Central de Alarme Endereçável'],
  ['Tecnohold', 'CIE-E065 Metálica', 'Central de Alarme Endereçável'],
  ['Tecnohold', 'CIE-E125 Metálica', 'Central de Alarme Endereçável'],
  ['Tecnohold', 'CIE-E250 Metálica', 'Central de Alarme Endereçável'],
  ['Intelbras', 'CIC 06L', 'Central de Alarme Convencional'],
  ['Intelbras', 'CIC 12L', 'Central de Alarme Convencional'],
  ['Intelbras', 'AME 521', 'Acionador Manual Endereçável (Rearmável)'],
  ['Intelbras', 'AME 522', 'Acionador Manual Endereçável (Rearmável)'],
  ['Tecnohold', 'AME07 IP-20', 'Acionador Manual Endereçável (Rearmável)'],
  ['Tecnohold', 'AMET12 IP-55', 'Acionador Manual Endereçável (Rearmável)'],
  ['Intelbras', 'AME 566', 'Acionador Manual à Prova de Tempo (IP66)'],
  ['Tecnohold', 'AMET12 IP-67', 'Acionador Manual à Prova de Tempo (IP66)'],
  ['Intelbras', 'DFE 523', 'Detector de Fumaça Endereçável (Óptico)'],
  ['Tecnohold', 'DFE485TH', 'Detector de Fumaça Endereçável (Óptico)'],
  ['Intelbras', 'DTE 521', 'Detector de Temperatura (Termovelocimétrico / Fixo)'],
  ['Intelbras', 'DTE 523', 'Detector de Temperatura (Termovelocimétrico / Fixo)'],
  ['Tecnohold', 'DTE485TH', 'Detector de Temperatura (Termovelocimétrico / Fixo)'],
  ['Intelbras', 'DGC 423', 'Detector de Gás (CO / GLP / Amônia)'],
  ['Intelbras', 'DFL 3100', 'Detector Linear de Fumaça (Feixe / Barreira)'],
  ['Intelbras', 'DFL 3100 (Refletores)', 'Detector Linear de Fumaça (Feixe / Barreira)'],
  ['Tecnohold', 'DTLIN01', 'Detector Linear de Fumaça (Feixe / Barreira)'],
  ['Intelbras', 'MIO 521 V2', 'Módulo de Relé / Saída'],
  ['Tecnohold', 'MRE485TH', 'Módulo de Relé / Saída'],
  ['Intelbras', 'MDI 521 V2', 'Módulo Monitor / Entrada'],
  ['Tecnohold', 'MCS485TH', 'Módulo Monitor / Entrada'],
  ['Intelbras', 'IDL 521 V2', 'Módulo Isolador de Curto-Circuito'],
  ['Tecnohold', 'MIRE485TH', 'Módulo Isolador de Curto-Circuito'],
  ['Intelbras', 'MDZ 521 V2', 'Módulo Endereçador de Zona Convencional'],
  ['Tecnohold', 'MCB485TH', 'Módulo Endereçador de Zona Convencional'],
  ['Intelbras', 'GW 521', 'Placa de Rede / Comunicação (Integração)'],
  ['Intelbras', 'PDE 1000', 'Programador de Endereços'],
  ['Intelbras', 'RP 520', 'Painel Repetidor / Sinótico (Display Remoto)'],
  ['Intelbras', 'SAV 521 E', 'Sirene Audiovisual Endereçável (Strobe)'],
  ['Tecnohold', 'SAVE485TH IP-20', 'Sirene Audiovisual Endereçável (Strobe)'],
  ['Tecnohold', 'SAVE485TH IP-55', 'Sirene Audiovisual Endereçável (Strobe)'],
  ['Tecnohold', 'SAVE485TH IP-67', 'Sirene Audiovisual Endereçável (Strobe)'],
  ['Morey', 'PROD-5475', 'Sirene Audiovisual Convencional'],
  ['Intelbras', 'FNA 520', 'Fonte de Alimentação Auxiliar (SDAI)'],
  ['Tecnohold', 'QFAE485TH', 'Fonte de Alimentação Auxiliar (SDAI)'],
  ['Intelbras', 'Placa Fonte CIE', 'Fonte de Alimentação Auxiliar (SDAI)'],
  ['Tecnohold', 'BAT 12V 1,3Ah', 'Bateria Selada (VRLA / Chumbo-Ácido)'],
  ['Tecnohold', 'BAT 12V 5Ah', 'Bateria Selada (VRLA / Chumbo-Ácido)'],
  ['Tecnohold', 'LME-2200', 'Luminária de Emergência'],
  ['TECNOHOLD', 'PLA0014', ''],
];

describe('0071 — novos nós e árvore', () => {
  it('árvore continua sem ciclos/parent inválido após 0071', () => {
    expect(validateTaxonomyTree()).toEqual([]);
  });

  it('todos os novos stable codes existem com parent correto', () => {
    const byCode = new Map(CATALOG_TAXONOMY_NODES.map((n) => [n.code, n]));
    const expected: Record<string, string | null> = {
      'SDAI.SINALIZADORES': null, 'SDAI.SINALIZADORES.END': 'SDAI.SINALIZADORES', 'SDAI.SINALIZADORES.CONV': 'SDAI.SINALIZADORES',
      'SDAI.ALIMENTACAO': null, 'SDAI.ALIMENTACAO.AUXILIAR': 'SDAI.ALIMENTACAO',
      'SDAI.BATERIAS': null, 'SDAI.BATERIAS.SELADA': 'SDAI.BATERIAS',
      'SDAI.EMERGENCIA': null, 'SDAI.EMERGENCIA.LUMINARIAS': 'SDAI.EMERGENCIA',
      'SDAI.DETECTORES.GAS': 'SDAI.DETECTORES', 'SDAI.DETECTORES.LINEAR': 'SDAI.DETECTORES',
      'SDAI.CENTRAIS.COMPONENTES': 'SDAI.CENTRAIS',
      'SDAI.CENTRAIS.COMPONENTES.COMUNICACAO': 'SDAI.CENTRAIS.COMPONENTES',
      'SDAI.CENTRAIS.COMPONENTES.PROGRAMACAO': 'SDAI.CENTRAIS.COMPONENTES',
    };
    for (const [code, parent] of Object.entries(expected)) {
      expect(byCode.has(code), `nó ${code} ausente`).toBe(true);
      expect(byCode.get(code)!.parentCode).toBe(parent);
    }
  });

  it('Multicritério passou a existir na 0072 (com END), Bullet-free MULTI antigo nunca existiu', () => {
    expect(CATALOG_TAXONOMY_NODES.find((n) => n.code === 'SDAI.DETECTORES.MULTI')).toBeUndefined();
    expect(CATALOG_TAXONOMY_NODES.find((n) => n.code === 'SDAI.DETECTORES.MULTICRITERIO')).toBeDefined();
    expect(CATALOG_TAXONOMY_NODES.find((n) => n.code === 'SDAI.DETECTORES.MULTICRITERIO.END')?.parentCode).toBe('SDAI.DETECTORES.MULTICRITERIO');
  });

  it('nenhum alias normalizado aponta para nós diferentes (invariante real)', () => {
    const byNorm = new Map<string, Set<string>>();
    for (const a of CATALOG_TAXONOMY_ALIASES) {
      const k = normalizedCatalogKey(a.alias);
      (byNorm.get(k) ?? byNorm.set(k, new Set()).get(k)!).add(a.code);
    }
    const ambiguos = [...byNorm.entries()].filter(([, codes]) => codes.size > 1);
    expect(ambiguos).toEqual([]);
  });

  it('aliases novos resolvem para o nó certo', () => {
    expect(normalizeTaxonomyAlias('Strobe')).toBe('SDAI.SINALIZADORES');
    expect(normalizeTaxonomyAlias('VRLA')).toBe('SDAI.BATERIAS.SELADA');
    expect(normalizeTaxonomyAlias('Beam Detector')).toBe('SDAI.DETECTORES.LINEAR');
    expect(normalizeTaxonomyAlias('Detector de Gás')).toBe('SDAI.DETECTORES.GAS');
    expect(normalizeTaxonomyAlias('QFAE')).toBe('SDAI.ALIMENTACAO.AUXILIAR');
  });
});

describe('0071 — classificação determinística dos 51', () => {
  const results = PROD_51.map(([brand, model, sub]) => ({ brand, model, sub, r: classifyCatalogItem(item({ brand, model, subcategory: sub })) }));

  it('totais pós-0072: 49 CLASSIFICADO / 1 REVISAR / 1 NAO_CLASSIFICADO', () => {
    // 0071 deixava 45/5/1; a revisão 0072 promoveu por modelo AME 566, AMET12 IP-67,
    // MDZ 521 V2 e MCB485TH, restando só "Placa Fonte CIE" em REVISAR (e PLA0014 NC).
    const t = { CLASSIFICADO: 0, REVISAR: 0, NAO_CLASSIFICADO: 0 } as Record<string, number>;
    for (const x of results) t[x.r.status]++;
    expect(t).toEqual({ CLASSIFICADO: 49, REVISAR: 1, NAO_CLASSIFICADO: 1 });
  });

  it('exemplos de caminhos ALTA confiança', () => {
    const path = (m: string) => { const x = results.find((y) => y.model === m)!; return getTaxonomyPath(x.r.code!).map((n) => n.name).join(' > '); };
    expect(path('CIE 2500')).toBe('Centrais de Alarme de Incêndio > Equipamentos > Endereçável');
    expect(path('CIC 06L')).toBe('Centrais de Alarme de Incêndio > Equipamentos > Convencional');
    expect(path('DGC 423')).toBe('Detectores > Gás');
    expect(path('DFL 3100')).toBe('Detectores > Linear / Feixe');
    expect(path('SAV 521 E')).toBe('Sirenes / Sinalizadores > Endereçável');
    expect(path('BAT 12V 5Ah')).toBe('Baterias > Selada / VRLA');
    expect(path('LME-2200')).toBe('Iluminação de Emergência > Luminárias');
    expect(path('GW 521')).toBe('Centrais de Alarme de Incêndio > Componentes / Peças > Comunicação / Rede');
    expect(path('RP 520')).toBe('Repetidoras / Anunciadores'); // repetidor = anunciador, não componente
  });

  it('após 0072, só "Placa Fonte CIE" segue REVISAR entre os 51', () => {
    const rev = results.filter((x) => x.r.status === 'REVISAR').map((x) => x.model).sort();
    expect(rev).toEqual(['Placa Fonte CIE']);
  });

  it('PLA0014 (sem subcategoria) permanece NAO_CLASSIFICADO', () => {
    expect(results.find((x) => x.model === 'PLA0014')!.r).toEqual({ code: null, status: 'NAO_CLASSIFICADO' });
  });
});

describe('0071 — proteções', () => {
  it('CFTV permanece intacto (regras não mudaram)', () => {
    expect(classifyCatalogItem(item({ category: 'CFTV', brand: 'Intelbras', subcategory: 'Câmera IP', model: 'VIP 1230 B' })).code).toBe('CFTV.CAMERAS.IP.BULLET');
  });

  it('ALARME / BMS não recebem classificação', () => {
    expect(classifyCatalogItem(item({ category: 'ALARME', subcategory: 'Central de alarme', model: 'AMT 8000' }))).toEqual({ code: null, status: 'NAO_CLASSIFICADO' });
    expect(classifyCatalogItem(item({ category: 'BMS', subcategory: 'Controlador', model: 'SNC' }))).toEqual({ code: null, status: 'NAO_CLASSIFICADO' });
  });

  it('modelo genérico não revisado ainda cai em REVISAR na família (subcategoria genérica)', () => {
    // Um SIGA hipotético fora do mapa de revisão continua REVISAR pela regra de subcategoria.
    expect(classifyCatalogItem(item({ category: 'SDAI', brand: 'Edwards', subcategory: 'Detector', model: 'SIGA-ZZZ' }))).toEqual({ code: 'SDAI.DETECTORES', status: 'REVISAR' });
    expect(classifyCatalogItem(item({ category: 'SDAI', brand: 'Edwards', subcategory: 'Módulo', model: 'SIGA-CR' }))).toEqual({ code: 'SDAI.MODULOS', status: 'REVISAR' });
  });

  it('classificação não muta o produto', () => {
    const it = item({ category: 'SDAI', brand: 'Intelbras', subcategory: 'Central de Alarme Endereçável', model: 'CIE 2500' });
    const before = JSON.stringify(it);
    classifyCatalogItem(it);
    expect(JSON.stringify(it)).toBe(before);
  });

  it('getTaxonomyChildren lista as famílias SDAI incluindo as novas', () => {
    const familias = getTaxonomyChildren(null, 'SDAI').map((n) => n.code);
    for (const c of ['SDAI.SINALIZADORES', 'SDAI.ALIMENTACAO', 'SDAI.BATERIAS', 'SDAI.EMERGENCIA']) expect(familias).toContain(c);
  });
});
