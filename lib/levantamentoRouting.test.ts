import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const clientBase = read('components/clients/ClientTechnicalBase.tsx');
const relatorios = read('components/views/RelatoriosView.tsx');
const reportForm = read('components/reports/ReportForm.tsx');

/* CORREÇÃO pós-3D.5 — invariantes de entry point (§9). Estruturais (sem render):
 * garantem que o Levantamento Técnico operacional abre o motor 3D e que o fluxo
 * de relatório é a "Visita para Orçamento" (comercial), sem se chamar Levantamento
 * Técnico nem expor Pontual/Parcial/Completo para novos relatórios. */

describe('A) Base Técnica → Novo levantamento abre o motor 3D', () => {
  it('ClientTechnicalBase renderiza TechnicalSurveyFlow no "Novo levantamento"', () => {
    expect(clientBase).toContain('Novo levantamento');
    expect(clientBase).toContain('setShowSurvey(true)');
    expect(clientBase).toContain('<TechnicalSurveyFlow');
    // e nunca abre o ReportForm legado
    expect(clientBase).not.toContain('ReportForm');
  });
});

describe('B/C) Relatórios não abre o legado como "Levantamento Técnico"', () => {
  it('o tipo LEVANTAMENTO do wizard é rotulado "Visita para Orçamento"', () => {
    expect(relatorios).toMatch(/id:\s*'LEVANTAMENTO',\s*label:\s*'Visita para Orçamento'/);
  });
  it('nenhum CTA do wizard se chama "Levantamento Técnico"', () => {
    // não deve existir um botão/label "Levantamento Técnico" (que abriria ReportForm)
    expect(relatorios).not.toContain("label: 'Levantamento Técnico'");
  });
  it('a lista aponta o usuário para a Base Técnica como Levantamento Técnico', () => {
    expect(relatorios).toContain('Base Técnica → Novo levantamento');
  });
});

describe('D) Visita para Orçamento não expõe Pontual/Parcial/Completo para novos', () => {
  it('o seletor de modo só aparece para rascunho LEGADO (isLegacySurveyDraft)', () => {
    expect(reportForm).toContain('isLegacySurveyDraft');
    expect(reportForm).toMatch(/template\.tipo === 'LEVANTAMENTO' && isLegacySurveyDraft/);
  });
  it('novo relatório entra como completo (template integral), sem exigir modo', () => {
    expect(reportForm).toContain("(storedSurveyMode || 'completo')");
  });
  it('o motor 3D (TechnicalSurveyFlow) não foi tocado por este fix', () => {
    const flow = read('components/clients/TechnicalSurveyFlow.tsx');
    expect(flow).toContain('persistSurveyAsset'); // segue alimentando a Base
  });
});
