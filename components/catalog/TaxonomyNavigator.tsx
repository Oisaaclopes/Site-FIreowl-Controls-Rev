'use client';
import React from 'react';
import type { TaxonomyNode } from '@/lib/catalogTree';

/**
 * Navegação progressiva por nós da taxonomia. Mostra os filhos do nó atual
 * como cards tocáveis com contagem real (descendentes). Reutilizável em
 * Catálogo, e futuramente em Pedido / Levantamento / Dispositivos.
 */
export function TaxonomyNavigator({ nodes, counts, onSelect }: {
  nodes: TaxonomyNode[];
  counts: Map<string, number>;
  onSelect: (node: TaxonomyNode) => void;
}) {
  if (nodes.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      {nodes.map((node) => {
        const count = counts.get(node.id) ?? 0;
        return (
          <button
            key={node.id}
            type="button"
            onClick={() => onSelect(node)}
            className="group flex items-center justify-between gap-3 bg-surface border border-border rounded-xl px-4 py-3.5 text-left hover:border-primary hover:shadow-sm transition-all active:scale-[0.99] min-h-[60px]"
          >
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#131c28] truncate">{node.name}</p>
              <p className="text-[11px] font-semibold text-fg-muted mt-0.5">
                {count} {count === 1 ? 'produto' : 'produtos'}
              </p>
            </div>
            <span className="material-symbols-outlined text-fg-muted group-hover:text-danger transition-colors shrink-0">chevron_right</span>
          </button>
        );
      })}
    </div>
  );
}
