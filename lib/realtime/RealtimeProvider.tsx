'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { isSupabaseConfigured } from '@/lib/inventory';
import { domainsForTable, REALTIME_TABLES, RealtimeDomain } from './domains';
import { DomainInvalidationBus, DomainRefresh } from './invalidationBus';
import { attachRefreshTriggers } from './refreshTriggers';

export type RealtimeConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'retrying';
type ContextValue = {
  status: RealtimeConnectionStatus;
  lastUpdatedAt: Partial<Record<RealtimeDomain, number>>;
  subscribe: (domain: RealtimeDomain, listener: DomainRefresh) => () => void;
};

const RealtimeContext = createContext<ContextValue | null>(null);
export const REALTIME_POLL_INTERVAL_MS = 90_000;

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const busRef = useRef(new DomainInvalidationBus(500));
  const [status, setStatus] = useState<RealtimeConnectionStatus>('connecting');
  const hasConnected = useRef(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Partial<Record<RealtimeDomain, number>>>({});

  const subscribe = useCallback((domain: RealtimeDomain, listener: DomainRefresh) =>
    busRef.current.subscribe(domain, async (reason) => {
      await listener(reason);
      setLastUpdatedAt((current) => ({ ...current, [domain]: Date.now() }));
    }), []);

  useEffect(() => {
    if (!isSupabaseConfigured()) { setStatus('disconnected'); return; }
    const supabase = getSupabaseClient();
    let channel = supabase.channel('fireowl:operations');
    for (const table of REALTIME_TABLES) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        busRef.current.invalidate(domainsForTable(table), 'realtime');
      });
    }
    channel.subscribe((next) => {
      if (next === 'SUBSCRIBED') {
        const isReconnect = hasConnected.current;
        hasConnected.current = true;
        setStatus('connected');
        if (isReconnect) void busRef.current.refreshActive('reconnect');
      } else if (next === 'CHANNEL_ERROR' || next === 'TIMED_OUT') setStatus('retrying');
      else if (next === 'CLOSED') setStatus('disconnected');
    });
    return () => { void supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const onOffline = () => setStatus('disconnected');
    const bus = busRef.current;
    window.addEventListener('offline', onOffline);
    const detach = attachRefreshTriggers(window, document, bus, REALTIME_POLL_INTERVAL_MS);
    return () => {
      window.removeEventListener('offline', onOffline);
      detach();
      bus.dispose();
    };
  }, []);

  const value = useMemo(() => ({ status, lastUpdatedAt, subscribe }), [status, lastUpdatedAt, subscribe]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useDomainRefresh(domain: RealtimeDomain, refresh: DomainRefresh, enabled = true) {
  const context = useContext(RealtimeContext);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (!context || !enabled) return;
    return context.subscribe(domain, (reason) => refreshRef.current(reason));
  }, [context, domain, enabled]);
  return { status: context?.status ?? 'disconnected', lastUpdatedAt: context?.lastUpdatedAt[domain] };
}

export function useFireowlRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) throw new Error('useFireowlRealtime must be used inside RealtimeProvider');
  return context;
}
