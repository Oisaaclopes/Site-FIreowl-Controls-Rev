import { describe, expect, it } from 'vitest';
import { reportDraftKey } from './reportDraft';

describe('reportDraftKey — identidade por atendimento (1 OS → N atendimentos)', () => {
  it('dois atendimentos da MESMA OS têm rascunhos diferentes', () => {
    const a = reportDraftKey({ codigo: 'PREVENTIVA_SDAI_CONTRATO', clienteId: 'C', serviceAttendanceId: 'attA', osId: 'OS100' });
    const b = reportDraftKey({ codigo: 'PREVENTIVA_SDAI_CONTRATO', clienteId: 'C', serviceAttendanceId: 'attB', osId: 'OS100' });
    expect(a).not.toBe(b);
    expect(a).toContain('attA');
    expect(b).toContain('attB');
  });
  it('reabrir o MESMO atendimento recupera o mesmo rascunho', () => {
    const k1 = reportDraftKey({ codigo: 'T', clienteId: 'C', serviceAttendanceId: 'attA', osId: 'OS100' });
    const k2 = reportDraftKey({ codigo: 'T', clienteId: 'C', serviceAttendanceId: 'attA', osId: 'OS100' });
    expect(k1).toBe(k2);
  });
  it('serviceAttendanceId vence o osId', () => {
    expect(reportDraftKey({ codigo: 'T', serviceAttendanceId: 'attA', osId: 'OS100' }))
      .toBe('fireowl_atendimento_rascunho:T:sem_cliente:attA');
  });
  it('sem atendimento → fallback legado por OS', () => {
    expect(reportDraftKey({ codigo: 'T', clienteId: 'C', osId: 'OS100' }))
      .toBe('fireowl_atendimento_rascunho:T:C:OS100');
  });
  it('avulso (sem atendimento nem OS) → legado avulso', () => {
    expect(reportDraftKey({ codigo: 'T', clienteId: 'C' }))
      .toBe('fireowl_atendimento_rascunho:T:C:avulso');
  });
});
