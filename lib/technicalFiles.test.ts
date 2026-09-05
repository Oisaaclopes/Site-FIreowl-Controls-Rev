import { describe, expect, it } from 'vitest';
import { FILE_TYPES, fileTypeLabel, fileTypeIcon, fmtFileSize, deviceOptionLabel } from './technicalFiles';
import type { Device } from './types';

/* MELHORIA UX — arquivos técnicos: rótulos/ícones (enum preservado) + contexto. */

const dev = (o: Partial<Device>): Device => ({ id: 'x', clienteId: 'c1', sistema: 'SDAI', status: 'ativo', ...o } as Device);

describe('tipos de arquivo — enum preservado (E)', () => {
  it('valores gravados batem com os backup_type existentes', () => {
    expect(FILE_TYPES.map((t) => t.value)).toEqual([
      'BACKUP_COMPLETO', 'PROGRAMACAO', 'BASE_DISPOSITIVOS', 'CONFIGURACAO', 'EXPORTACAO', 'OUTRO',
    ]);
  });
  it('rótulo amigável e ícone por tipo; fallback seguro', () => {
    expect(fileTypeLabel('PROGRAMACAO')).toBe('Programação');
    expect(fileTypeIcon('PROGRAMACAO')).toBe('code');
    expect(fileTypeLabel('DESCONHECIDO_X')).toBe('DESCONHECIDO X');
    expect(fileTypeIcon('DESCONHECIDO_X')).toBe('description');
    expect(fileTypeLabel(undefined)).toBe('Arquivo');
  });
});

describe('tamanho de arquivo (C)', () => {
  it('formata B/KB/MB', () => {
    expect(fmtFileSize(512)).toBe('512 B');
    expect(fmtFileSize(2048)).toBe('2 KB');
    expect(fmtFileSize(2_516_582)).toBe('2.4 MB');
    expect(fmtFileSize(undefined)).toBe('');
  });
});

describe('rótulo contextual do equipamento (§8)', () => {
  it('inclui grupo, fabricante/modelo e identificador da disciplina', () => {
    const label = deviceOptionLabel(dev({ grupo: 'Central SDAI', fabricante: 'Tecnohold', modelo: 'Avalon Evolution 125', central: '1' }));
    expect(label).toContain('Central SDAI');
    expect(label).toContain('Tecnohold Avalon Evolution 125');
  });
  it('normaliza grupo legado e cai para o id quando não há dados', () => {
    expect(deviceOptionLabel(dev({ grupo: 'Central', central: '2' }))).toContain('Central SDAI');
    expect(deviceOptionLabel(dev({ id: 'only-id' }))).toBe('Ativo');
  });
});
