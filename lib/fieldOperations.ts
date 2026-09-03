import { Client, OrdemServico, TimePunch } from './types';
import type { TimeClockParticipant } from './users';

export type FieldOperationalStatus = 'EM ATENDIMENTO' | 'EM JORNADA' | 'FORA DE JORNADA';

/**
 * Atendimento operacional ATIVO = OS EM EXECUÇÃO atribuída ao técnico. Uma OS
 * apenas 'aberta'/'agendada' é backlog/atribuição, NÃO um atendimento em curso;
 * 'concluida'/'cancelada' são terminais. Só 'em_execucao' significa "o técnico
 * iniciou este atendimento e ainda não o encerrou".
 */
const isActiveAttendance = (os: OrdemServico) => os.status === 'em_execucao';

export interface FieldOperatorState {
  userId: string;
  name: string;
  status: FieldOperationalStatus;
  activeOs?: OrdemServico;
  clientName?: string;
  location: string;
  locationSource: 'os' | 'punch' | 'none';
  lastPunch?: TimePunch;
  updatedAt?: number;
}

const hasCoordinates = (punch: TimePunch) =>
  Number.isFinite(punch.lat) && Number.isFinite(punch.lng) && (punch.lat !== 0 || punch.lng !== 0);

const sameLocalDay = (left: number, right: number) => {
  const a = new Date(left);
  const b = new Date(right);
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
};

/** Jornada aberta exige evento efetivo de hoje e sem SAIDA posterior. */
export function hasOpenJourney(punches: TimePunch[], now = Date.now()): boolean {
  const latest = punches.filter((p) => p.at != null).sort((a, b) => (b.at || 0) - (a.at || 0))[0];
  return Boolean(latest?.at && sameLocalDay(latest.at, now) && latest.type !== 'SAIDA');
}

export function deriveFieldOperatorStates(
  technicians: TimeClockParticipant[],
  punches: TimePunch[],
  orders: OrdemServico[],
  clients: Client[],
  now = Date.now()
): FieldOperatorState[] {
  const clientById = new Map(clients.map((client) => [client.id, client]));
  // Só OS EM EXECUÇÃO conta como atendimento; a mais antiga prevista primeiro.
  const attendanceByTechnician = new Map<string, OrdemServico>();
  for (const order of orders) {
    if (!order.tecnicoResponsavelId || !isActiveAttendance(order)) continue;
    const current = attendanceByTechnician.get(order.tecnicoResponsavelId);
    if (!current || (order.dataPrevista || '') < (current.dataPrevista || '')) {
      attendanceByTechnician.set(order.tecnicoResponsavelId, order);
    }
  }

  return technicians.filter((technician) => technician.usesTimeClock).map((technician) => {
    const employeePunches = punches
      .filter((p) => p.userId === technician.id)
      .sort((a, b) => (b.at || 0) - (a.at || 0));
    const lastPunch = employeePunches[0];
    const lastLocatedPunch = employeePunches.find(hasCoordinates);
    const journeyOpen = hasOpenJourney(employeePunches, now);
    // PRECEDÊNCIA: jornada fechada (última batida efetiva = SAÍDA, ou sem batida
    // hoje) SEMPRE prevalece. Uma OS aberta/em execução NÃO mantém alguém "em
    // atendimento" depois da SAÍDA — por isso o atendimento só vale com jornada
    // aberta. Sem atendimento ativo, jornada aberta é apenas EM JORNADA.
    const activeOs = journeyOpen ? attendanceByTechnician.get(technician.id) : undefined;
    const client = activeOs?.clienteId ? clientById.get(activeOs.clienteId) : undefined;
    const status: FieldOperationalStatus = activeOs
      ? 'EM ATENDIMENTO'
      : journeyOpen ? 'EM JORNADA' : 'FORA DE JORNADA';
    // Cliente/endereço só do atendimento ATIVO; nunca de OS aberta atribuída.
    const osAddress = activeOs && client?.address?.trim();
    const punchLocation = lastLocatedPunch?.locationAddress?.trim();
    const locationSource: FieldOperatorState['locationSource'] = osAddress ? 'os' : lastLocatedPunch ? 'punch' : 'none';

    return {
      userId: technician.id,
      name: technician.name || 'Funcionário',
      status,
      activeOs,
      clientName: activeOs && client ? client.name : undefined,
      location: osAddress || punchLocation || (lastLocatedPunch ? 'Endereço sendo identificado' : 'Localização não informada'),
      locationSource,
      lastPunch,
      updatedAt: lastPunch?.at,
    };
  }).sort((a, b) => {
    const priority: Record<FieldOperationalStatus, number> = { 'EM ATENDIMENTO': 0, 'EM JORNADA': 1, 'FORA DE JORNADA': 2 };
    return priority[a.status] - priority[b.status] || a.name.localeCompare(b.name, 'pt-BR');
  });
}
