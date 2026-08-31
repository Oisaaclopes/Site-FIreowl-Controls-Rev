'use client';

import { useEffect, useState } from 'react';

/** Breakpoint mobile alinhado ao `lg` do Tailwind (desktop ≥ 1024px). */
export const MOBILE_MAX_WIDTH = 1023;

/**
 * Verdadeiro quando a viewport é mobile/tablet estreito (< 1024px). SSR-safe:
 * inicia `false` e sincroniza no cliente, evitando divergência de hidratação.
 */
const query = `(max-width: ${MOBILE_MAX_WIDTH}px)`;

export function useIsMobile(): boolean {
  // Inicialização síncrona no cliente evita o flash do desktop antes do efeito.
  // (SSR retorna false; os componentes que usam o hook só montam no cliente.)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isMobile;
}
