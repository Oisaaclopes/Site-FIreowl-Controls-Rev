import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { domainsForTable, REALTIME_TABLES } from './realtime/domains';
import { buildFinalizedServiceItems } from './finalizedServices';
import type { TechnicalSurvey } from './types';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const surveyFlow = read('components/clients/TechnicalSurveyFlow.tsx');
const relatorios = read('components/views/RelatoriosView.tsx');
const clientBase = read('components/clients/ClientTechnicalBase.tsx');
const surveyNav = read('lib/surveyNavigation.ts');
const finalizeLib = read('lib/technicalSurveys.ts');
const finalizeOrch = read('lib/surveyFinalize.ts');

const survey = (o: Partial<TechnicalSurvey>): TechnicalSurvey =>
  ({ id: 's1', clienteId: 'c1', area: 'SDAI', mode: 'COMPLETO', status: 'FINALIZADO', verifiedCount: 0, ...o } as TechnicalSurvey);

/* ===================================================================
 * Fiação da correção A/B/C/D — testes estruturais (§19, sem render/browser) +
 * unitários de identidade documental.
 * =================================================================== */

describe('A/B) realtime: technical_surveys integrado ao mecanismo existente', () => {
  it('technical_surveys é assinado pelo canal realtime (entra em REALTIME_TABLES)', () => {
    expect(REALTIME_TABLES).toContain('technical_surveys');
  });
  it('uma mudança em technical_surveys invalida o domínio surveys (e dashboard)', () => {
    expect(domainsForTable('technical_surveys')).toContain('surveys');
    expect(domainsForTable('technical_surveys')).toContain('dashboard');
  });
  it('mapeamentos existentes seguem intactos (sem regressão)', () => {
    expect(domainsForTable('reports')).toEqual(['reports', 'dashboard']);
    expect(domainsForTable('ordens_servico')).toEqual(['serviceOrders', 'agenda', 'dashboard']);
  });
  it('device_verifications NÃO é adicionado à invalidação (só o necessário)', () => {
    expect(REALTIME_TABLES).not.toContain('device_verifications');
    expect(domainsForTable('device_verifications')).toEqual([]);
  });
});

describe('D) finalização sem falso sucesso', () => {
  it('finish usa a orquestração runSurveyFinalize (fecha só no sucesso)', () => {
    expect(surveyFlow).toContain('runSurveyFinalize');
  });
  it('o catch que engolia o erro e fechava assim mesmo foi removido', () => {
    expect(surveyFlow).not.toContain('não bloqueia o fecho local');
  });
  it('onClose/onFinalized ficam dentro do onSuccess (só disparam confirmado)', () => {
    const block = surveyFlow.slice(surveyFlow.indexOf('onSuccess: () => {'));
    expect(block).toContain('onFinalized?.();');
    expect(block).toContain('onClose();');
  });
  it('a orquestração é pura: não cria linha em `reports`', () => {
    expect(finalizeOrch).not.toContain('reports');
  });
});

describe('A/B) listagem de Relatórios reflete a finalização sem F5', () => {
  it('RelatoriosView assina o domínio surveys', () => {
    expect(relatorios).toContain("useDomainRefresh('surveys'");
  });
  it('RelatoriosView recarrega direto ao finalizar (garantia independente do eco)', () => {
    expect(relatorios).toContain('onFinalized={() => refresh()}');
  });
});

describe('C) Cliente/Base Técnica dá acesso claro aos levantamentos', () => {
  it('carrega os levantamentos do cliente', () => {
    expect(clientBase).toContain('fetchSurveys');
    expect(clientBase).toContain("useDomainRefresh('surveys'");
  });
  it('EM_ANDAMENTO oferece Continuar e FINALIZADO oferece Abrir', () => {
    expect(clientBase).toContain('Continuar levantamento');
    expect(clientBase).toContain('Abrir levantamento');
  });
  it('FINALIZADO reutiliza o viewer/PDF existente (LevantamentoPdfInner)', () => {
    expect(clientBase).toContain('LevantamentoPdfInner');
  });
  it('a Base Técnica atualiza a lista ao finalizar (onFinalized)', () => {
    expect(clientBase).toContain('onFinalized={() => { onDevicesChanged(); loadSurveys(); }}');
  });
});

describe('continuar EM_ANDAMENTO respeita identidade e não duplica', () => {
  it('só retoma survey EM_ANDAMENTO pela sua identidade', () => {
    expect(surveyNav).toContain("status === 'EM_ANDAMENTO'");
  });
  it('reabrir apenas LÊ registros canônicos — não persiste/duplica device nem verificação', () => {
    expect(surveyNav).not.toContain('upsertDevice(');
    expect(surveyNav).not.toContain('addVerification(');
    expect(surveyNav).not.toContain('enqueueTechAsset(');
  });
});

describe('identidade documental = technical_survey_id, sem linha fake em reports', () => {
  it('o documento do levantamento é identificado pelo survey, nunca pela OS', () => {
    const items = buildFinalizedServiceItems({ surveys: [survey({ id: 'sv-42' })] });
    expect(items).toHaveLength(1);
    expect(items[0].origin).toBe('survey');
    expect(items[0].surveyId).toBe('sv-42');
    expect(items[0].sourceId).toBe('sv-42');
    expect(items[0].osId).toBeUndefined();
    expect(items[0].reportId).toBeUndefined();
  });
  it('finalizar um survey NÃO gera item de origin report (sem espelho artificial)', () => {
    const items = buildFinalizedServiceItems({ surveys: [survey({ id: 'sv-1' }), survey({ id: 'sv-2' })] });
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.origin === 'survey')).toBe(true);
    expect(items.some((i) => i.origin === 'report')).toBe(false);
  });
  it('a camada de survey não escreve na tabela reports', () => {
    expect(finalizeLib).not.toContain("from('reports')");
    expect(finalizeLib.toLowerCase()).not.toContain('insertreport');
  });
});
