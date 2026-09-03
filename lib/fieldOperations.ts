import { Client, OrdemServico, TimePunch } from './types';
import type { TimeClockParticipant } from './users';

export type FieldOperationalStatus =
  | 'EM ATENDIMENTO' | 'EM OPERAÇÃO' | 'EM JORNADA' | 'FORA DE JORNADA';

/**
 * Atendimento operacional ATIVO = técnico com um ATENDIMENTO em execução
 * (service_attendances.status = 'EM_EXECUCAO'). Na ausência de um atendimento
 * explícito, mantemos o sinal legado da OS: uma OS 'em_execucao' atribuída ao
 * técnico. Uma OS apenas 'aberta'/'agendada' é backlog/atribuição, NUNCA um
 * atendimento em curso (§11); 'concluida'/'cancelada' são terminais.
 */
const isLegacyActiveAttendance = (os: OrdemServico) => os.status === 'em_execucao';

/** Vínculo técnico↔operação de campo ATIVA (resolvido pela camada de dados). */
export interface OperatorOperationLink {
  technicianId: string;
  operationId: string;
  operationName: string;
  operationType?: string;
  clientId?: string;
}

/** Vínculo técnico↔atendimento EM EXECUÇÃO (resolvido pela camada de dados). */
export interface OperatorAttendanceLink {
  technicianId: string;
  attendanceId: string;
  workOrderId?: string;
  clientId?: string;
  osNumero?: string;
  startedAt?: number;
}

export interface FieldOperatorState {
  userId: string;
  name: string;
  status: FieldOperationalStatus;
  activeOs?: OrdemServico;
  /** Operação de campo recorrente ativa para o técnico (quando EM OPERAÇÃO). */
  activeOperation?: { id: string; name: string; type?: string; clientName?: string };
  /** Atendimento real em execução (quando EM ATENDIMENTO por service_attendances). */
  activeAttendance?: { id: string; workOrderId?: string; osNumero?: string; startedAt?: number; clientName?: string };
  clientName?: string;
  location: string;
  locationSource: 'os' | 'operation' | 'punch' | 'none';
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

export interface DeriveFieldContext {
  /** Operações de campo ATIVAS por técnico (assignment ativo + operação ATIVA). */
  operations?: OperatorOperationLink[];
  /** Atendimentos EM EXECUÇÃO por técnico (service_attendances). */
  attendances?: OperatorAttendanceLink[];
}

/**
 * Deriva o estado operacional de cada técnico a partir de dados REAIS.
 *
 * PRECEDÊNCIA (§11): ATENDIMENTO em execução > OPERAÇÃO de campo ativa > JORNADA.
 * Nada disso vale sem JORNADA aberta: um técnico fora de jornada é FORA DE
 * JORNADA mesmo com operação/OS ativa (a SAÍDA sempre prevalece).
 *
 * O 6º argumento é opcional e retrocompatível: sem `context`, o comportamento
 * legado (EM ATENDIMENTO por OS 'em_execucao') é preservado.
 */
export function deriveFieldOperatorStates(
  technicians: TimeClockParticipant[],
  punches: TimePunch[],
  orders: OrdemServico[],
  clients: Client[],
  now = Date.now(),
  context: DeriveFieldContext = {}
): FieldOperatorState[] {
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const orderById = new Map(orders.map((o) => [o.id, o]));

  // Sinal LEGADO: OS 'em_execucao' atribuída (fallback quando não há atendimento
  // explícito). A mais antiga prevista primeiro.
  const legacyAttendanceByTechnician = new Map<string, OrdemServico>();
  for (const order of orders) {
    if (!order.tecnicoResponsavelId || !isLegacyActiveAttendance(order)) continue;
    const current = legacyAttendanceByTechnician.get(order.tecnicoResponsavelId);
    if (!current || (order.dataPrevista || '') < (current.dataPrevista || '')) {
      legacyAttendanceByTechnician.set(order.tecnicoResponsavelId, order);
    }
  }

  // Atendimento REAL em execução (prioritário). Mais antigo primeiro.
  const attendanceByTechnician = new Map<string, OperatorAttendanceLink>();
  for (const link of context.attendances || []) {
    const current = attendanceByTechnician.get(link.technicianId);
    if (!current || (link.startedAt || 0) < (current.startedAt || 0)) {
      attendanceByTechnician.set(link.technicianId, link);
    }
  }

  // Operação de campo ATIVA por técnico. Primeira encontrada.
  const operationByTechnician = new Map<string, OperatorOperationLink>();
  for (const link of context.operations || []) {
    if (!operationByTechnician.has(link.technicianId)) {
      operationByTechnician.set(link.technicianId, link);
    }
  }

  return technicians.filter((technician) => technician.usesTimeClock).map((technician): FieldOperatorState => {
    const employeePunches = punches
      .filter((p) => p.userId === technician.id)
      .sort((a, b) => (b.at || 0) - (a.at || 0));
    const lastPunch = employeePunches[0];
    const lastLocatedPunch = employeePunches.find(hasCoordinates);
    const journeyOpen = hasOpenJourney(employeePunches, now);

    // Sem jornada aberta, nada de campo se aplica (a SAÍDA prevalece).
    const realAttendance = journeyOpen ? attendanceByTechnician.get(technician.id) : undefined;
    const legacyOs = journeyOpen && !realAttendance ? legacyAttendanceByTechnician.get(technician.id) : undefined;
    const operation = journeyOpen && !realAttendance && !legacyOs
      ? operationByTechnician.get(technician.id)
      : undefined;

    // ---- EM ATENDIMENTO (atendimento real tem prioridade sobre o legado) ----
    if (realAttendance) {
      const os = realAttendance.workOrderId ? orderById.get(realAttendance.workOrderId) : undefined;
      const client = realAttendance.clientId
        ? clientById.get(realAttendance.clientId)
        : os?.clienteId ? clientById.get(os.clienteId) : undefined;
      const address = client?.address?.trim();
      const punchLocation = lastLocatedPunch?.locationAddress?.trim();
      return {
        userId: technician.id,
        name: technician.name || 'Funcionário',
        status: 'EM ATENDIMENTO' as const,
        activeOs: os,
        activeAttendance: {
          id: realAttendance.attendanceId,
          workOrderId: realAttendance.workOrderId,
          osNumero: realAttendance.osNumero || os?.numero,
          startedAt: realAttendance.startedAt,
          clientName: client?.name,
        },
        clientName: client?.name,
        location: address || punchLocation || (lastLocatedPunch ? 'Endereço sendo identificado' : 'Localização não informada'),
        locationSource: address ? 'os' : lastLocatedPunch ? 'punch' : 'none',
        lastPunch,
        updatedAt: lastPunch?.at,
      };
    }

    // ---- EM ATENDIMENTO (legado: OS 'em_execucao' atribuída) ----
    if (legacyOs) {
      const client = legacyOs.clienteId ? clientById.get(legacyOs.clienteId) : undefined;
      const osAddress = client?.address?.trim();
      const punchLocation = lastLocatedPunch?.locationAddress?.trim();
      return {
        userId: technician.id,
        name: technician.name || 'Funcionário',
        status: 'EM ATENDIMENTO' as const,
        activeOs: legacyOs,
        clientName: client ? client.name : undefined,
        location: osAddress || punchLocation || (lastLocatedPunch ? 'Endereço sendo identificado' : 'Localização não informada'),
        locationSource: osAddress ? 'os' : lastLocatedPunch ? 'punch' : 'none',
        lastPunch,
        updatedAt: lastPunch?.at,
      };
    }

    // ---- EM OPERAÇÃO (operação de campo recorrente ativa) ----
    if (operation) {
      const client = operation.clientId ? clientById.get(operation.clientId) : undefined;
      const opAddress = client?.address?.trim();
      const punchLocation = lastLocatedPunch?.locationAddress?.trim();
      return {
        userId: technician.id,
        name: technician.name || 'Funcionário',
        status: 'EM OPERAÇÃO' as const,
        activeOperation: {
          id: operation.operationId,
          name: operation.operationName,
          type: operation.operationType,
          clientName: client?.name,
        },
        clientName: client?.name,
        location: opAddress || punchLocation || (lastLocatedPunch ? 'Endereço sendo identificado' : 'Localização não informada'),
        locationSource: opAddress ? 'operation' : lastLocatedPunch ? 'punch' : 'none',
        lastPunch,
        updatedAt: lastPunch?.at,
      };
    }

    // ---- EM JORNADA / FORA DE JORNADA ----
    const punchLocation = lastLocatedPunch?.locationAddress?.trim();
    return {
      userId: technician.id,
      name: technician.name || 'Funcionário',
      status: (journeyOpen ? 'EM JORNADA' : 'FORA DE JORNADA') as FieldOperationalStatus,
      activeOs: undefined,
      clientName: undefined,
      location: punchLocation || (lastLocatedPunch ? 'Endereço sendo identificado' : 'Localização não informada'),
      locationSource: lastLocatedPunch ? 'punch' : 'none',
      lastPunch,
      updatedAt: lastPunch?.at,
    };
  }).sort((a, b) => {
    const priority: Record<FieldOperationalStatus, number> = {
      'EM ATENDIMENTO': 0, 'EM OPERAÇÃO': 1, 'EM JORNADA': 2, 'FORA DE JORNADA': 3,
    };
    return priority[a.status] - priority[b.status] || a.name.localeCompare(b.name, 'pt-BR');
  });
}
