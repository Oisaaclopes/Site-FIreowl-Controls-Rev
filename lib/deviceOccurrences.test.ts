import { describe, expect, it } from 'vitest';
import type { Device, DeviceOccurrence } from './types';
import { extractSdaiOccurrenceDrafts, filterByOperationalStatus, operationalCounts, operationalStatusForDevice } from './deviceOccurrences';

const d = (id: string, over: Partial<Device> = {}): Device => ({ id, clienteId: 'c1', sistema: 'SDAI', status: 'ativo', ...over });
const occ = (id: string, deviceId: string | undefined, type: DeviceOccurrence['occurrenceType'], status: DeviceOccurrence['status'] = 'OPEN'): DeviceOccurrence => ({
  id, dedupeKey: `bundle:${id}`, clienteId: 'c1', deviceId, occurrenceType: type, status,
  observedAt: '2026-09-07T12:00:00Z', sourceType: 'PREVENTIVA',
});

describe('ocorrências operacionais do checklist SDAI', () => {
  it('1. Desabilitados=Não não extrai cards', () => expect(extractSdaiOccurrenceDrafts({ dispositivos_desabilitados: 'Não', desabilitados: [{ device_id: 'd1' }] })).toEqual([]));
  it('2. Desabilitados=Sim extrai um card', () => expect(extractSdaiOccurrenceDrafts({ dispositivos_desabilitados: 'Sim', desabilitados: [{ device_id: 'd1' }] })).toHaveLength(1));
  it('3. quantidade é derivada do número de cards válidos', () => expect(extractSdaiOccurrenceDrafts({ dispositivos_desabilitados: 'Sim', desabilitados: [{ endereco: '1' }, { endereco: '2' }] })).toHaveLength(2));
  it('4. preserva device conhecido', () => expect(extractSdaiOccurrenceDrafts({ falha_ativa: 'Sim', falhas: [{ device_id: 'd1' }] })[0].deviceId).toBe('d1'));
  it('5. persiste tipo FAULT', () => expect(extractSdaiOccurrenceDrafts({ falha_ativa: 'Sim', falhas: [{ device_id: 'd1' }] })[0].occurrenceType).toBe('FAULT'));
  it('6. sem endereço não inventa device_id', () => expect(extractSdaiOccurrenceDrafts({ falha_ativa: 'Sim', falhas: [{ descricao: 'falha vista' }] })[0].deviceId).toBeUndefined());
  it('7. endereço inexistente é válido sem device_id', () => expect(extractSdaiOccurrenceDrafts({ falha_ativa: 'Sim', falhas: [{ laco: '1', endereco: '52' }] })[0]).toMatchObject({ loop: '1', address: '52', deviceId: undefined }));
  it('8. falha conhecida reflete status', () => expect(operationalStatusForDevice('d1', [occ('o1', 'd1', 'FAULT')])).toBe('FAULT'));
  it('9. desabilitado conhecido reflete status', () => expect(operationalStatusForDevice('d1', [occ('o1', 'd1', 'DISABLED')])).toBe('DISABLED'));
  it('10. alarme conhecido reflete status', () => expect(operationalStatusForDevice('d1', [occ('o1', 'd1', 'ALARM')])).toBe('ALARM'));
  it('11. ocorrência carrega observação para a pendência', () => expect(extractSdaiOccurrenceDrafts({ alarme_ativo: 'Sim', alarmes: [{ observacao: 'alarme ativo' }] })[0].notes).toBe('alarme ativo'));
  it('12. chave de retry permanece estável no payload', () => expect(occ('same', 'd1', 'FAULT').dedupeKey).toBe(occ('same', 'd1', 'FAULT').dedupeKey));
  it('13. ocorrência resolvida deixa de ser ativa', () => expect(operationalStatusForDevice('d1', [occ('o1', 'd1', 'FAULT', 'RESOLVED')])).toBe('NORMAL'));
  it('14. ocorrência resolvida permanece no histórico recebido', () => expect([occ('o1', 'd1', 'FAULT', 'RESOLVED')]).toHaveLength(1));
  it('15. lifecycle não é alterado pelo cálculo', () => { const dev = d('d1'); operationalStatusForDevice(dev.id, [occ('o1', dev.id, 'FAULT')]); expect(dev.status).toBe('ativo'); });
  it('16. identidade do device não é alterada', () => { const dev = d('d1', { fabricante: 'A', modelo: 'B', endereco: '7' }); operationalCounts([dev], [occ('o1', 'd1', 'FAULT')]); expect(dev).toMatchObject({ fabricante: 'A', modelo: 'B', endereco: '7' }); });
  it('17. filtros operacionais separam dimensões', () => expect(filterByOperationalStatus([d('d1'), d('d2')], [occ('o1', 'd1', 'FAULT')], 'FAULT').map((x) => x.id)).toEqual(['d1']));
  it('18. contadores usam devices ativos reais', () => expect(operationalCounts([d('d1'), d('d2'), d('d3', { status: 'removido' })], [occ('o1', 'd1', 'FAULT')])).toEqual({ total: 2, NORMAL: 1, FAULT: 1, DISABLED: 0, ALARM: 0 }));
  it('19. central pode receber ocorrência própria', () => expect(extractSdaiOccurrenceDrafts({ falha_ativa: 'Sim', falhas: [{ device_id: 'central-1', pertence_central: 'Sim' }] })[0].deviceId).toBe('central-1'));
  it('20. falha periférica permanece vinculada ao device específico', () => expect(extractSdaiOccurrenceDrafts({ falha_ativa: 'Sim', falhas: [{ device_id: 'det-37' }] })[0].deviceId).toBe('det-37'));
});
