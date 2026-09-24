import type { Client } from './types';
import { nomeFantasiaCliente } from './utils';

export function clientLegalName(name?: string): string {
  return (name || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export function clientDisplayName(client: Pick<Client, 'name'>): string {
  return nomeFantasiaCliente(client.name) || clientLegalName(client.name) || 'Cliente sem nome';
}

const normalize = (value?: string) => (value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** CNPJ gravado pelo cadastro rápido quando o usuário não informa (só exibição; o dado não muda). */
export const CNPJ_PLACEHOLDER = '00.000.000/0000-00';
const cnpjDigits = (cnpj?: string) => {
  const d = (cnpj || '').replace(/\D/g, '');
  return /^0*$/.test(d) ? '' : d;
};
export function clientCnpjLabel(cnpj?: string): string {
  return cnpjDigits(cnpj) ? `CNPJ ${(cnpj || '').trim()}` : 'CNPJ não informado';
}

export type ClientSearchMode = 'todos' | 'fantasia' | 'razao' | 'cnpj';
export const CLIENT_SEARCH_MODES: { id: ClientSearchMode; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'fantasia', label: 'Nome fantasia' },
  { id: 'razao', label: 'Razão social' },
  { id: 'cnpj', label: 'CNPJ' },
];

export function sortClientsByDisplayName(clients: Client[]): Client[] {
  return [...clients].sort((a, b) => clientDisplayName(a).localeCompare(clientDisplayName(b), 'pt-BR', { sensitivity: 'base' }));
}

export function filterClients(clients: Client[], query?: string, mode: ClientSearchMode = 'todos'): Client[] {
  const q = normalize(query);
  const sorted = sortClientsByDisplayName(clients);
  if (!q) return sorted;
  const digits = (query || '').replace(/\D/g, '');
  // Em "Todos", só casa CNPJ quando a busca é numérica (ex.: "L2" não deve casar CNPJ com "2").
  const buscaNumerica = /^[\d\s./-]+$/.test(query || '');
  const casaCnpj = (c: Client) => !!digits && cnpjDigits(c.cnpj).includes(digits);
  return sorted.filter((client) => {
    if (mode === 'fantasia') return normalize(clientDisplayName(client)).includes(q);
    if (mode === 'razao') return normalize(clientLegalName(client.name)).includes(q);
    if (mode === 'cnpj') return casaCnpj(client);
    const text = normalize([clientDisplayName(client), clientLegalName(client.name), client.name].join(' '));
    return text.includes(q) || (buscaNumerica && casaCnpj(client));
  });
}
