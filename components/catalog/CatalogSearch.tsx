'use client';
import React from 'react';

/**
 * Busca global do catálogo. Sempre acessível (topo). Não navega pela árvore —
 * consulta modelo/descrição/fabricante/família/tipo/aliases (via searchCatalog).
 */
export function CatalogSearch({ value, onChange, placeholder = 'Buscar por modelo, fabricante, tipo, sinônimo…' }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative flex items-center w-full">
      <span className="material-symbols-outlined absolute left-3 text-fg-muted text-[20px] pointer-events-none">search</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Buscar no catálogo"
        className="w-full bg-surface border border-border rounded-lg py-2.5 pl-10 pr-9 text-sm text-[#131c28] placeholder:text-fg-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpar busca"
          className="absolute right-1.5 h-8 w-8 flex items-center justify-center rounded-md text-fg-muted hover:text-danger hover:bg-surface-2"
        >
          <span className="material-symbols-outlined text-[19px]">close</span>
        </button>
      )}
    </div>
  );
}
