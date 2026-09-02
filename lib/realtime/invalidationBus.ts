import { RealtimeDomain } from './domains';

export type RefreshReason = 'realtime' | 'focus' | 'visibility' | 'poll' | 'reconnect' | 'online';
export type DomainRefresh = (reason: RefreshReason) => void | Promise<void>;

export class DomainInvalidationBus {
  private listeners = new Map<RealtimeDomain, Set<DomainRefresh>>();
  private timers = new Map<RealtimeDomain, ReturnType<typeof setTimeout>>();

  constructor(private readonly debounceMs = 500) {}

  subscribe(domain: RealtimeDomain, listener: DomainRefresh) {
    const set = this.listeners.get(domain) ?? new Set<DomainRefresh>();
    set.add(listener);
    this.listeners.set(domain, set);
    return () => {
      set.delete(listener);
      if (!set.size) this.listeners.delete(domain);
    };
  }

  invalidate(domains: readonly RealtimeDomain[], reason: RefreshReason = 'realtime') {
    for (const domain of new Set(domains)) {
      const current = this.timers.get(domain);
      if (current) clearTimeout(current);
      this.timers.set(domain, setTimeout(() => {
        this.timers.delete(domain);
        void this.emit(domain, reason);
      }, this.debounceMs));
    }
  }

  async refreshActive(reason: RefreshReason) {
    await Promise.all([...this.listeners.keys()].map((domain) => this.emit(domain, reason)));
  }

  activeDomains() { return [...this.listeners.keys()]; }

  dispose() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.listeners.clear();
  }

  private async emit(domain: RealtimeDomain, reason: RefreshReason) {
    const listeners = [...(this.listeners.get(domain) ?? [])];
    await Promise.all(listeners.map((listener) => Promise.resolve(listener(reason))));
  }
}
