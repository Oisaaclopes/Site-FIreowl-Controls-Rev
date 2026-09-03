'use client';

import React from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  /** Ilustração: 'relatorio' | 'clientes' | 'estoque' | 'generico' */
  variant?: 'relatorio' | 'clientes' | 'estoque' | 'generico';
  actionLabel?: string;
  onAction?: () => void;
}

/* Ilustrações SVG leves (sem dependência externa), em tons da marca. */
const Ilustracao: React.FC<{ variant: NonNullable<EmptyStateProps['variant']> }> = ({ variant }) => {
  // Cores theme-aware (via CSS vars) — a ilustração acompanha claro/escuro e usa
  // o acento azul da marca no lugar do vermelho para um visual mais premium.
  const navy = 'var(--primary)';
  const red = 'var(--primary)';
  const soft = 'var(--surface-3)';
  if (variant === 'clientes') {
    return (
      <svg width="120" height="96" viewBox="0 0 120 96" fill="none" aria-hidden="true">
        <rect x="16" y="30" width="88" height="52" rx="8" fill={soft} />
        <circle cx="44" cy="50" r="11" fill="#fff" stroke={navy} strokeWidth="3" />
        <path d="M30 74c0-9 7-15 14-15s14 6 14 15" stroke={navy} strokeWidth="3" fill="none" strokeLinecap="round" />
        <rect x="66" y="44" width="26" height="4" rx="2" fill={navy} opacity=".6" />
        <rect x="66" y="54" width="20" height="4" rx="2" fill={navy} opacity=".35" />
        <circle cx="92" cy="26" r="9" fill={red} />
        <path d="M92 22v8M88 26h8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (variant === 'estoque') {
    return (
      <svg width="120" height="96" viewBox="0 0 120 96" fill="none" aria-hidden="true">
        <rect x="24" y="40" width="34" height="34" rx="4" fill={soft} stroke={navy} strokeWidth="3" />
        <rect x="62" y="40" width="34" height="34" rx="4" fill="#fff" stroke={navy} strokeWidth="3" />
        <path d="M24 52h34M79 40v34" stroke={navy} strokeWidth="3" opacity=".5" />
        <circle cx="86" cy="28" r="9" fill={red} />
        <path d="M86 24v8M82 28h8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }
  // relatorio / genérico — prancheta
  return (
    <svg width="120" height="96" viewBox="0 0 120 96" fill="none" aria-hidden="true">
      <rect x="34" y="18" width="52" height="64" rx="8" fill={soft} />
      <rect x="46" y="12" width="28" height="12" rx="6" fill={navy} />
      <rect x="44" y="38" width="32" height="4" rx="2" fill={navy} opacity=".55" />
      <rect x="44" y="50" width="24" height="4" rx="2" fill={navy} opacity=".35" />
      <rect x="44" y="62" width="28" height="4" rx="2" fill={navy} opacity=".35" />
      <circle cx="86" cy="66" r="12" fill={red} />
      <path d="M81 66l4 4 6-7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, variant = 'generico', actionLabel, onAction }) => (
  <div className="bg-surface rounded-xl border border-dashed border-border py-10 px-6 flex flex-col items-center text-center">
    <Ilustracao variant={variant} />
    <p className="mt-3 text-sm font-bold text-fg-secondary uppercase tracking-wider">{title}</p>
    {description && <p className="text-[12px] text-fg-muted mt-1 max-w-xs">{description}</p>}
    {actionLabel && onAction && (
      <button
        onClick={onAction}
        className="mt-4 inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold px-4 py-2 rounded-lg uppercase tracking-wide shadow-sm transition-colors"
      >
        <span className="material-symbols-outlined text-base">add</span> {actionLabel}
      </button>
    )}
  </div>
);
