'use client';
import { useEffect, useState } from 'react';
import { NAV_SESSION_KEY } from './navigationContext';

export function scrollCanRestore(height: number, viewport: number, y: number) {
  return Number.isFinite(y) && y >= 0 && height - viewport >= y;
}

/** Wait for the correct pane and enough content; never overwrite a pending position with zero. */
export function useNavigationScroll(key: string, ready = true) {
  const [element, ref] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!element || !ready) return;
    let target = 0;
    try { target = JSON.parse(sessionStorage.getItem(NAV_SESSION_KEY) || '{}').scroll?.[key] || 0; } catch { /* unavailable */ }
    let restored = target === 0;
    let frame = 0;
    const restore = () => {
      if (restored || !scrollCanRestore(element.scrollHeight, element.clientHeight, target)) return;
      element.scrollTop = target;
      restored = true;
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(restore); };
    const save = () => {
      if (!restored) return;
      try {
        const session = JSON.parse(sessionStorage.getItem(NAV_SESSION_KEY) || '{}');
        session.scroll = { ...session.scroll, [key]: element.scrollTop };
        // Bounded metadata; never store content.
        session.scroll = Object.fromEntries(Object.entries(session.scroll).slice(-60));
        sessionStorage.setItem(NAV_SESSION_KEY, JSON.stringify(session));
      } catch { /* unavailable */ }
    };
    const cancel = () => { restored = true; };
    const observer = new MutationObserver(schedule);
    observer.observe(element, { childList: true, subtree: true });
    const resize = new ResizeObserver(schedule);
    resize.observe(element);
    schedule();
    element.addEventListener('scroll', save, { passive: true });
    element.addEventListener('wheel', cancel, { passive: true });
    element.addEventListener('touchstart', cancel, { passive: true });
    return () => {
      save(); cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect();
      element.removeEventListener('scroll', save); element.removeEventListener('wheel', cancel); element.removeEventListener('touchstart', cancel);
    };
  }, [element, key, ready]);
  return ref;
}
