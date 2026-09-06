'use client';
import React from 'react';
import { PAGE_SIZE_OPTIONS, pageWindow } from '@/lib/pagination';

/* ===================================================================
 * Controles de paginação REUTILIZÁVEIS para listas administrativas.
 * Uma implementação só (Clientes, Pedidos, …) — evita divergência.
 * Recebe estado calculado (from/to/total/page/totalPages/pageSize) e
 * dispara callbacks. Não conhece o domínio da lista.
 * =================================================================== */

interface Props {
  page: number;
  totalPages: number;
  pageSize: number;
  from: number;
  to: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Rótulo plural dos itens, ex.: "clientes", "pedidos". Default: "itens". */
  itemLabel?: string;
  /** Opções de tamanho de página (default 15/30/50/100). */
  pageSizeOptions?: readonly number[];
  className?: string;
}

export const PaginatedListControls: React.FC<Props> = ({
  page, totalPages, pageSize, from, to, total,
  onPageChange, onPageSizeChange, itemLabel = 'itens',
  pageSizeOptions = PAGE_SIZE_OPTIONS, className = '',
}) => {
  const pages = pageWindow(page, totalPages);
  const btn = 'min-w-8 px-2.5 py-1 text-xs font-semibold border border-border rounded-lg bg-surface hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';
  return (
    <div className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-1 pt-2 border-t border-border ${className}`}>
      <div className="flex items-center gap-2 text-xs text-fg-secondary">
        <span>Exibir</span>
        <select
          aria-label="Itens por página"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="px-2 py-1 border border-border rounded-lg bg-surface text-xs font-semibold text-fg"
        >
          {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span className="whitespace-nowrap">
          · Exibindo {from}–{to} de {total} {itemLabel}
        </span>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-1 flex-wrap">
          <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1} className={btn}>‹ Anterior</button>
          {/* Páginas numeradas (com reticências) — ocultas em telas muito estreitas. */}
          <div className="hidden sm:flex items-center gap-1">
            {pages.map((p, i) => p === 'ellipsis'
              ? <span key={`e${i}`} className="px-1 text-xs text-fg-muted">…</span>
              : (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  aria-current={p === page ? 'page' : undefined}
                  className={`${btn} tabular-nums ${p === page ? 'bg-navy text-white border-primary hover:bg-navy' : ''}`}
                >
                  {p}
                </button>
              ))}
          </div>
          {/* Fallback compacto (mobile): "página / total". */}
          <span className="sm:hidden px-2 text-xs font-semibold text-fg-secondary tabular-nums">{page} / {totalPages}</span>
          <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className={btn}>Próxima ›</button>
        </div>
      )}
    </div>
  );
};
