import { describe, expect, it } from 'vitest';
import {
  pdfTableColumns, conditionCounts, relevantAssets, surveyResumo, surveyConclusao, evidenceCaption, RELEVANT_CONDITIONS,
} from './surveyPdfData';
import { Device } from './types';

const dev = (over: Partial<Device>): Device => ({
  id: over.id || Math.random().toString(36).slice(2), clienteId: 'c', sistema: over.sistema || 'SDAI', status: 'ativo',
  technicalAttributes: {}, ...over,
} as Device);

describe('pdfTableColumns — adaptação por disciplina (§50)', () => {
  it('SDAI usa Laço/Endereço/Descrição, não rótulo genérico', () => {
    const labels = pdfTableColumns('SDAI').map((c) => c.label);
    expect(labels).toEqual(['Tipo', 'Laço', 'Endereço', 'Descrição', 'Local', 'Condição']);
  });
  it('CFTV usa IP/Canal (§78 — nunca "Endereço")', () => {
    const labels = pdfTableColumns('CFTV').map((c) => c.label);
    expect(labels).toContain('IP');
    expect(labels).toContain('Canal');
    expect(labels).not.toContain('Endereço');
  });
  it('extrai valores dos atributos certos', () => {
    const d = dev({ sistema: 'CFTV', technicalAttributes: { ip: '10.0.0.5', canal: '8' }, tipoAtivo: 'Câmera' });
    const cols = pdfTableColumns('CFTV');
    const row = cols.map((c) => c.value(d));
    expect(row[0]).toBe('Câmera');
    expect(row[1]).toBe('10.0.0.5');
    expect(row[2]).toBe('8');
  });
  it('BMS combina IP/ID e Acesso combina Controladora/Porta', () => {
    const bms = dev({ sistema: 'BMS', technicalAttributes: { device_instance: '2001', protocolo: 'BACnet' } });
    const ipId = pdfTableColumns('BMS')[1].value(bms);
    expect(ipId).toBe('2001');
    const acc = dev({ sistema: 'CONTROLE_ACESSO', technicalAttributes: { controladora: 'CTRL1', porta: 'Entrada' } });
    expect(pdfTableColumns('CONTROLE_ACESSO')[1].value(acc)).toBe('CTRL1 / Entrada');
  });
});

describe('conditionCounts / relevantAssets (§52)', () => {
  const devices = [
    dev({ condicao: 'NORMAL' }), dev({ condicao: 'NORMAL' }),
    dev({ condicao: 'COM_AVARIA' }), dev({ condicao: 'INOPERANTE' }),
    dev({ condicao: undefined }),
  ];
  it('conta por condição', () => {
    const c = conditionCounts(devices);
    expect(c.NORMAL).toBe(2);
    expect(c.COM_AVARIA).toBe(1);
    expect(c.NAO_INFORMADA).toBe(1);
  });
  it('relevantes = com avaria/inoperante/inadequado/não localizado', () => {
    expect(relevantAssets(devices)).toHaveLength(2);
    expect(RELEVANT_CONDITIONS).toContain('COM_AVARIA');
    expect(RELEVANT_CONDITIONS).not.toContain('NORMAL');
  });
});

describe('surveyResumo — números reais por modo (§46/§47/§48)', () => {
  it('COMPLETO traz esperados/verificados/cobertura', () => {
    const r = surveyResumo({ mode: 'COMPLETO', devices: [dev({ condicao: 'NORMAL' })], expected: 187, verified: 184, naoLocalizado: 2, novo: 1, coveragePct: 98.4 });
    const map = Object.fromEntries(r.map((l) => [l.label, l.value]));
    expect(map['Ativos esperados']).toBe('187');
    expect(map['Verificados']).toBe('184');
    expect(map['Cobertura']).toBe('98.4%');
  });
  it('PONTUAL é enxuto (sem cobertura global)', () => {
    const r = surveyResumo({ mode: 'PONTUAL', devices: [dev({ condicao: 'COM_AVARIA' })] });
    const labels = r.map((l) => l.label);
    expect(labels).toContain('Ativos registrados');
    expect(labels).not.toContain('Cobertura');
  });
  it('PARCIAL destaca escopo e cobertura do escopo', () => {
    const r = surveyResumo({ mode: 'PARCIAL', devices: [dev({}), dev({})], expected: 40, coveragePct: 5, scopeText: 'Laço 2' });
    const map = Object.fromEntries(r.map((l) => [l.label, l.value]));
    expect(map['Escopo']).toBe('Laço 2');
    expect(map['Cobertura do escopo']).toBe('5%');
  });
});

describe('surveyConclusao — factual, sem 100% quando há pendência (§40/§55)', () => {
  it('COMPLETO com pendência não afirma completude', () => {
    const t = surveyConclusao({ mode: 'COMPLETO', total: 187, verified: 184, pendente: 3 });
    expect(t).toContain('pendências de cobertura');
    expect(t).not.toContain('100%');
  });
  it('COMPLETO sem pendência conclui a reconciliação', () => {
    const t = surveyConclusao({ mode: 'COMPLETO', total: 187, verified: 187, pendente: 0 });
    expect(t).toContain('reconciliação da base foi concluída');
  });
  it('PONTUAL é restrito à visita', () => {
    expect(surveyConclusao({ mode: 'PONTUAL', total: 3 })).toContain('pontual');
  });
});

describe('evidenceCaption (§54)', () => {
  it('mostra tipo, identificador, local e condição', () => {
    const d = dev({ sistema: 'SDAI', tipoAtivo: 'Acionador Manual', laco: '2', endereco: '45', localizacao: 'Corredor', condicao: 'COM_AVARIA' });
    const cap = evidenceCaption('SDAI', d);
    expect(cap).toContain('Acionador Manual');
    expect(cap).toContain('Laço 2');
    expect(cap).toContain('Corredor');
    expect(cap).toContain('Com avaria');
  });
});
