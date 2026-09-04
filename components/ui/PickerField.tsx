'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useIsMobile } from '@/lib/useIsMobile';

/* ===================================================================
 * Picker GENÉRICO (mobile bottom-sheet + desktop popover), com busca. Não
 * conhece "responsável", "funcionário" nem qualquer domínio: só recebe opções
 * {id,name} e textos configuráveis. Usado pelo EquipmentIdentifier (catálogo)
 * para que fabricante/modelo NUNCA reusem linguagem de responsável/funcionário.
 * =================================================================== */

export interface PickerOption { id: string; name: string; }

interface Props {
  value: string;
  onChange: (id: string) => void;
  options: PickerOption[];
  sheetTitle: string;
  placeholder?: string;      // texto do gatilho quando nada selecionado
  searchPlaceholder?: string;
  emptyLabel?: string;       // estado vazio (ex.: "Nenhum fabricante encontrado.")
  disabled?: boolean;
  triggerClassName?: string;
  ariaLabel?: string;
}

export const PickerField: React.FC<Props> = ({
  value, onChange, options, sheetTitle,
  placeholder = 'Selecionar', searchPlaceholder = 'Buscar...', emptyLabel = 'Nenhum resultado encontrado.',
  disabled = false, triggerClassName = '', ariaLabel,
}) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.id === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  useEffect(() => { if (open) { setQuery(''); setTimeout(() => searchRef.current?.focus(), 50); } }, [open]);

  const pick = (id: string) => { onChange(id); setOpen(false); };

  const Row = ({ id, label }: { id: string; label: string }) => {
    const active = id === value;
    return (
      <button type="button" onClick={() => pick(id)} className={`w-full flex items-center gap-3 px-3 min-h-[48px] text-left text-sm transition-colors ${active ? 'bg-primary-soft/50 text-primary font-bold' : 'text-fg hover:bg-surface-2'}`}>
        <span className={`material-symbols-outlined text-xl ${active ? 'text-primary' : 'text-fg-muted'}`}>{active ? 'radio_button_checked' : 'radio_button_unchecked'}</span>
        <span className="truncate">{label}</span>
      </button>
    );
  };

  const list = (
    <div className="flex flex-col">
      {options.length > 6 && (
        <div className="p-2 border-b border-border sticky top-0 bg-surface">
          <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25" />
        </div>
      )}
      <div className="overflow-y-auto max-h-[50vh] divide-y divide-border">
        {filtered.map((o) => <Row key={o.id} id={o.id} label={o.name} />)}
        {filtered.length === 0 && <p className="px-3 py-4 text-center text-[12px] text-fg-muted">{emptyLabel}</p>}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className="relative">
      <button type="button" aria-label={ariaLabel || sheetTitle} aria-haspopup="listbox" aria-expanded={open} disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={triggerClassName || 'w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-fg-secondary disabled:opacity-60'}>
        <span className={`truncate ${selected ? '' : 'text-fg-muted'}`}>{selected ? selected.name : placeholder}</span>
        <span className="material-symbols-outlined text-lg shrink-0">expand_more</span>
      </button>

      {open && !isMobile && (
        <div className="absolute z-50 mt-1 w-full min-w-[220px] rounded-xl border border-border bg-surface shadow-pop overflow-hidden">{list}</div>
      )}
      {open && isMobile && (
        <div className="fixed inset-0 z-[95] flex items-end bg-slate-900/50 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="w-full rounded-t-2xl bg-surface shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-xs font-bold uppercase tracking-wide text-fg-secondary">{sheetTitle}</p>
              <button type="button" onClick={() => setOpen(false)} className="text-fg-muted hover:text-fg-secondary text-2xl leading-none">×</button>
            </div>
            {list}
          </div>
        </div>
      )}
    </div>
  );
};
