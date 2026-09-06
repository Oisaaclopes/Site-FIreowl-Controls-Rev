import { describe, expect, it } from 'vitest';
import { buildSdaiHierarchy, coveragePct } from './technicalBaseSummary';
import type { Device } from './types';

/* ETAPA D — hierarquia SDAI (Central → Laço → Dispositivos). */

const dev = (o: Partial<Device>): Device => ({ id: Math.random().toString(36).slice(2), clienteId: 'c1', sistema: 'SDAI', status: 'ativo', ...o } as Device);

const base: Device[] = [
  dev({ id: 'c1', grupo: 'Central SDAI', fabricante: 'Tecnohold', modelo: 'Avalon Evolution 125', central: '1' }),
  dev({ id: 'a', grupo: 'Detector de Fumaça', central: '1', laco: '1', endereco: '10' }),
  dev({ id: 'b', grupo: 'Acionador Manual', central: '1', laco: '1', endereco: '2' }),
  dev({ id: 'c', grupo: 'Sirene / Sinalizador', central: '1', laco: '1', endereco: '9' }),
  dev({ id: 'd', grupo: 'Detector de Fumaça', central: '1', laco: '2', endereco: '1' }),
  dev({ id: 'e', grupo: 'Detector de Fumaça', central: '2', laco: '1', endereco: '1', lastVerifiedAt: '2024-01-01' }),
  dev({ id: 'nl', grupo: 'Módulo', central: '1', endereco: '' }),                 // sem laço
  dev({ id: 'nc', grupo: 'Detector de Fumaça', laco: '1', endereco: '5' }),       // sem central
  dev({ id: 'rem', grupo: 'Detector de Fumaça', central: '1', laco: '1', endereco: '99', status: 'removido', removedAt: 'x' }),
];

describe('estrutura central → laço → dispositivos', () => {
  const h = buildSdaiHierarchy(base);
  it('centrais ordenadas numericamente; "sem central" por último', () => {
    expect(h.centrals.map((c) => c.label)).toEqual(['Central 1', 'Central 2', 'Sem central definida']);
  });
  it('Central 1 tem Laço 1, Laço 2 e Sem laço', () => {
    const c1 = h.centrals.find((c) => c.central === '1')!;
    expect(c1.loops.map((l) => l.label)).toEqual(['Laço 1', 'Laço 2', 'Sem laço definido']);
  });
  it('E/F) endereços em ordem numérica (2, 9, 10 — não 10,2,9)', () => {
    const l1 = h.centrals.find((c) => c.central === '1')!.loops.find((l) => l.laco === '1')!;
    expect(l1.devices.map((d) => d.endereco)).toEqual(['2', '9', '10']); // 'rem' excluído
  });
  it('Central 2 / Laço 1 separado de Central 1', () => {
    const c2 = h.centrals.find((c) => c.central === '2')!;
    expect(c2.loops.map((l) => l.laco)).toEqual(['1']);
  });
});

describe('cabeçalho da central + contagens', () => {
  const h = buildSdaiHierarchy(base);
  const c1 = () => h.centrals.find((c) => c.central === '1')!;
  it('usa o device real da Central como fonte de fabricante/modelo (§21)', () => {
    expect(c1().fabricante).toBe('Tecnohold');
    expect(c1().modelo).toBe('Avalon Evolution 125');
  });
  it('I) devices removidos fora dos totais', () => {
    // c1: central + 3 (laço1) + 1 (laço2) + 1 (sem laço) = 6, sem o removido
    expect(c1().cadastrados).toBe(6);
  });
  it('§29) cadastrado ≠ verificado', () => {
    expect(c1().verificados).toBe(0);
    expect(h.centrals.find((c) => c.central === '2')!.verificados).toBe(1);
  });
});

describe('central duplicada / sem central / sem laço (§24/§25/§26)', () => {
  it('central duplicada é sinalizada (centralRegistros > 1)', () => {
    const dupCentral = [...base, dev({ id: 'c1b', grupo: 'Central SDAI', fabricante: 'Tecnohold', modelo: 'Avalon Evolution 125', central: '1' })];
    const c1 = buildSdaiHierarchy(dupCentral).centrals.find((c) => c.central === '1')!;
    expect(c1.centralRegistros).toBe(2);
  });
  it('sem central e sem laço não são escondidos', () => {
    const h = buildSdaiHierarchy(base);
    expect(h.centrals.some((c) => c.central === null)).toBe(true);
    expect(h.centrals.find((c) => c.central === '1')!.loops.some((l) => l.laco === null)).toBe(true);
  });
});

describe('expected/cobertura (§28/§30)', () => {
  it('expected desconhecido permanece null; cobertura null', () => {
    const c1 = buildSdaiHierarchy(base).centrals[0];
    expect(c1.expected).toBeNull();
    expect(coveragePct(c1.expected, c1.verificados)).toBeNull();
  });
  it('cobertura calculada só quando expected é real', () => {
    expect(coveragePct(79, 61)).toBe(77.2);
    expect(coveragePct(0, 5)).toBeNull();
  });
});
