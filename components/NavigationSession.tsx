'use client';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { belongsToUser, NAV_KEYS, NAV_SESSION_KEY, navigationUrl, NavigationKey, NavigationState, parseNavigation, resolveNavigationEntity } from '@/lib/navigationContext';
import { showToast } from '@/components/ui/Feedback';

type Patch = Partial<Record<NavigationKey, string | null>>;
const Context = createContext<{ state: NavigationState; userId?: string; update: (patch: Patch, push?: boolean) => void }>({ state: {}, update: () => {} });

export function clearNavigationSession() {
  try { sessionStorage.removeItem(NAV_SESSION_KEY); } catch { /* unavailable */ }
  const patch = Object.fromEntries(NAV_KEYS.map((key) => [key, null]));
  window.history.replaceState({ ...window.history.state, navigationSession: null }, '', navigationUrl(window.location.href, patch));
}

export function NavigationSession({ userId, children }: { userId?: string; children: React.ReactNode }) {
  const [state, setState] = useState<NavigationState>({});
  const [ready, setReady] = useState(false);
  const token = useRef<string | undefined>(undefined);
  useEffect(() => {
    let previous: string | null = null;
    try { previous = sessionStorage.getItem(NAV_SESSION_KEY); } catch { /* unavailable */ }
    // URLs left on a shared device are not inherited by the next login.
    if (!userId || !belongsToUser(previous, userId)) clearNavigationSession();
    const saved = belongsToUser(previous, userId || '') ? JSON.parse(previous!) : { userId };
    token.current = saved.token || crypto.randomUUID();
    saved.token = token.current;
    if (/^\/funcionarios\/?$/.test(window.location.pathname) && typeof saved.lastUrl === 'string' && /^\/funcionarios\/[a-z_-]+\//.test(saved.lastUrl)) {
      window.history.replaceState(window.history.state, '', saved.lastUrl);
    }
    window.history.replaceState({ ...window.history.state, navigationSession: token.current }, '', window.location.href);
    try { sessionStorage.setItem(NAV_SESSION_KEY, JSON.stringify(saved)); } catch { /* unavailable */ }
    setState(parseNavigation(window.location.search));
    setReady(true);
    const onPop = () => {
      if (window.history.state?.navigationSession !== token.current) {
        const patch = Object.fromEntries(NAV_KEYS.map((key) => [key, null]));
        window.history.replaceState({ ...window.history.state, navigationSession: token.current }, '', navigationUrl(window.location.href, patch));
      }
      setState(parseNavigation(window.location.search));
      try {
        const current = JSON.parse(sessionStorage.getItem(NAV_SESSION_KEY) || '{}');
        if (current.token === token.current) sessionStorage.setItem(NAV_SESSION_KEY, JSON.stringify({ ...current, lastUrl: window.location.pathname + window.location.search }));
      } catch { /* unavailable */ }
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('fireowl-navigation', onPop);
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('fireowl-navigation', onPop); };
  }, [userId]);
  const update = useCallback((patch: Patch, push = false) => {
    const url = navigationUrl(window.location.href, patch);
    if (url.href !== window.location.href) window.history[push ? 'pushState' : 'replaceState']({ ...window.history.state, navigationSession: token.current }, '', url);
    try {
      const saved = JSON.parse(sessionStorage.getItem(NAV_SESSION_KEY) || '{}');
      if (saved.token === token.current) sessionStorage.setItem(NAV_SESSION_KEY, JSON.stringify({ ...saved, lastUrl: url.pathname + url.search }));
    } catch { /* unavailable */ }
    setState(parseNavigation(url.search));
  }, []);
  return <Context.Provider value={{ state, userId, update }}>{ready ? children : <p role="status">Restaurando navegação…</p>}</Context.Provider>;
}

export const useNavigation = () => useContext(Context);

export function useNavigationValue<T extends string>(key: NavigationKey, fallback: T, allowed: readonly T[], push = false): [T, (value: T) => void] {
  const { state, update } = useNavigation();
  const value = state[key];
  return [value && allowed.includes(value as T) ? value as T : fallback, (next) => update({ [key]: next }, push)];
}

/** Loads through the existing authenticated read path. Restoration never invokes a mutation. */
export function useNavigationEntity<T extends { id: string }>(key: NavigationKey, loader: (id: string) => Promise<T | null>, children: NavigationKey[] = []): [T | null, (value: T | null) => void] {
  const { state, update } = useNavigation();
  const [entity, setEntity] = useState<T | null>(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const id = state[key];
  useEffect(() => {
    let alive = true;
    if (!id) { setEntity(null); return; }
    if (entity?.id === id) return;
    setEntity(null);
    resolveNavigationEntity(() => loaderRef.current(id)).then((value) => {
      if (!alive) return;
      setEntity(value);
      if (!value) {
        update(Object.fromEntries([key, ...children].map((k) => [k, null])));
        showToast('Contexto indisponível ou sem acesso. Retornamos à tela anterior.');
      }
    });
    return () => { alive = false; };
    // Entity is deliberately not a trigger: local edits must not cause reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, update]);
  return [entity?.id === id ? entity : null, (value) => {
    setEntity(value);
    update({ ...Object.fromEntries(children.map((k) => [k, null])), [key]: value?.id || null }, !!value);
  }];
}
