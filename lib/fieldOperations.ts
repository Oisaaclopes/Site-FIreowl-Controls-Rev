import { Client, OrdemServico, TimePunch } from './types';
import type { ManagedUser } from './users';
import { OS_STATUS_ATIVOS } from './ordensServico';

export type FieldOperationalStatus = 'EM ATENDIMENTO' | 'EM JORNADA' | 'FORA DE JORNADA';

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
  technicians: ManagedUser[],
  punches: TimePunch[],
  orders: OrdemServico[],
  clients: Client[],
  now = Date.now()
): FieldOperatorState[] {
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const activeOrderByTechnician = new Map<string, OrdemServico>();
  for (const order of orders) {
    if (!order.tecnicoResponsavelId || !OS_STATUS_ATIVOS.includes(order.status)) continue;
    const current = activeOrderByTechnician.get(order.tecnicoResponsavelId);
    if (!current || (order.dataPrevista || '') < (current.dataPrevista || '')) {
      activeOrderByTechnician.set(order.tecnicoResponsavelId, order);
    }
  }

  return technicians.map((technician) => {
    const employeePunches = punches
      .filter((p) => p.userId === technician.id)
      .sort((a, b) => (b.at || 0) - (a.at || 0));
    const lastPunch = employeePunches[0];
    const lastLocatedPunch = employeePunches.find(hasCoordinates);
    const activeOs = activeOrderByTechnician.get(technician.id);
    const client = activeOs?.clienteId ? clientById.get(activeOs.clienteId) : undefined;
    const status: FieldOperationalStatus = activeOs
      ? 'EM ATENDIMENTO'
      : hasOpenJourney(employeePunches, now) ? 'EM JORNADA' : 'FORA DE JORNADA';
    const osAddress = activeOs && client?.address?.trim();
    const punchLocation = lastLocatedPunch?.locationStr?.trim();

    const locationSource: FieldOperatorState['locationSource'] = osAddress ? 'os' : punchLocation ? 'punch' : 'none';
    return {
      userId: technician.id,
      name: technician.name || technician.fullName || 'Funcionário',
      status,
      activeOs,
      clientName: activeOs && client ? client.name : undefined,
      location: osAddress || punchLocation || 'Localização não informada',
      locationSource,
      lastPunch,
      updatedAt: lastPunch?.at,
    };
  }).sort((a, b) => {
    const priority: Record<FieldOperationalStatus, number> = { 'EM ATENDIMENTO': 0, 'EM JORNADA': 1, 'FORA DE JORNADA': 2 };
    return priority[a.status] - priority[b.status] || a.name.localeCompare(b.name, 'pt-BR');
  });
}
