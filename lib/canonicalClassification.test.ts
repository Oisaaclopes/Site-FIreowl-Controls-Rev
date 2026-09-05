import { describe, expect, it } from 'vitest';
import { classifyCanonical, fireowlCatalogNorm, subcategoriesWithoutNode, CANONICAL_MAP } from './canonicalClassification';

/* SANEAMENTO DIRIGIDO — classificação canônica (mapa explícito, testável). */

describe('classifyCanonical — mapeamento seguro (A/B/C/D/F)', () => {
  it('A) item SDAI com família conhecida recebe o nó SDAI correto (CLASSIFICADO)', () => {
    expect(classifyCanonical('SDAI', 'Detector de Fumaça Endereçável (Óptico)')).toEqual({ code: 'SDAI.DETECTORES.FUMACA.END', status: 'CLASSIFICADO' });
    expect(classifyCanonical('SDAI', 'Central de Alarme Endereçável')).toEqual({ code: 'SDAI.CENTRAIS.EQUIP.END', status: 'CLASSIFICADO' });
  });
  it('B) item CFTV nunca recebe nó SDAI', () => {
    const r = classifyCanonical('CFTV', 'Câmera IP');
    expect(r.code?.startsWith('CFTV.')).toBe(true);
    // e uma subcategoria SDAI declarada em área CFTV não casa o mapa SDAI
    expect(classifyCanonical('CFTV', 'Detector de Fumaça Endereçável (Óptico)')).toEqual({ status: 'NAO_CLASSIFICADO' });
  });
  it('C) subcategory sem nó não é classificada', () => {
    expect(classifyCanonical('SDAI', 'Bornes e conectores diversos')).toEqual({ status: 'NAO_CLASSIFICADO' });
  });
  it('D) família ambígua (tipo/tecnologia) vai para REVISAR, não classifica errado', () => {
    expect(classifyCanonical('SDAI', 'Detector')).toEqual({ code: 'SDAI.DETECTORES', status: 'REVISAR' });
    expect(classifyCanonical('SDAI', 'Acionador Manual à Prova de Tempo (IP66)')).toEqual({ code: 'SDAI.ACIONADORES', status: 'REVISAR' });
  });
  it('F) status é CLASSIFICADO só quando inequívoco', () => {
    expect(classifyCanonical('SDAI', 'Bateria Selada (VRLA / Chumbo-Ácido)').status).toBe('CLASSIFICADO');
    expect(classifyCanonical('SDAI', 'Módulo Endereçador de Zona Convencional').status).toBe('REVISAR');
  });
});

describe('classifyCanonical — sem área/subcategoria e áreas sem taxonomia (§5/§7/§8)', () => {
  it('sem subcategory → NAO_CLASSIFICADO (não inventa família)', () => {
    expect(classifyCanonical('SDAI', '')).toEqual({ status: 'NAO_CLASSIFICADO' });
    expect(classifyCanonical('SDAI', undefined)).toEqual({ status: 'NAO_CLASSIFICADO' });
  });
  it('ALARME/BMS/CONTROLE_ACESSO não têm taxonomia nesta fase → NAO_CLASSIFICADO', () => {
    expect(classifyCanonical('ALARME', 'Central de Alarme').status).toBe('NAO_CLASSIFICADO');
    expect(classifyCanonical('BMS', 'Controladora').status).toBe('NAO_CLASSIFICADO');
    expect(classifyCanonical('CONTROLE_ACESSO', 'Leitor').status).toBe('NAO_CLASSIFICADO');
  });
});

describe('exceção controlada Fonte Auxiliar × Placa Fonte', () => {
  it('fonte auxiliar de verdade → CLASSIFICADO', () => {
    expect(classifyCanonical('SDAI', 'Fonte de Alimentação Auxiliar (SDAI)', 'QFAE485TH')).toEqual({ code: 'SDAI.ALIMENTACAO.AUXILIAR', status: 'CLASSIFICADO' });
  });
  it('"Placa Fonte" da central → REVISAR na família (não é fonte auxiliar)', () => {
    expect(classifyCanonical('SDAI', 'Fonte de Alimentação Auxiliar (SDAI)', 'Placa Fonte CIE')).toEqual({ code: 'SDAI.ALIMENTACAO', status: 'REVISAR' });
  });
});

describe('determinismo / idempotência (I) e normalização (§4)', () => {
  it('I) função pura: mesma entrada → mesma saída', () => {
    const a = classifyCanonical('SDAI', 'Detector de Gás (CO / GLP / Amônia)');
    const b = classifyCanonical('sdai', ' detector de gás (co / glp / amônia) ');
    expect(a).toEqual(b);
    expect(a).toEqual({ code: 'SDAI.DETECTORES.GAS', status: 'CLASSIFICADO' });
  });
  it('normaliza caixa/acento/pontuação de forma determinística', () => {
    expect(fireowlCatalogNorm('Detector de Fumaça Endereçável (Óptico)')).toBe('detectordefumacaenderecaveloptico');
  });
  it('sem duplicidade de subnorm dentro da mesma área', () => {
    for (const area of Object.keys(CANONICAL_MAP)) {
      const subs = CANONICAL_MAP[area].map((e) => e.subnorm);
      expect(new Set(subs).size).toBe(subs.length);
    }
  });
});

describe('subcategoriesWithoutNode (§8 relatório)', () => {
  it('lista apenas subcategorias reais sem nó, deduplicadas', () => {
    const out = subcategoriesWithoutNode([
      { category: 'SDAI', subcategory: 'Detector de Fumaça Endereçável (Óptico)' }, // tem nó
      { category: 'SDAI', subcategory: 'Painel solar auxiliar' },                    // sem nó
      { category: 'ALARME', subcategory: 'Sensor IVP' },                             // área sem taxonomia
      { category: 'SDAI', subcategory: '' },                                         // ignorado
    ]);
    expect(out).toContain('sdai:Painel solar auxiliar');
    expect(out).toContain('alarme:Sensor IVP');
    expect(out).not.toContain('sdai:Detector de Fumaça Endereçável (Óptico)');
  });
});
