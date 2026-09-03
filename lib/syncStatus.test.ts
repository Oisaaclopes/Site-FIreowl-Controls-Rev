import { describe, it, expect } from 'vitest';
import { deriveSyncBadge } from './syncStatus';

describe('deriveSyncBadge — apresentação por exceção', () => {
  it('estado normal (online, sem pendências, sem sync) → não mostra nada', () => {
    expect(deriveSyncBadge({ online: true, pending: 0 })).toBeNull();
    expect(deriveSyncBadge({ online: true, pending: 0, syncing: false, error: false })).toBeNull();
  });

  it('offline → badge OFFLINE (tem precedência máxima)', () => {
    const b = deriveSyncBadge({ online: false, pending: 5, syncing: true, error: true });
    expect(b?.kind).toBe('OFFLINE');
    expect(b?.label).toBe('Offline');
  });

  it('online com pendências → badge PENDING com contagem e plural correto', () => {
    expect(deriveSyncBadge({ online: true, pending: 1 })?.label).toBe('1 pendente');
    expect(deriveSyncBadge({ online: true, pending: 3 })?.label).toBe('3 pendentes');
    expect(deriveSyncBadge({ online: true, pending: 3 })?.kind).toBe('PENDING');
  });

  it('sincronizando → badge SYNCING (acima de pendências)', () => {
    const b = deriveSyncBadge({ online: true, pending: 2, syncing: true });
    expect(b?.kind).toBe('SYNCING');
  });

  it('erro → badge ERROR (acima de syncing/pending, abaixo de offline)', () => {
    const b = deriveSyncBadge({ online: true, pending: 2, syncing: true, error: true });
    expect(b?.kind).toBe('ERROR');
  });

  it('normaliza pending negativo/fracionário', () => {
    expect(deriveSyncBadge({ online: true, pending: -3 })).toBeNull();
    expect(deriveSyncBadge({ online: true, pending: 2.9 })?.label).toBe('2 pendentes');
  });
});
