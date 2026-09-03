import React from 'react';

/**
 * DataListRow — linha horizontal reutilizável para substituir tabelas.
 *
 * Estrutura (Flexbox), responsiva:
 *  - Esquerda: leading (ícone/foto opcional) + título em destaque + metadados
 *  - Centro (opcional): informações extras, discretas
 *  - Direita: valores/status (Badges) + ícones de ação (RowAction)
 *
 * Exemplo:
 *   <DataListRow
 *     leading={<Avatar .../>}
 *     title="Catuaí Shopping Londrina"
 *     meta={<><RowMeta label="CNPJ" value="12.345..." /><RowMeta label="Cidade" value="Londrina" /></>}
 *     center={<span>Última OS: 24/05</span>}
 *     right={<><Badge color="emerald">Ativo</Badge><RowAction icon="edit" label="Editar" onClick={...} /></>}
 *   />
 */

export interface DataListRowProps {
  leading?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export const DataListRow: React.FC<DataListRowProps> = ({
  leading,
  title,
  meta,
  center,
  right,
  onClick,
  className = '',
}) => {
  const clickable = typeof onClick === 'function';
  return (
    <div
      onClick={onClick}
      className={`bg-surface rounded-xl shadow-soft border border-border p-4 flex flex-col md:flex-row md:items-center gap-4 transition-all hover:shadow-card hover:border-border-strong ${
        clickable ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {/* Esquerda: leading + título + metadados */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {leading}
        <div className="min-w-0">
          <div className="font-semibold text-fg text-sm truncate">{title}</div>
          {meta && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-fg-secondary">
              {meta}
            </div>
          )}
        </div>
      </div>

      {/* Centro (opcional): informação extra discreta */}
      {center && (
        <div className="text-[11px] text-fg-secondary md:text-center md:px-4 shrink-0">{center}</div>
      )}

      {/* Direita: valores/status + ações */}
      {right && (
        <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">{right}</div>
      )}
    </div>
  );
};

/** Metadado no formato "Rótulo: valor" para a área de metadados. */
export const RowMeta: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <span className="whitespace-nowrap">
    <span className="text-fg-muted">{label}:</span>{' '}
    <span className="text-fg-secondary font-semibold">{value}</span>
  </span>
);

type BadgeColor = 'slate' | 'blue' | 'emerald' | 'green' | 'red' | 'amber' | 'brand';

// Classes literais (o Tailwind não detecta classes montadas dinamicamente)
const BADGE_SOLID: Record<BadgeColor, string> = {
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-blue-50 text-blue-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-50 text-red-700',
  amber: 'bg-amber-50 text-amber-700',
  brand: 'bg-primary-soft text-primary',
};

const BADGE_OUTLINE: Record<BadgeColor, string> = {
  slate: 'border border-slate-300 text-slate-600',
  blue: 'border border-blue-400 text-blue-700',
  emerald: 'border border-emerald-500 text-emerald-700',
  green: 'border border-emerald-500 text-emerald-700',
  red: 'border border-danger text-danger',
  amber: 'border border-amber-500 text-amber-700',
  brand: 'border border-primary/30 text-primary',
};

/** Etiqueta de status colorida (sólida suave ou vazada). */
export const Badge: React.FC<{ color?: BadgeColor; outline?: boolean; children: React.ReactNode }> = ({
  color = 'slate',
  outline = false,
  children,
}) => (
  <span
    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${
      outline ? BADGE_OUTLINE[color] : BADGE_SOLID[color]
    }`}
  >
    {children}
  </span>
);

/** Ícone de ação minimalista (cinza → cor no hover). */
export const RowAction: React.FC<{
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}> = ({ icon, label, onClick, danger = false }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    title={label}
    aria-label={label}
    className={`w-8 h-8 rounded-lg flex items-center justify-center text-fg-muted transition-colors ${
      danger ? 'hover:text-danger hover:bg-danger-soft' : 'hover:text-primary hover:bg-surface-3'
    }`}
  >
    <span className="material-symbols-outlined text-lg">{icon}</span>
  </button>
);
