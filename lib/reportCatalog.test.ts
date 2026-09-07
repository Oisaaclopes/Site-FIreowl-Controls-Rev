import { describe, expect, it } from 'vitest';
import type { Device } from './types';
import { augmentCatalogForSdaiMaintenance, buildBaseReportCatalog, deviceLabel } from './reportCatalog';

describe('buildBaseReportCatalog (montagem compartilhada)', () => {
  const base = buildBaseReportCatalog({
    inventory: [
      { id: 'i1', name: 'Detector Fumaça', category: 'SDAI', subcategory: 'Detector', brand: 'Intelbras', model: 'DFI-2000', unit: 'pç' },
      { id: 'i2', name: 'Central Endereçável', category: 'SDAI', subcategory: 'Central', brand: 'Intelbras', model: 'AMT', unit: 'pç' },
    ],
    services: [{ id: 's1', title: 'Instalação', category: 'Serviços' }],
    brands: [{ name: 'Bosch' }],
    contracts: [{ id: 'C1', unit: 'Loja X', contractType: 'Preventiva SDAI' }],
  });

  it('categorias/itens/marcas/contratos derivam dos dados', () => {
    expect(base.categorias).toContain('SDAI');
    expect(base.itens).toContain('Detector Fumaça');
    expect(base.itens).toContain('Instalação');
    expect(base.marcas).toEqual(expect.arrayContaining(['Bosch', 'Intelbras']));
    expect(base.contratos).toEqual([{ id: 'C1', label: 'Preventiva SDAI (C1)' }]);
    expect(base.modelosPorGrupo?.centrais_sdai).toContain('AMT');
    // placeholders preenchidos por área
    expect(base.devices).toEqual([]);
    expect(base.pendenciasAbertas).toEqual([]);
  });
});

describe('augmentCatalogForSdaiMaintenance', () => {
  it('injeta devices do cliente e pendências abertas sem tocar a base', () => {
    const base = buildBaseReportCatalog({ inventory: [], services: [], brands: [], contracts: [] });
    const devices: Device[] = [
      { id: 'd1', clienteId: 'A', sistema: 'SDAI', status: 'ativo', tipoAtivo: 'Detector', central: 'C1', laco: 'L1', endereco: '046' },
    ];
    const cat = augmentCatalogForSdaiMaintenance(base, {
      devices,
      pendenciasAbertas: [{ id: 'p1', grupo: 'SDAI', descricao: 'Falha' }],
    });
    expect(cat.devices).toEqual([{ id: 'd1', label: 'Detector · C1/L1/046' }]);
    expect(cat.pendenciasAbertas?.[0]).toMatchObject({ id: 'p1' });
    expect(deviceLabel(devices[0])).toBe('Detector · C1/L1/046');
  });
});
