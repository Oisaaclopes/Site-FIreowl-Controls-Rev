import { describe, expect, it } from 'vitest';
import { attendanceResultLabel, osDocumentFileName } from './osDocuments';
import type { OrdemServico } from './types';

const os = (over: Partial<OrdemServico>): OrdemServico => ({
  id: 'os_abc12345', numero: 'OS-2026-0003', tipo: 'corretiva', status: 'concluida',
  prioridade: 'media', pendenciaIds: [], ...over,
});

describe('osDocumentFileName (§47)', () => {
  it('OS: prefixo + número + cliente saneado, .pdf', () => {
    expect(osDocumentFileName('OS', os({}), 'Muffato Foods')).toBe('OS-OS-2026-0003-MUFFATO-FOODS.pdf');
  });
  it('Relatório técnico: prefixo próprio', () => {
    expect(osDocumentFileName('RELATORIO-TECNICO-OS', os({}), 'Muffato Foods'))
      .toBe('RELATORIO-TECNICO-OS-OS-2026-0003-MUFFATO-FOODS.pdf');
  });
  it('remove acentos e caracteres inválidos do cliente', () => {
    expect(osDocumentFileName('OS', os({}), 'Condomínio São João & Cia')).toBe('OS-OS-2026-0003-CONDOMINIO-SAO-JOAO-CIA.pdf');
  });
  it('usa id curto quando não há número', () => {
    expect(osDocumentFileName('OS', os({ numero: undefined }), 'ACME')).toBe('OS-OS-ABC12-ACME.pdf');
  });
  it('cliente vazio não deixa hífen solto', () => {
    expect(osDocumentFileName('OS', os({}), '')).toBe('OS-OS-2026-0003.pdf');
  });
});

describe('attendanceResultLabel', () => {
  it('mapeia os resultados canônicos', () => {
    expect(attendanceResultLabel('RESOLVIDO')).toBe('Resolvido');
    expect(attendanceResultLabel('PARCIALMENTE_RESOLVIDO')).toBe('Parcialmente resolvido');
    expect(attendanceResultLabel('NAO_RESOLVIDO')).toBe('Não resolvido');
    expect(attendanceResultLabel(undefined)).toBe('—');
  });
});
