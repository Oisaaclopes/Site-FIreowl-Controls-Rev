import { describe, expect, it } from 'vitest';
import type { AssetMaintenancePolicy, Device } from './types';
import { computeMaintenanceRows, sortMaintenanceRows, type LastTestInfo } from './maintenanceAssets';

const device = (p: Partial<Device> & Pick<Device, 'id'>): Device => ({
  clienteId: 'A', sistema: 'SDAI', status: 'ativo', tipoAtivo: 'Detector', ...p,
});
const policyPadrao: AssetMaintenancePolicy = {
  id: 'p', escopo: 'PADRAO', area: 'SDAI', tipoAtivo: 'Detector',
  periodicidadeValor: 12, periodicidadeUnidade: 'MES', ativa: true,
};

describe('computeMaintenanceRows', () => {
  const ref = '2026-06-01';

  it('ativo com política e último teste → status derivado (VENCIDO)', () => {
    const last = new Map<string, LastTestInfo>([['d1', { verifiedAt: '2025-05-10', condicao: 'NORMAL' }]]);
    const rows = computeMaintenanceRows([device({ id: 'd1' })], [policyPadrao], last, { referenceDate: ref });
    expect(rows).toHaveLength(1);
    expect(rows[0].proximoTeste).toBe('2026-05-10'); // 2025-05-10 + 12 MES
    expect(rows[0].status).toBe('VENCIDO');           // ref 2026-06-01 > 2026-05-10
    expect(rows[0].ultimaCondicao).toBe('NORMAL');
  });

  it('ativo com política mas SEM teste → SEM_HISTORICO (não "vencido" sem data-base)', () => {
    const rows = computeMaintenanceRows([device({ id: 'd2' })], [policyPadrao], new Map(), { referenceDate: ref });
    expect(rows[0].status).toBe('SEM_HISTORICO');
    expect(rows[0].proximoTeste).toBeUndefined();
    expect(rows[0].policy).not.toBeNull();
  });

  it('ativo sem política casada → SEM_POLITICA', () => {
    const rows = computeMaintenanceRows([device({ id: 'd3', tipoAtivo: 'Sirene' })], [policyPadrao], new Map(), {
      referenceDate: ref,
    });
    // policyPadrao é para Detector; Sirene não casa (tipo diferente).
    expect(rows[0].status).toBe('SEM_POLITICA');
    expect(rows[0].policy).toBeNull();
  });

  it('EM_DIA quando o próximo teste está distante', () => {
    const last = new Map<string, LastTestInfo>([['d4', { verifiedAt: '2026-05-10' }]]);
    const rows = computeMaintenanceRows([device({ id: 'd4' })], [policyPadrao], last, { referenceDate: '2026-06-01' });
    expect(rows[0].proximoTeste).toBe('2027-05-10');
    expect(rows[0].status).toBe('EM_DIA');
  });

  it('filtra por área e ignora ativos não-ativos por padrão', () => {
    const devices = [
      device({ id: 'a', sistema: 'CFTV' }),
      device({ id: 'b', sistema: 'SDAI', status: 'removido' }),
      device({ id: 'c', sistema: 'SDAI' }),
    ];
    const rows = computeMaintenanceRows(devices, [policyPadrao], new Map(), { referenceDate: ref, area: 'SDAI' });
    expect(rows.map((r) => r.device.id)).toEqual(['c']); // CFTV filtrado; removido excluído
  });
});

describe('sortMaintenanceRows', () => {
  it('ordena VENCIDO → PROXIMO → SEM_POLITICA → EM_DIA', () => {
    const last = new Map<string, LastTestInfo>([
      ['venc', { verifiedAt: '2024-01-01' }],
      ['dia', { verifiedAt: '2026-05-10' }],
      ['prox', { verifiedAt: '2025-06-05' }],
    ]);
    const devices = [
      device({ id: 'dia' }),
      device({ id: 'sempol', tipoAtivo: 'Sirene' }),
      device({ id: 'venc' }),
      device({ id: 'prox' }),
    ];
    const rows = sortMaintenanceRows(
      computeMaintenanceRows(devices, [policyPadrao], last, { referenceDate: '2026-06-01' })
    );
    expect(rows.map((r) => r.status)).toEqual(['VENCIDO', 'PROXIMO', 'SEM_POLITICA', 'EM_DIA']);
  });
});
