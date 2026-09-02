'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { groupCommercialUnits, normalizeUnitCode, searchCommercialUnits } from '@/lib/commercialUnits';

interface UnitSelectorProps {
  value: string;
  onChange: (code: string) => void;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

export function UnitSelector({ value, onChange, className = '', disabled, 'aria-label': ariaLabel = 'Selecionar unidade de medida' }: UnitSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const titleId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const code = normalizeUnitCode(value);
  const groups = groupCommercialUnits(searchCommercialUnits(query));

  const close = () => {
    setOpen(false);
    setQuery('');
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return <>
    <button ref={triggerRef} type="button" disabled={disabled} aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} className={`flex min-h-[42px] w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20 disabled:opacity-60 ${className}`}>
      <span className="font-data-mono font-semibold">{code}</span><ChevronDown className="h-4 w-4 text-slate-400" />
    </button>
    {open && <div className="fixed inset-0 z-[120] flex items-end justify-center bg-[#101036]/65 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[min(680px,88vh)] sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Tipo de unidade</p><h2 id={titleId} className="mt-0.5 text-base font-bold text-[#1A1A72]">Unidade de medida</h2></div><button type="button" onClick={close} aria-label="Fechar seletor" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
        <div className="border-b border-slate-100 p-4 sm:px-5"><label className="relative block"><span className="sr-only">Buscar unidade</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar unidade..." className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-[#1A1A72] focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/15" /></label></div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 sm:px-4">
          {groups.map((group) => <section key={group.category} className="py-2"><h3 className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{group.label}</h3><div className="grid grid-cols-1 gap-1 sm:grid-cols-2">{group.units.map((unit) => { const selected = unit.code === code; return <button key={unit.code} type="button" aria-pressed={selected} onClick={() => { onChange(unit.code); close(); }} className={`flex min-h-12 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${selected ? 'bg-[#1A1A72] text-white' : 'text-slate-700 hover:bg-slate-100'}`}><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-white/70' : 'border-slate-300'}`}>{selected && <Check className="h-3.5 w-3.5" />}</span><span className="min-w-0 flex-1"><span className="font-semibold">{unit.label}</span> <span className={selected ? 'text-white/75' : 'text-slate-400'}>({unit.code})</span></span></button>; })}</div></section>)}
          {groups.length === 0 && <p className="px-3 py-10 text-center text-sm text-slate-500">Nenhuma unidade encontrada.</p>}
        </div>
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-right sm:px-5" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}><button type="button" onClick={close} className="min-h-10 rounded-lg px-4 text-xs font-bold uppercase text-slate-600 hover:bg-slate-200">Cancelar</button></div>
      </div>
    </div>}
  </>;
}
