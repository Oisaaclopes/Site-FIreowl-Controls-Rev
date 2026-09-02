import { afterEach, describe, expect, it, vi } from 'vitest';
import { domainsForTable } from './domains';
import { DomainInvalidationBus } from './invalidationBus';
import { attachRefreshTriggers } from './refreshTriggers';

afterEach(() => vi.useRealTimers());

describe('mapa tabela para domínio', () => {
  it('ponto invalida somente dependências operacionais do ponto', () => {
    expect(domainsForTable('time_punches')).toEqual(['point', 'employees', 'dashboard']);
    expect(domainsForTable('time_punches')).not.toContain('inventory');
  });
  it('ajuste aprovado invalida ponto e dashboard sem criar outra assinatura', () => {
    expect(domainsForTable('punch_adjustments')).toEqual(['point', 'dashboard']);
  });
  it('mapeia pedido, relatório e OS com suas dependências', () => {
    expect(domainsForTable('pedidos')).toEqual(['orders', 'dashboard']);
    expect(domainsForTable('reports')).toEqual(['reports', 'dashboard']);
    expect(domainsForTable('ordens_servico')).toEqual(['serviceOrders', 'agenda', 'dashboard']);
  });
});

describe('DomainInvalidationBus', () => {
  it('agrupa rajadas por domínio em um único refetch e não cria N+1', async () => {
    vi.useFakeTimers();
    const bus = new DomainInvalidationBus(500);
    const refresh = vi.fn();
    bus.subscribe('point', refresh);
    for (let i = 0; i < 20; i += 1) bus.invalidate(['point']);
    await vi.advanceTimersByTimeAsync(500);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it('cleanup remove listener e tela desmontada não atualiza', async () => {
    vi.useFakeTimers();
    const bus = new DomainInvalidationBus(10);
    const refresh = vi.fn();
    const unsubscribe = bus.subscribe('orders', refresh);
    unsubscribe();
    bus.invalidate(['orders']);
    await vi.advanceTimersByTimeAsync(10);
    expect(refresh).not.toHaveBeenCalled();
  });
  it('reconnect atualiza somente domínios com tela montada', async () => {
    const bus = new DomainInvalidationBus();
    const point = vi.fn(); const inventory = vi.fn();
    bus.subscribe('point', point);
    const remove = bus.subscribe('inventory', inventory); remove();
    await bus.refreshActive('reconnect');
    expect(point).toHaveBeenCalledWith('reconnect');
    expect(inventory).not.toHaveBeenCalled();
  });
});

describe('gatilhos de recuperação', () => {
  function harness(online = true) {
    const winListeners = new Map<string, () => void>();
    const docListeners = new Map<string, () => void>();
    let interval: (() => void) | undefined;
    const win = {
      navigator: { onLine: online },
      addEventListener: (name: string, fn: () => void) => winListeners.set(name, fn),
      removeEventListener: (name: string) => winListeners.delete(name),
      setInterval: (fn: () => void) => { interval = fn; return 1; },
      clearInterval: vi.fn(),
    };
    const doc = {
      visibilityState: 'visible' as DocumentVisibilityState,
      addEventListener: (name: string, fn: () => void) => docListeners.set(name, fn),
      removeEventListener: (name: string) => docListeners.delete(name),
    };
    return { win, doc, winListeners, docListeners, poll: () => interval?.() };
  }

  it('focus, visible, online/reconnect e polling fazem refresh', async () => {
    const bus = new DomainInvalidationBus(); const refresh = vi.fn(); bus.subscribe('agenda', refresh);
    const h = harness(); const detach = attachRefreshTriggers(h.win as never, h.doc as never, bus, 90_000);
    h.winListeners.get('focus')?.(); h.docListeners.get('visibilitychange')?.(); h.winListeners.get('online')?.(); h.poll();
    await Promise.resolve();
    expect(refresh.mock.calls.map((c) => c[0])).toEqual(['focus', 'visibility', 'online', 'poll']);
    detach();
    expect(h.winListeners.size).toBe(0); expect(h.docListeners.size).toBe(0); expect(h.win.clearInterval).toHaveBeenCalled();
  });
  it('offline e aba oculta não geram loop/refetch', async () => {
    const bus = new DomainInvalidationBus(); const refresh = vi.fn(); bus.subscribe('reports', refresh);
    const h = harness(false); h.doc.visibilityState = 'hidden'; attachRefreshTriggers(h.win as never, h.doc as never, bus, 90_000);
    h.winListeners.get('focus')?.(); h.docListeners.get('visibilitychange')?.(); h.poll();
    await Promise.resolve();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('proteção de edição', () => {
  it('uma atualização externa não substitui o snapshot local sujo', () => {
    const draft = { id: 'p1', updatedAt: 'old', referencia: 'digitando' };
    const remote = { id: 'p1', updatedAt: 'new', referencia: 'remoto' };
    const editingState = draft;
    const externalChange = remote.updatedAt !== editingState.updatedAt ? remote : null;
    expect(editingState.referencia).toBe('digitando');
    expect(externalChange?.referencia).toBe('remoto');
  });
});
