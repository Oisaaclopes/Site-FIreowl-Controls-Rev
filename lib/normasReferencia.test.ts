import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { getNormativeReferences, normasForamPersonalizadas, resolverNormasReferencia } from './normasReferencia';
import type { CommercialProposalData } from './types';

const temNorma = (lista: string[], codigo: string) => lista.some((n) => n.includes(codigo));
const legadoFixo = [
  'ABNT NBR 17240:2010 — Sistemas de detecção e alarme de incêndio',
  'NPT 019 — Sistema de Detecção e Alarme de Incêndio (Corpo de Bombeiros Militar do Paraná)',
  'ABNT NBR 5410:2004 — Instalações elétricas de baixa tensão',
];

describe('normas de referência por Área + Serviço', () => {
  it('ACESSO + Instalação → só NBR 5410 (sem NBR 17240/NPT 019)', () => {
    expect(getNormativeReferences({ areaPrincipal: ['acesso'], tipoServico: 'instalacao', modalidade: 'material_servico' })).toEqual([
      'ABNT NBR 5410 — Instalações elétricas de baixa tensão, quando aplicável aos serviços previstos neste escopo.',
    ]);
  });
  it('SDAI → NBR 17240 + NPT 019 (+ 5410 com execução elétrica)', () => {
    const inst = getNormativeReferences({ areaPrincipal: ['sdai'], tipoServico: 'instalacao' });
    expect(temNorma(inst, 'NBR 17240') && temNorma(inst, 'NPT 019') && temNorma(inst, 'NBR 5410')).toBe(true);
    const insp = getNormativeReferences({ areaPrincipal: ['sdai'], tipoServico: 'inspecao' });
    expect(temNorma(insp, 'NBR 17240') && temNorma(insp, 'NPT 019')).toBe(true);
    expect(temNorma(insp, 'NBR 5410')).toBe(false);
  });
  it('NBR 5410 só em tipos com intervenção elétrica clara (não Projeto/Manutenção)', () => {
    for (const tipo of ['instalacao', 'implantacao', 'retrofit', 'adequacao', 'integracao_serv']) {
      expect(temNorma(getNormativeReferences({ areaPrincipal: ['acesso'], tipoServico: tipo }), 'NBR 5410')).toBe(true);
    }
    for (const tipo of ['projeto', 'manut_preventiva', 'manut_corretiva', 'contrato_manut', 'inspecao', 'contrato_inspecao', 'comissionamento', 'outro']) {
      expect(getNormativeReferences({ areaPrincipal: ['acesso'], tipoServico: tipo })).toEqual([]);
      const sdai = getNormativeReferences({ areaPrincipal: ['sdai'], tipoServico: tipo });
      expect(temNorma(sdai, 'NBR 5410')).toBe(false);
      expect(temNorma(sdai, 'NBR 17240') && temNorma(sdai, 'NPT 019')).toBe(true);
    }
  });
  it('somente material / fornecimento não herda norma de instalação', () => {
    expect(getNormativeReferences({ areaPrincipal: ['acesso'], tipoServico: 'instalacao', modalidade: 'somente_material' })).toEqual([]);
    expect(getNormativeReferences({ areaPrincipal: ['sdai'], tipoServico: 'instalacao', modalidade: 'somente_material' })).toEqual([]);
    expect(getNormativeReferences({ areaPrincipal: ['acesso'], tipoServico: 'fornecimento' })).toEqual([]);
  });
  it('CFTV/ALARME/BMS sem norma inventada; 5410 só com escopo elétrico', () => {
    for (const area of ['cftv', 'alarme', 'bms']) {
      expect(getNormativeReferences({ areaPrincipal: [area], tipoServico: 'inspecao' })).toEqual([]);
      const inst = getNormativeReferences({ areaPrincipal: [area], tipoServico: 'retrofit' });
      expect(inst).toHaveLength(1);
      expect(temNorma(inst, 'NBR 5410')).toBe(true);
    }
  });
  it('múltiplas áreas combinam sem duplicar e sem SDAI quando ausente', () => {
    const combo = getNormativeReferences({ areaPrincipal: ['sdai', 'acesso', 'cftv', 'sdai'], tipoServico: 'instalacao' });
    expect(combo.filter((n) => n.includes('NBR 5410'))).toHaveLength(1);
    expect(combo.filter((n) => n.includes('NBR 17240'))).toHaveLength(1);
    expect(combo).toHaveLength(3);
    const semSdai = getNormativeReferences({ areaPrincipal: ['acesso', 'cftv', 'alarme'], tipoServico: 'instalacao' });
    expect(temNorma(semSdai, 'NBR 17240') || temNorma(semSdai, 'NPT 019')).toBe(false);
  });
  it('sem contexto não sugere nada (nunca fallback SDAI)', () => {
    expect(getNormativeReferences({})).toEqual([]);
    expect(getNormativeReferences({ tipoServico: 'instalacao' })).toEqual([]);
  });
});

describe('edição manual e snapshots', () => {
  const base: Partial<CommercialProposalData> = { areaPrincipal: ['acesso'], tipoServico: 'instalacao', modalidade: 'material_servico' };
  it('edição manual é preservada mesmo mudando Área/Serviço', () => {
    const manual = ['ABNT NBR 5410', 'Norma interna do cliente'];
    const p = { ...base, areaPrincipal: ['sdai'], diretrizesNormativas: manual, diretrizesEditadasManualmente: true };
    expect(resolverNormasReferencia(p)).toEqual(manual);
    expect(resolverNormasReferencia({ ...p, diretrizesNormativas: [] })).toEqual([]);
  });
  it('automático recalcula pelo contexto atual', () => {
    const p = { ...base, diretrizesNormativas: ['antiga'], diretrizesEditadasManualmente: false };
    expect(resolverNormasReferencia(p)).toEqual(getNormativeReferences(base));
  });
  it('PED-2026-286: padrão fixo SDAI antigo em pedido ACESSO é corrigido', () => {
    const p = { ...base, diretrizesNormativas: legadoFixo };
    expect(normasForamPersonalizadas(p)).toBe(false);
    const r = resolverNormasReferencia(p);
    expect(temNorma(r, 'NBR 17240') || temNorma(r, 'NPT 019')).toBe(false);
    expect(temNorma(r, 'NBR 5410')).toBe(true);
  });
  it('legado com normas salvas pelo usuário é preservado, com ou sem área', () => {
    expect(resolverNormasReferencia({ ...base, diretrizesNormativas: ['Norma do cliente'] })).toEqual(['Norma do cliente']);
    expect(resolverNormasReferencia({ diretrizesNormativas: ['Norma do cliente'] })).toEqual(['Norma do cliente']);
  });
  it('contexto desconhecido nunca assume SDAI (nem para o padrão fixo legado)', () => {
    expect(resolverNormasReferencia({ diretrizesNormativas: legadoFixo })).toEqual([]);
    expect(resolverNormasReferencia({ diretrizesNormativas: [] })).toEqual([]);
    expect(resolverNormasReferencia({})).toEqual([]);
  });
});

describe('fonte única', () => {
  it('editor e PDFs consomem lib/normasReferencia (sem lista SDAI fixa)', () => {
    for (const path of ['proposta/PropostaDocument', 'documentos/OrcamentoDocument', 'documentos/LaudoTecnicoDocument']) {
      const src = readFileSync(`components/${path}.tsx`, 'utf8');
      expect(src).toContain('resolverNormasReferencia(p)');
      expect(src).not.toMatch(/p\.diretrizesNormativas\.(filter|join)|itens=\{p\.diretrizesNormativas\}/);
    }
    const laudo = readFileSync('components/documentos/LaudoTecnicoDocument.tsx', 'utf8');
    expect(laudo).not.toMatch(/NBR 17240|NPT 019/);
    const editor = readFileSync('components/proposta/CommercialProposalModal.tsx', 'utf8');
    expect(editor).toContain('getNormativeReferences(contextoTitulo)');
    expect(editor).toContain('diretrizesEditadasManualmente: diretrizesManual !== null');
    expect(editor).not.toContain('ABNT NBR 17240:2010');
  });
});
