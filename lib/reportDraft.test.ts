import { describe, expect, it } from 'vitest';
import { reportDraftKey, pickActiveTemplate } from './reportDraft';

describe('pickActiveTemplate — atendimento aberto adota versão mais nova (BUG raiz)', () => {
  const tpl = (versao: number, marker: string) => ({ versao, secoes: [{ key: 'central', campos: [{ key: marker }] }] });
  it('rascunho v1 (legado) + vigente v2 → usa v2 (não fica preso ao snapshot)', () => {
    const r = pickActiveTemplate({ draftSnapshot: tpl(1, 'alarme_motivo'), draftVersion: 1, current: tpl(2, 'alarmes') });
    expect(r.source).toBe('current');
    expect(r.version).toBe(2);
    expect(r.template.secoes[0].campos[0].key).toBe('alarmes');
  });
  it('rascunho v2 + vigente v2 → mantém o snapshot do rascunho (congelado)', () => {
    const r = pickActiveTemplate({ draftSnapshot: tpl(2, 'alarmes'), draftVersion: 2, current: tpl(2, 'alarmes') });
    expect(r.source).toBe('draft');
    expect(r.version).toBe(2);
  });
  it('rascunho v3 (mais novo) + vigente v2 → mantém v3 (nunca regride)', () => {
    const r = pickActiveTemplate({ draftSnapshot: tpl(3, 'x'), draftVersion: 3, current: tpl(2, 'alarmes') });
    expect(r.source).toBe('draft');
    expect(r.version).toBe(3);
  });
  it('sem rascunho → usa a definição vigente', () => {
    const r = pickActiveTemplate({ draftSnapshot: null, current: tpl(2, 'alarmes') });
    expect(r.source).toBe('current');
  });
});

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
