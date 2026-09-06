import { describe, expect, it } from 'vitest';
import { buildFinalizedServiceItems, countFinalizedServices } from './finalizedServices';
import type { ReportInstance, ServiceAttendance, TechnicalSurvey, OrdemServico } from './types';

const os = (o: Partial<OrdemServico>): OrdemServico => ({ id: 'os1', tipo: 'corretiva', status: 'concluida', ...o } as OrdemServico);
const report = (o: Partial<ReportInstance>): ReportInstance => ({ id: 'r1', templateCodigo: 'X', tipo: 'CORRETIVA', status: 'finalizado', ...o } as ReportInstance);
const att = (o: Partial<ServiceAttendance>): ServiceAttendance => ({ id: 'a1', workOrderId: 'os1', status: 'FINALIZADO', ...o } as ServiceAttendance);
const survey = (o: Partial<TechnicalSurvey>): TechnicalSurvey => ({ id: 's1', clienteId: 'c1', area: 'SDAI', mode: 'COMPLETO', status: 'FINALIZADO', verifiedCount: 0, ...o } as TechnicalSurvey);

describe('buildFinalizedServiceItems (Bloco 5B)', () => {
  it('atendimento finalizado SEM report aparece, classificado pela OS', () => {
    const items = buildFinalizedServiceItems({
      attendances: [att({ id: 'a1', workOrderId: 'os1' })],
      ordens: [os({ id: 'os1', tipo: 'instalacao', numero: 'OS-1' })],
    });
    expect(items).toHaveLength(1);
    expect(items[0].origin).toBe('attendance');
    expect(items[0].type).toBe('INSTALACAO');
    expect(items[0].osNumero).toBe('OS-1');
    expect(items[0].documentSource).toBe('Documentos da OS');
  });

  it('1 OS + múltiplos atendimentos finalizados = múltiplos documentos (não some por os_id, §9)', () => {
    const items = buildFinalizedServiceItems({
      attendances: [
        att({ id: 'a1', workOrderId: 'os3' }),
        att({ id: 'a2', workOrderId: 'os3' }),
        att({ id: 'a3', workOrderId: 'os3' }),
      ],
      ordens: [os({ id: 'os3', tipo: 'corretiva', numero: 'OS-2026-0003' })],
    });
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.osNumero === 'OS-2026-0003')).toBe(true);
    expect(new Set(items.map((i) => i.attendanceId)).size).toBe(3);
  });

  it('report + atendimentos na MESMA OS: todos aparecem (OS é contexto, não identidade §9)', () => {
    const items = buildFinalizedServiceItems({
      reports: [report({ id: 'r1', osId: 'os1', tipo: 'CORRETIVA' })],
      attendances: [att({ id: 'a1', workOrderId: 'os1' }), att({ id: 'a2', workOrderId: 'os1' })],
      ordens: [os({ id: 'os1', tipo: 'corretiva' })],
    });
    expect(items).toHaveLength(3);
    expect(items.filter((i) => i.origin === 'report')).toHaveLength(1);
    expect(items.filter((i) => i.origin === 'attendance')).toHaveLength(2);
  });

  it('o mesmo registro nunca conta duas vezes (dedupe por id da entidade, §11)', () => {
    const r = report({ id: 'r1', osId: 'os1' });
    const items = buildFinalizedServiceItems({ reports: [r, r], ordens: [os({ id: 'os1' })] });
    expect(items).toHaveLength(1);
  });

  it('atendimento em OUTRA OS (sem report) coexiste com o report', () => {
    const items = buildFinalizedServiceItems({
      reports: [report({ id: 'r1', osId: 'os1' })],
      attendances: [att({ id: 'a2', workOrderId: 'os2' })],
      ordens: [os({ id: 'os1' }), os({ id: 'os2', tipo: 'preventiva' })],
    });
    expect(items).toHaveLength(2);
    expect(items.some((i) => i.origin === 'report')).toBe(true);
    expect(items.some((i) => i.origin === 'attendance' && i.type === 'PREVENTIVA')).toBe(true);
  });

  it('technical survey finalizado aparece como Levantamento Técnico', () => {
    const items = buildFinalizedServiceItems({ surveys: [survey({ id: 's1' })] });
    expect(items).toHaveLength(1);
    expect(items[0].origin).toBe('survey');
    expect(items[0].type).toBe('LEVANTAMENTO_TECNICO');
  });

  it('serviço em execução NÃO aparece como finalizado', () => {
    const items = buildFinalizedServiceItems({
      reports: [report({ id: 'r1', status: 'em_execucao' })],
      attendances: [att({ id: 'a1', status: 'EM_EXECUCAO' })],
      surveys: [survey({ id: 's1', status: 'EM_ANDAMENTO' })],
      ordens: [os({ id: 'os1' })],
    });
    expect(items).toHaveLength(0);
  });

  it('ordena por data desc', () => {
    const items = buildFinalizedServiceItems({
      reports: [
        report({ id: 'rOld', osId: 'osA', finalizadoEm: '2026-01-01T10:00:00Z' }),
        report({ id: 'rNew', osId: 'osB', finalizadoEm: '2026-06-01T10:00:00Z' }),
      ],
    });
    expect(items.map((i) => i.sourceId)).toEqual(['rNew', 'rOld']);
  });

  it('contadores refletem os serviços finalizados reais (Levantamentos ≠ 0)', () => {
    const items = buildFinalizedServiceItems({
      reports: [report({ id: 'r1', osId: 'os1', tipo: 'PREVENTIVA' })],
      attendances: [att({ id: 'a1', workOrderId: 'os2' })],
      surveys: [survey({ id: 's1' }), survey({ id: 's2' })],
      ordens: [os({ id: 'os1', tipo: 'preventiva' }), os({ id: 'os2', tipo: 'corretiva' })],
    });
    const c = countFinalizedServices(items);
    expect(c.total).toBe(4);
    expect(c.byType.PREVENTIVA).toBe(1);
    expect(c.byType.CORRETIVA).toBe(1);
    expect(c.byType.LEVANTAMENTO_TECNICO).toBe(2);
  });
});
