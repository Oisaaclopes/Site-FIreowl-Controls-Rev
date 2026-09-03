import { describe, expect, it } from 'vitest';
import { deriveFieldOperatorStates, hasOpenJourney } from './fieldOperations';
import { Client, OrdemServico, TimePunch } from './types';
import { ManagedUser } from './users';

const now = new Date(2026, 8, 3, 14).getTime();
const technician = { id: 'u1', name: 'Ana', role: 'TECNICO', status: 'ATIVO', usesTimeClock: true } as ManagedUser;
const punch = (type: TimePunch['type'], hour: number, extra: Partial<TimePunch> = {}): TimePunch => ({
  id: `${type}-${hour}`, userId: 'u1', employeeName: 'Ana', timestamp: '', type,
  locationStr: 'Rua X, 123', locationAddress: 'Rua X, 123', lat: -23.3, lng: -51.1, status: 'APROVADO',
  at: new Date(2026, 8, 3, hour).getTime(), ...extra,
});
const order = (status: OrdemServico['status']): OrdemServico => ({
  id: 'os1', numero: 'OS-2026-0001', clienteId: 'c1', tecnicoResponsavelId: 'u1',
  tipo: 'corretiva', status, prioridade: 'media', pendenciaIds: [],
});
const client = { id: 'c1', name: 'Cliente Real', address: 'Av. da OS, 10' } as Client;

describe('localização operacional', () => {
  it('classifica jornada aberta sem OS como EM JORNADA', () => {
    expect(deriveFieldOperatorStates([technician], [punch('ENTRADA', 8)], [], [], now)[0].status).toBe('EM JORNADA');
  });
  it('classifica OS ativa como EM ATENDIMENTO e usa seu vínculo real de cliente/endereço', () => {
    const state = deriveFieldOperatorStates([technician], [punch('ENTRADA', 8)], [order('em_execucao')], [client], now)[0];
    expect(state).toMatchObject({ status: 'EM ATENDIMENTO', clientName: 'Cliente Real', location: 'Av. da OS, 10', locationSource: 'os' });
  });
  it('classifica saída e batida antiga como FORA DE JORNADA', () => {
    expect(hasOpenJourney([punch('SAIDA', 18)], now)).toBe(false);
    expect(hasOpenJourney([punch('ENTRADA', 8, { at: now - 86_400_000 })], now)).toBe(false);
  });
  it('usa última localização válida e tolera ausência de GPS/endereço', () => {
    const noGps = punch('RETORNO', 13, { lat: 0, lng: 0, locationStr: 'Sem localização', locationAddress: undefined });
    expect(deriveFieldOperatorStates([technician], [noGps, punch('ENTRADA', 8)], [], [], now)[0].location).toBe('Rua X, 123');
    expect(deriveFieldOperatorStates([technician], [noGps], [], [], now)[0].location).toBe('Localização não informada');
  });
  it('considera horário efetivo de ajuste e ignora OS concluída/cancelada', () => {
    const adjusted = punch('ENTRADA', 8, { at: new Date(2026, 8, 3, 9).getTime(), effectiveSource: 'adjusted' });
    expect(hasOpenJourney([adjusted], now)).toBe(true);
    for (const status of ['concluida', 'cancelada'] as const) {
      expect(deriveFieldOperatorStates([technician], [adjusted], [order(status)], [client], now)[0]).toMatchObject({ status: 'EM JORNADA', clientName: undefined, locationSource: 'punch' });
    }
  });
  it('não infere cliente a partir de coordenadas', () => {
    expect(deriveFieldOperatorStates([technician], [punch('ENTRADA', 8)], [], [client], now)[0].clientName).toBeUndefined();
  });
  it('não inclui funcionário com controle de ponto desativado', () => {
    expect(deriveFieldOperatorStates([{ id: 'u1', name: 'Ana', usesTimeClock: false }], [punch('ENTRADA', 8)], [], [], now)).toEqual([]);
  });
});
