import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_TEMPLATES } from './reportTemplatesData';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const clientBase = read('components/clients/ClientTechnicalBase.tsx');
const relatorios = read('components/views/RelatoriosView.tsx');

/* CORREÇÃO DEFINITIVA — o fluxo legado "Visita para Orçamento"/LEVANTAMENTO foi
 * removido. O Levantamento Técnico é só o motor 3D (TechnicalSurveyFlow).
 * Testes estruturais (§19) — sem render/browser. */

describe('A/E) Base Técnica → Novo levantamento abre o motor 3D', () => {
  it('ClientTechnicalBase renderiza TechnicalSurveyFlow', () => {
    expect(clientBase).toContain('<TechnicalSurveyFlow');
    expect(clientBase).not.toContain('ReportForm');
  });
});

describe('B/D) Relatórios: "Levantamento Técnico" abre o 3D, não o ReportForm', () => {
  it('o wizard oferece "Levantamento Técnico" com id próprio (não o legado)', () => {
    expect(relatorios).toMatch(/id:\s*'LEVANTAMENTO_TECNICO',\s*label:\s*'Levantamento Técnico'/);
  });
  it('o "Levantamento Técnico" lança o TechnicalSurveyFlow (motor 3D)', () => {
    expect(relatorios).toContain('launchTechnicalSurvey');
    expect(relatorios).toContain('<TechnicalSurveyFlow');
  });
  it('não cria mais o tipo legado LEVANTAMENTO em Relatórios', () => {
    expect(relatorios).not.toMatch(/id:\s*'LEVANTAMENTO'\b/);
  });
});

describe('C) "Visita para Orçamento" não existe mais na UI', () => {
  it('nenhuma menção a "Visita para Orçamento" em Relatórios', () => {
    expect(relatorios).not.toContain('Visita para Orçamento');
  });
});

describe('F/H) templates: nenhum LEVANTAMENTO oferecido para criação', () => {
  it('ALL_TEMPLATES não contém nenhum template tipo LEVANTAMENTO', () => {
    expect(ALL_TEMPLATES.some((t) => t.tipo === 'LEVANTAMENTO')).toBe(false);
    expect(ALL_TEMPLATES.some((t) => (t.codigo || '').startsWith('LEVANTAMENTO_'))).toBe(false);
  });
  it('outros tipos de relatório seguem disponíveis', () => {
    expect(ALL_TEMPLATES.some((t) => t.tipo === 'CORRETIVA')).toBe(true);
    expect(ALL_TEMPLATES.some((t) => t.tipo === 'PREVENTIVA')).toBe(true);
  });
  it('o filtro da lista não oferece LEVANTAMENTO', () => {
    expect(relatorios).toContain("['TODOS', 'CORRETIVA', 'PREVENTIVA']");
  });
});

describe('G) migration de remoção é filtrada e segura', () => {
  const mig = read('lib/db/migrations/0100_remove_legacy_levantamento.sql');
  it('remove apenas reports tipo LEVANTAMENTO (sem TRUNCATE / DELETE sem filtro)', () => {
    expect(mig).toContain("delete from public.reports where tipo = 'LEVANTAMENTO'");
    expect(mig).not.toMatch(/truncate/i);
    expect(mig).not.toMatch(/delete\s+from\s+public\.reports\s*;/i);
  });
  it('NÃO apaga tabelas do motor 3D', () => {
    expect(mig).not.toMatch(/delete\s+from\s+public\.(technical_surveys|devices|device_verifications|field_photos)/i);
  });
});
