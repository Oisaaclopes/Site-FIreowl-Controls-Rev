'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

/**
 * Ampliar/Minimizar um card do editor de pedidos SEM desmontá-lo.
 *
 * O card nunca muda de lugar na árvore do React: o mesmo elemento só troca de
 * classes. Fechado, o invólucro é `display: contents` (não existe no layout);
 * ampliado, vira uma camada `fixed` centralizada na viewport com fundo
 * escurecido. Um espaço reservado com a altura original fica no lugar do card,
 * então a rolagem do editor não pula. Como nada é remontado, todo estado —
 * inclusive o transitório dos componentes filhos — é preservado.
 *
 * Exclusivamente apresentação: não salva, não chama API, não altera dados.
 */

const FOCAVEIS =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export interface MaximizeApi {
  /** Card aberto no popup. */
  max: boolean;
  /** Já foi ampliado alguma vez (para manter o corpo montado depois de minimizar). */
  everMax: boolean;
  /** Botão Ampliar (Maximize2) / Minimizar (Minimize2 + texto). */
  button: React.ReactNode;
  /** id para o título do card (aria-labelledby do popup). */
  titleId: string;
  /** Abre o popup (para botões extras, ex.: "Editar"). */
  ampliar: () => void;
}

/** Classes do card quando ampliado: ~90% da largura, até 90% da altura, limite p/ monitores grandes. */
export const maxCardCls =
  'w-full sm:w-[90vw] max-w-[1400px] max-h-full sm:max-h-[90vh] flex flex-col shadow-2xl';

export const MaximizableCard: React.FC<{
  title: string;
  /** 'dark' para cards de fundo escuro (ex.: Valores). */
  tone?: 'light' | 'dark';
  children: (api: MaximizeApi) => React.ReactNode;
}> = ({ title, tone = 'light', children }) => {
  const [max, setMax] = useState(false);
  const [everMax, setEverMax] = useState(false);
  const [altura, setAltura] = useState<number | null>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const ampliar = () => {
    setAltura(slotRef.current?.offsetHeight ?? null);
    setEverMax(true);
    setMax(true);
  };
  const minimizar = () => {
    setMax(false);
    setAltura(null);
  };

  // Trava a rolagem do editor enquanto o popup está aberto (scrollTop é mantido).
  useEffect(() => {
    if (!max) return;
    const scroller = slotRef.current?.closest<HTMLElement>('[data-editor-scroll]');
    if (!scroller) return;
    const anterior = scroller.style.overflowY;
    scroller.style.overflowY = 'hidden';
    return () => {
      scroller.style.overflowY = anterior;
    };
  }, [max]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      // Componentes internos (ex.: busca de cliente) tratam o próprio Esc.
      if (e.defaultPrevented) return;
      e.preventDefault();
      minimizar();
      return;
    }
    if (e.key !== 'Tab') return;
    // Foco preso no popup.
    const itens = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(FOCAVEIS)).filter((el) => el.offsetParent !== null);
    if (itens.length === 0) return;
    const primeiro = itens[0];
    const ultimo = itens[itens.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  };

  const escuro = tone === 'dark';
  const button = (
    <button
      type="button"
      onClick={max ? minimizar : ampliar}
      aria-label={max ? `Minimizar ${title}` : `Ampliar ${title}`}
      title={max ? 'Minimizar (Esc)' : 'Ampliar'}
      className={
        max
          ? `shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold uppercase transition-colors ${
              escuro
                ? 'border-slate-600 text-slate-200 hover:bg-slate-800'
                : 'border-border-strong text-fg-secondary hover:text-primary hover:bg-surface-3'
            }`
          : `shrink-0 p-1.5 rounded-md transition-colors ${
              escuro ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-fg-muted hover:text-primary hover:bg-surface-3'
            }`
      }
    >
      {max ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-4 h-4" />}
      {max && 'Minimizar'}
    </button>
  );

  return (
    <div ref={slotRef} className={max ? 'relative' : undefined} style={max && altura ? { height: altura } : undefined}>
      <div
        className={max ? 'fixed inset-0 z-[55] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60' : 'contents'}
        onMouseDown={max ? (e) => { if (e.target === e.currentTarget) minimizar(); } : undefined}
        onKeyDown={max ? onKeyDown : undefined}
        role={max ? 'dialog' : undefined}
        aria-modal={max ? true : undefined}
        aria-labelledby={max ? titleId : undefined}
      >
        {children({ max, everMax, button, titleId, ampliar })}
      </div>
      {max && <div aria-hidden className="absolute inset-0 rounded-xl border-2 border-dashed border-border-strong bg-surface-3/40" />}
    </div>
  );
};
