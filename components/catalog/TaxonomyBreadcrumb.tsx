'use client';
import React from 'react';

export interface CrumbItem {
  key: string;
  label: string;
  onClick?: () => void;
}

/**
 * Trilha de navegação: Catálogo › SDAI › Detectores › Fumaça › Endereçável.
 * Cada parte é clicável (menos a última). Rola na horizontal no mobile,
 * nunca escondendo o contexto.
 */
export function TaxonomyBreadcrumb({ items }: { items: CrumbItem[] }) {
  return (
    <nav aria-label="Trilha do catálogo" className="flex items-center gap-1 overflow-x-auto whitespace-nowrap py-1 -mx-1 px-1 scrollbar-none">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={item.key} className="flex items-center gap-1 shrink-0">
            {i > 0 && <span className="material-symbols-outlined text-[15px] text-fg-muted select-none">chevron_right</span>}
            {last || !item.onClick ? (
              <span className={`text-xs font-semibold ${last ? 'text-primary' : 'text-fg-secondary'}`} aria-current={last ? 'page' : undefined}>
                {item.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={item.onClick}
                className="text-xs font-semibold text-fg-secondary hover:text-danger transition-colors"
              >
                {item.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
