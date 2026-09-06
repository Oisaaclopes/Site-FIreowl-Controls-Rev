import { describe, expect, it } from 'vitest';
import {
  activeDevices, summarizeGroups, summarizeCentrals, sortDevicesForArea,
  duplicateGroups, centralAddressAnomalies, filterDevices, importReview, displayGroup, assetCardView,
  importInconsistencyDevices,
} from './technicalBaseSummary';
import type { Device } from './types';

/* MELHORIA — Base Técnica: resumo/duplicados/ordenação (helpers puros). */

const dev = (o: Partial<Device>): Device => ({
  id: Math.random().toString(36).slice(2), clienteId: 'c1', sistema: 'SDAI', status: 'ativo', ...o,
} as Device);

const base: Device[] = [
  dev({ id: 'c', grupo: 'Central SDAI', fabricante: 'Tecnohold', modelo: 'Avalon Evolution 125', central: '1' }),
  dev({ id: 'd1', grupo: 'Detector de Fumaça', fabricante: 'Tecnohold', modelo: 'DFE485TH', central: '1', laco: '1', endereco: '9' }),
  dev({ id: 'd2', grupo: 'Detector de Fumaça', fabricante: 'Intelbras', modelo: 'DFE 521', central: '1', laco: '1', endereco: '10' }),
  dev({ id: 'a1', grupo: 'Acionador Manual', fabricante: 'Tecnohold', modelo: 'AME07', central: '1', laco: '1', endereco: '2' }),
  dev({ id: 'rem', grupo: 'Detector de Fumaça', fabricante: 'X', modelo: 'Y', status: 'removido', removedAt: '2024-01-01', central: '1', laco: '1', endereco: '99' }),
  dev({ id: 'sub', grupo: 'Sirene / Sinalizador', fabricante: 'Z', modelo: 'W', status: 'substituido', central: '1', laco: '2', endereco: '5' }),
];

describe('somente ativos (§26/I)', () => {
  it('I) devices removidos/substituídos não entram', () => {
    const act = activeDevices(base).map((d) => d.id);
    expect(act).toContain('c'); expect(act).toContain('d1');
    expect(act).not.toContain('rem'); expect(act).not.toContain('sub');
  });
});

describe('resumo por grupo e centrais (A/B/C)', () => {
  it('A) resumo conta apenas ativos', () => {
    const groups = summarizeGroups('SDAI', base);
    const det = groups.find((g) => g.group === 'Detector de Fumaça')!;
    expect(det.count).toBe(2); // rem removido não conta
  });
  it('B) central agrupada por fabricante/modelo', () => {
    const c = summarizeCentrals('SDAI', base);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ fabricante: 'Tecnohold', modelo: 'Avalon Evolution 125', count: 1 });
  });
  it('C) periféricos agrupados por tipo, com detalhamento fabricante→modelo', () => {
    const det = summarizeGroups('SDAI', base).find((g) => g.group === 'Detector de Fumaça')!;
    expect(det.brands.map((b) => b.brand).sort()).toEqual(['Intelbras', 'Tecnohold']);
    expect(det.brands.find((b) => b.brand === 'Tecnohold')!.models[0]).toEqual({ model: 'DFE485TH', count: 1 });
  });
  it('legado "Central" é normalizado para "Central SDAI"', () => {
    expect(displayGroup('SDAI', dev({ grupo: 'Central' }))).toBe('Central SDAI');
  });
});

describe('filtro por grupo (D)', () => {
  it('D) filtrar por grupo retorna só os ativos daquele grupo', () => {
    const only = filterDevices('SDAI', activeDevices(base), { group: 'Acionador Manual' });
    expect(only.map((d) => d.id)).toEqual(['a1']);
  });
});

describe('ordenação numérica SDAI (E/F)', () => {
  it('E/F) ordena central→laço→endereço numericamente (9 antes de 10)', () => {
    const scrambled = [
      dev({ id: 'e10', central: '1', laco: '1', endereco: '10' }),
      dev({ id: 'e2', central: '1', laco: '1', endereco: '2' }),
      dev({ id: 'e9', central: '1', laco: '1', endereco: '9' }),
      dev({ id: 'c2e1', central: '2', laco: '1', endereco: '1' }),
    ];
    expect(sortDevicesForArea('SDAI', scrambled).map((d) => d.id)).toEqual(['e2', 'e9', 'e10', 'c2e1']);
  });
});

describe('duplicados (G/H)', () => {
  it('G) duplicado SDAI por central+laço+endereço iguais', () => {
    const withDup = [...base, dev({ id: 'd1b', grupo: 'Detector de Fumaça', central: '1', laco: '1', endereco: '9' })];
    const groups = duplicateGroups('SDAI', withDup);
    expect(groups).toHaveLength(1);
    expect(groups[0].devices.map((d) => d.id).sort()).toEqual(['d1', 'd1b']);
  });
  it('H) endereços iguais em CENTRAIS diferentes não são duplicados', () => {
    const two = [
      dev({ id: 'x', central: '1', laco: '1', endereco: '5' }),
      dev({ id: 'y', central: '2', laco: '1', endereco: '5' }),
    ];
    expect(duplicateGroups('SDAI', two)).toEqual([]);
  });
  it('§22) central com laço/endereço é sinalizada como anomalia (revisão)', () => {
    const anomaly = [dev({ id: 'ca', grupo: 'Central SDAI', central: '1', laco: '1', endereco: '1' })];
    expect(centralAddressAnomalies('SDAI', anomaly).map((d) => d.id)).toEqual(['ca']);
  });
});

describe('revisão pós-importação (J/§18/§20)', () => {
  const imp: Device[] = [
    dev({ id: 'i1', source: 'IMPORTACAO', grupo: 'Detector de Fumaça', fabricante: 'Tecnohold', modelo: 'DFE485TH', central: '1', laco: '1', endereco: '1' }),
    dev({ id: 'i2', source: 'IMPORTACAO', grupo: 'Detector de Fumaça', modelo: '', central: '1', laco: '1', endereco: '1' }), // dup + sem modelo/fab
    dev({ id: 'i3', source: 'IMPORTACAO', grupo: 'Acionador Manual', fabricante: 'Tecnohold', modelo: 'AME07', condicao: undefined, central: '1', laco: '1', endereco: '2' }),
  ];
  it('J) importados sem condição NÃO viram NORMAL; contadores corretos', () => {
    const r = importReview('SDAI', imp);
    expect(r.importados).toBe(3);
    expect(r.duplicados).toBe(2);       // i1+i2 mesma identidade
    expect(r.semModelo).toBe(1);        // i2
    expect(r.semCondicao).toBe(3);      // nenhum verificado/condição
    expect(r.naoVerificados).toBe(3);
  });
  it('inconsistências: central com laço/endereço + sem grupo', () => {
    const list: Device[] = [
      dev({ id: 'ca', source: 'IMPORTACAO', grupo: 'Central SDAI', central: '1', laco: '1', endereco: '1' }), // anomalia
      dev({ id: 'nog', source: 'IMPORTACAO', grupo: '', central: '1', laco: '1', endereco: '6' }),             // sem grupo
      dev({ id: 'ok', source: 'IMPORTACAO', grupo: 'Acionador Manual', central: '1', laco: '1', endereco: '7' }),
    ];
    expect(importInconsistencyDevices('SDAI', list).map((d) => d.id).sort()).toEqual(['ca', 'nog']);
    expect(importReview('SDAI', list).inconsistencias).toBe(2);
  });
  it('edição/remoção alteram o resumo dinamicamente (§19)', () => {
    const before = importReview('SDAI', imp);
    // remove um dos duplicados → duplicados cai
    const after = importReview('SDAI', imp.map((d) => (d.id === 'i2' ? { ...d, status: 'removido', removedAt: 'x' } : d)));
    expect(before.duplicados).toBe(2);
    expect(after.duplicados).toBe(0);
    expect(after.importados).toBe(2);
  });
});

describe('card mobile — campos prioritários (Etapa B)', () => {
  it('expõe identificador/grupo/fabricante-modelo/local/condição/origem/verificação', () => {
    const v = assetCardView('SDAI', dev({ grupo: 'Sirene / Sinalizador', fabricante: 'Tecnohold', modelo: 'SAVE485TH', central: '1', laco: '1', endereco: '9', localizacao: 'Hall Escada P1', source: 'IMPORTACAO' }));
    expect(v.identifier).toContain('End. 9');
    expect(v.identifier).toContain('Laço 1');
    expect(v.group).toBe('Sirene / Sinalizador');
    expect(v.brandModel).toBe('Tecnohold · SAVE485TH');
    expect(v.local).toBe('Hall Escada P1');
    expect(v.originLabel).toBe('Importação');
  });
  it('importado sem condição NÃO vira NORMAL (§13/§20)', () => {
    const v = assetCardView('SDAI', dev({ source: 'IMPORTACAO', condicao: undefined, lastVerifiedAt: undefined }));
    expect(v.condition).toBeNull();
    expect(v.conditionLabel).toBe('');
    expect(v.verified).toBe(false);
    expect(v.verifiedLabel).toBe('Não verificado');
  });
});

describe('filtro por origem/verificação (M base)', () => {
  it('origem Importação e verificação nao_verificados', () => {
    const list = [
      dev({ id: 'm', source: 'MANUAL', lastVerifiedAt: '2024-01-01' }),
      dev({ id: 'imp', source: 'IMPORTACAO' }),
    ];
    expect(filterDevices('SDAI', list, { origem: 'IMPORTACAO' }).map((d) => d.id)).toEqual(['imp']);
    expect(filterDevices('SDAI', list, { verificacao: 'nao_verificados' }).map((d) => d.id)).toEqual(['imp']);
  });
});
