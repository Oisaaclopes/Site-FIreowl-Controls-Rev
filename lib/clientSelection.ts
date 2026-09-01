import type { Client } from './types';
import { nomeFantasiaCliente } from './utils';

export function clientLegalName(name?: string): string {
  return (name || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export function clientDisplayName(client: Pick<Client, 'name'>): string {
  return nomeFantasiaCliente(client.name) || clientLegalName(client.name) || 'Cliente sem nome';
}

const normalize = (value?: string) => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function sortClientsByDisplayName(clients: Client[]): Client[] {
  return [...clients].sort((a, b) => clientDisplayName(a).localeCompare(clientDisplayName(b), 'pt-BR', { sensitivity: 'base' }));
}

export function filterClients(clients: Client[], query?: string): Client[] {
  const q = normalize(query);
  const sorted = sortClientsByDisplayName(clients);
  if (!q) return sorted;
  const digits = (query || '').replace(/\D/g, '');
  return sorted.filter((client) => {
    const text = normalize([clientDisplayName(client), clientLegalName(client.name), client.name].join(' '));
    const cnpj = (client.cnpj || '').replace(/\D/g, '');
    return text.includes(q) || (!!digits && cnpj.includes(digits));
  });
}
