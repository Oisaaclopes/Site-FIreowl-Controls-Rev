import { describe, expect, it } from 'vitest';
import {
  OS_PRESERVE_MESSAGE,
  attendanceHasContent,
  nextOsSequence,
  osSafeDeleteDecision,
  routineExecutionResetStatus,
  type OsSafeDeleteInput,
} from './osSafeDelete';

/** OS limpa (aberta, sem nenhum vínculo). Cada teste liga um bloqueio por vez. */
const limpa = (over: Partial<OsSafeDeleteInput> = {}): OsSafeDeleteInput => ({
  status: 'aberta',
  hasPendencias: false,
  hasReport: false,
  hasDeviceVerification: false,
  hasEvidenceItem: false,
  hasFieldPhoto: false,
  hasFieldPhotoComparison: false,
  hasHours: false,
  hasFinance: false,
  attendancesWithContent: 0,
  ...over,
});

describe('osSafeDeleteDecision — elegibilidade (§2/§3/§4/§11)', () => {
  it('OS aberta sem histórico → exclui', () => {
    expect(osSafeDeleteDecision(limpa())).toEqual({ canDelete: true });
  });
  it('OS agendada automática sem histórico → exclui', () => {
    expect(osSafeDeleteDecision(limpa({ status: 'agendada' }))).toEqual({ canDelete: true });
  });
  it('OS com attendance vazio (0 com conteúdo) → exclui (atendimento removido junto)', () => {
    expect(osSafeDeleteDecision(limpa({ attendancesWithContent: 0 })).canDelete).toBe(true);
  });

  it('OS em execução → bloqueia', () => {
    expect(osSafeDeleteDecision(limpa({ status: 'em_execucao' }))).toEqual({ canDelete: false, reason: OS_PRESERVE_MESSAGE });
  });
  it('OS concluída → bloqueia', () => {
    expect(osSafeDeleteDecision(limpa({ status: 'concluida' })).canDelete).toBe(false);
  });
  it('OS cancelada → bloqueia (conservador)', () => {
    expect(osSafeDeleteDecision(limpa({ status: 'cancelada' })).canDelete).toBe(false);
  });

  const bloqueios: [keyof OsSafeDeleteInput, unknown][] = [
    ['hasReport', true],                 // relatório (os_id OU service_attendance_id)
    ['hasDeviceVerification', true],
    ['hasEvidenceItem', true],
    ['hasFieldPhoto', true],
    ['hasFieldPhotoComparison', true],
    ['hasPendencias', true],
    ['hasHours', true],
    ['hasFinance', true],
    ['attendancesWithContent', 1],       // atendimento executado
  ];
  it.each(bloqueios)('bloqueia quando %s presente', (campo, valor) => {
    const d = osSafeDeleteDecision(limpa({ [campo]: valor } as Partial<OsSafeDeleteInput>));
    expect(d.canDelete).toBe(false);
    expect(d.reason).toBe(OS_PRESERVE_MESSAGE);
  });
});

describe('attendanceHasContent — atendimento vazio x com conteúdo (§4)', () => {
  const vazio = { status: 'EM_EXECUCAO' as const };
  it('EM_EXECUCAO sem nada → vazio', () => {
    expect(attendanceHasContent(vazio)).toBe(false);
  });
  it('FINALIZADO → tem conteúdo', () => {
    expect(attendanceHasContent({ status: 'FINALIZADO' })).toBe(true);
  });
  it('qualquer sinal de execução/assinatura → tem conteúdo', () => {
    expect(attendanceHasContent({ ...vazio, result: 'RESOLVIDO' })).toBe(true);
    expect(attendanceHasContent({ ...vazio, finishedAt: '2026-09-07T10:00:00Z' })).toBe(true);
    expect(attendanceHasContent({ ...vazio, diagnosis: 'x' })).toBe(true);
    expect(attendanceHasContent({ ...vazio, executionNotes: 'y' })).toBe(true);
    expect(attendanceHasContent({ ...vazio, signatureStatus: 'SIGNED' })).toBe(true);
    expect(attendanceHasContent({ ...vazio, signaturePath: 'p.png' })).toBe(true);
    expect(attendanceHasContent({ ...vazio, signatureName: 'Fulano' })).toBe(true);
    expect(attendanceHasContent({ ...vazio, signedAt: '2026-09-07T10:00:00Z' })).toBe(true);
  });
  it('strings em branco não contam como conteúdo', () => {
    expect(attendanceHasContent({ ...vazio, diagnosis: '   ', executionNotes: '', signatureName: '  ' })).toBe(false);
  });
});

describe('routineExecutionResetStatus — coerência para regerar (§5)', () => {
  it('os_gerada → agendado (permite gerar nova OS sem duplicar)', () => {
    expect(routineExecutionResetStatus('os_gerada')).toBe('agendado');
  });
  it('demais estados não são alterados', () => {
    expect(routineExecutionResetStatus('agendado')).toBe('agendado');
    expect(routineExecutionResetStatus('previsto')).toBe('previsto');
  });
});

describe('nextOsSequence — número nunca reutilizado (§10)', () => {
  it('considera o teto APOSENTADO mesmo quando maior que o vivo', () => {
    // OS-2026-0005 excluída (aposentado=5), maior viva = 0004 → próxima 0006, nunca 0005.
    expect(nextOsSequence(4, 5)).toBe(6);
  });
  it('sem números aposentados → sequência normal', () => {
    expect(nextOsSequence(4, 0)).toBe(5);
  });
  it('vivo maior que aposentado → segue o vivo', () => {
    expect(nextOsSequence(7, 5)).toBe(8);
  });
});
