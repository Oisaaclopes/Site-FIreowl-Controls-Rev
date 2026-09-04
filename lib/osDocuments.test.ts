import { describe, expect, it } from 'vitest';
import { attendanceResultLabel, osDocumentFileName } from './osDocuments';
import type { OrdemServico } from './types';

const os = (over: Partial<OrdemServico>): OrdemServico => ({
  id: 'a1b2c3d4-e5f6-7890', numero: 'OS-2026-0003', tipo: 'corretiva', status: 'concluida',
  prioridade: 'media', pendenciaIds: [], ...over,
});

describe('osDocumentFileName (§21/§47)', () => {
  it('OS: sem duplicar o prefixo "OS" (o número já o contém)', () => {
    expect(osDocumentFileName('os', os({}), 'Muffato Foods')).toBe('OS-2026-0003-MUFFATO-FOODS.pdf');
  });
  it('Relatório técnico: prefixo próprio, sem OS-OS', () => {
    expect(osDocumentFileName('relatorio', os({}), 'Muffato Foods'))
      .toBe('RELATORIO-TECNICO-OS-2026-0003-MUFFATO-FOODS.pdf');
  });
  it('remove acentos e caracteres inválidos do cliente', () => {
    expect(osDocumentFileName('os', os({}), 'Condomínio São João & Cia')).toBe('OS-2026-0003-CONDOMINIO-SAO-JOAO-CIA.pdf');
  });
  it('sem número usa id curto (OS-<id>)', () => {
    expect(osDocumentFileName('os', os({ numero: undefined }), 'ACME')).toBe('OS-A1B2C3D4-ACME.pdf');
  });
  it('cliente vazio não deixa hífen solto', () => {
    expect(osDocumentFileName('os', os({}), '')).toBe('OS-2026-0003.pdf');
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
