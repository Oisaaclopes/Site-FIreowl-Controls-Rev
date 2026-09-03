'use client';

import React from 'react';

/**
 * SidePanel (Drawer) — painel lateral que desliza da direita.
 * - ~45% da largura no desktop (mín. 520px, máx. 2xl); tela cheia no mobile
 * - overlay com blur; clique fora fecha
 * - cabeçalho fixo: título à esquerda; à direita ação primária + fechar (X)
 * - conteúdo com rolagem interna
 */
export interface SidePanelProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSave?: () => void;
  saveLabel?: string;
  saving?: boolean;
  children: React.ReactNode;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  open,
  title,
  subtitle,
  onClose,
  onSave,
  saveLabel = 'Salvar',
  saving = false,
  children,
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy/50 backdrop-blur-sm">
      {/* Backdrop clicável (fecha) */}
      <div className="flex-1 hidden md:block" onClick={onClose} />

      <div className="bg-bg w-full md:w-[45%] md:min-w-[520px] max-w-2xl h-full shadow-pop flex flex-col">
        {/* Cabeçalho fixo */}
        <div className="flex items-center justify-between px-6 py-4 bg-surface border-b border-border shrink-0">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold text-fg uppercase tracking-wide truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[11px] text-fg-muted font-semibold uppercase tracking-wider truncate">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <span className={`material-symbols-outlined text-base ${saving ? 'animate-spin' : ''}`}>
                  {saving ? 'progress_activity' : 'save'}
                </span>
                {saving ? 'Salvando...' : saveLabel}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Conteúdo com rolagem interna */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">{children}</div>
      </div>
    </div>
  );
};

/** Bloco/card interno do Drawer, com ícone + título sutil e ação opcional à direita. */
export const FormSection: React.FC<{
  icon: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon, title, action, children }) => (
  <div className="bg-surface rounded-xl border border-border shadow-soft p-5">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg bg-primary-soft text-primary flex items-center justify-center">
          <span className="material-symbols-outlined text-lg">{icon}</span>
        </span>
        <h4 className="font-display text-sm font-bold uppercase tracking-wide text-primary">{title}</h4>
      </div>
      {action}
    </div>
    {children}
  </div>
);

/** Switch/Toggle moderno. */
export const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}> = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-2 cursor-pointer select-none">
    {label && <span className="text-[10px] font-semibold uppercase text-fg-secondary">{label}</span>}
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-primary' : 'bg-border-strong'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  </label>
);
