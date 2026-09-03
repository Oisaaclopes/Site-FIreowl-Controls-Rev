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

describe('ETAPA 3A — jornada, operação e atendimento (precedência §11/§33)', () => {
  const operationLink = {
    technicianId: 'u1', operationId: 'op1', operationName: 'Auditoria SDAI', operationType: 'AUDITORIA', clientId: 'c1',
  };
  const attendanceLink = {
    technicianId: 'u1', attendanceId: 'att1', workOrderId: 'os1', clientId: 'c1', osNumero: 'OS-2026-0001', startedAt: new Date(2026, 8, 3, 9, 42).getTime(),
  };

  it('técnico em jornada + operação ativa => EM OPERAÇÃO', () => {
    const state = deriveFieldOperatorStates(
      [technician], [punch('ENTRADA', 8)], [], [client], now, { operations: [operationLink] }
    )[0];
    expect(state.status).toBe('EM OPERAÇÃO');
    expect(state.activeOperation).toMatchObject({ id: 'op1', name: 'Auditoria SDAI', type: 'AUDITORIA', clientName: 'Cliente Real' });
    expect(state.location).toBe('Av. da OS, 10');
    expect(state.locationSource).toBe('operation');
  });

  it('operação ativa com técnico FORA de jornada NÃO gera EM OPERAÇÃO', () => {
    const state = deriveFieldOperatorStates(
      [technician], [punch('SAIDA', 18), punch('ENTRADA', 8)], [], [client], now, { operations: [operationLink] }
    )[0];
    expect(state.status).toBe('FORA DE JORNADA');
    expect(state.activeOperation).toBeUndefined();
  });

  it('técnico em jornada + atendimento em execução => EM ATENDIMENTO', () => {
    const state = deriveFieldOperatorStates(
      [technician], [punch('ENTRADA', 8)], [order('em_execucao')], [client], now, { attendances: [attendanceLink] }
    )[0];
    expect(state.status).toBe('EM ATENDIMENTO');
    expect(state.activeAttendance).toMatchObject({ id: 'att1', workOrderId: 'os1', osNumero: 'OS-2026-0001' });
    expect(state.activeAttendance?.startedAt).toBe(new Date(2026, 8, 3, 9, 42).getTime());
  });

  it('precedência: atendimento em execução > operação ativa', () => {
    const state = deriveFieldOperatorStates(
      [technician], [punch('ENTRADA', 8)], [], [client], now, { operations: [operationLink], attendances: [attendanceLink] }
    )[0];
    expect(state.status).toBe('EM ATENDIMENTO');
    expect(state.activeOperation).toBeUndefined();
  });

  it('OS aberta sem atendimento NÃO gera EM ATENDIMENTO (fica EM OPERAÇÃO se houver operação)', () => {
    const state = deriveFieldOperatorStates(
      [technician], [punch('ENTRADA', 8)], [order('aberta')], [client], now, { operations: [operationLink] }
    )[0];
    expect(state.status).toBe('EM OPERAÇÃO');
  });

  it('atendimento FORA de jornada NÃO gera EM ATENDIMENTO (SAÍDA prevalece)', () => {
    const state = deriveFieldOperatorStates(
      [technician], [punch('SAIDA', 18), punch('ENTRADA', 8)], [], [client], now, { attendances: [attendanceLink] }
    )[0];
    expect(state.status).toBe('FORA DE JORNADA');
    expect(state.activeAttendance).toBeUndefined();
  });

  it('ordenação por prioridade: ATENDIMENTO < OPERAÇÃO < JORNADA < FORA', () => {
    const techs = [
      { id: 'u1', name: 'Ana', usesTimeClock: true },
      { id: 'u2', name: 'Bruno', usesTimeClock: true },
      { id: 'u3', name: 'Caio', usesTimeClock: true },
      { id: 'u4', name: 'Davi', usesTimeClock: true },
    ] as typeof technician[];
    const p = (uid: string, type: TimePunch['type'], hour: number): TimePunch => ({ ...punch(type, hour), userId: uid });
    const states = deriveFieldOperatorStates(
      techs,
      [p('u1', 'ENTRADA', 8), p('u2', 'ENTRADA', 8), p('u3', 'ENTRADA', 8), p('u4', 'SAIDA', 18)],
      [], [client], now,
      {
        attendances: [{ ...attendanceLink, technicianId: 'u1' }],
        operations: [{ ...operationLink, technicianId: 'u2' }],
      }
    );
    expect(states.map((s) => s.status)).toEqual(['EM ATENDIMENTO', 'EM OPERAÇÃO', 'EM JORNADA', 'FORA DE JORNADA']);
  });
});
