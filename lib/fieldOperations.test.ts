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
  it('SAÍDA prevalece sobre OS em execução: FORA DE JORNADA, sem cliente', () => {
    const state = deriveFieldOperatorStates(
      [technician], [punch('SAIDA', 18), punch('ENTRADA', 8)], [order('em_execucao')], [client], now
    )[0];
    expect(state).toMatchObject({ status: 'FORA DE JORNADA', clientName: undefined, activeOs: undefined });
  });
  it('jornada aberta + OS apenas ABERTA (não iniciada) => EM JORNADA (não associa cliente)', () => {
    for (const s of ['aberta', 'agendada'] as const) {
      const state = deriveFieldOperatorStates([technician], [punch('ENTRADA', 8)], [order(s)], [client], now)[0];
      expect(state).toMatchObject({ status: 'EM JORNADA', clientName: undefined, activeOs: undefined, locationSource: 'punch' });
    }
  });
  it('atendimento encerrado (OS concluída) + jornada aberta => EM JORNADA', () => {
    const state = deriveFieldOperatorStates([technician], [punch('ENTRADA', 8)], [order('concluida')], [client], now)[0];
    expect(state.status).toBe('EM JORNADA');
  });
  it('atendimento encerrado + SAÍDA => FORA DE JORNADA', () => {
    const state = deriveFieldOperatorStates([technician], [punch('SAIDA', 18), punch('ENTRADA', 8)], [order('concluida')], [client], now)[0];
    expect(state.status).toBe('FORA DE JORNADA');
  });
  it('OS aberta de cliente antigo não vira localização atual; mostra o atendimento em execução real', () => {
    const clienteA = { id: 'cA', name: 'Cliente A (antigo)', address: 'Rua Antiga, 1' } as Client;
    const clienteB = { id: 'cB', name: 'Cliente B (atual)', address: 'Rua Atual, 2' } as Client;
    const osA: OrdemServico = { ...order('aberta'), id: 'osA', numero: 'OS-A', clienteId: 'cA' };
    const osB: OrdemServico = { ...order('em_execucao'), id: 'osB', numero: 'OS-B', clienteId: 'cB' };
    const state = deriveFieldOperatorStates([technician], [punch('ENTRADA', 8)], [osA, osB], [clienteA, clienteB], now)[0];
    expect(state).toMatchObject({ status: 'EM ATENDIMENTO', clientName: 'Cliente B (atual)', location: 'Rua Atual, 2' });
    expect(state.activeOs?.numero).toBe('OS-B');
  });
  it('batida com lat/lng + location_address mostra o endereço; sem endereço fica "sendo identificado"', () => {
    const semEndereco = deriveFieldOperatorStates([technician], [punch('SAIDA', 18, { locationAddress: undefined })], [], [], now)[0];
    expect(semEndereco).toMatchObject({ status: 'FORA DE JORNADA', location: 'Endereço sendo identificado', locationSource: 'punch' });
    const comEndereco = deriveFieldOperatorStates([technician], [punch('SAIDA', 18)], [], [], now)[0];
    expect(comEndereco.location).toBe('Rua X, 123');
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
