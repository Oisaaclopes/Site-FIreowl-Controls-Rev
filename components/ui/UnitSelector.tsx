'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';
import {
  groupCommercialUnits, normalizeUnitCode, searchCommercialUnits,
  hydrateCustomUnits, registerCustomUnit, persistCustomUnits, validateCustomUnit,
} from '@/lib/commercialUnits';

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
  const [creating, setCreating] = useState(false);
  const [cName, setCName] = useState('');
  const [cSigla, setCSigla] = useState('');
  const [cDecimals, setCDecimals] = useState(false);
  const [cErr, setCErr] = useState('');
  const [cSuggestion, setCSuggestion] = useState('');
  const titleId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const code = normalizeUnitCode(value);
  // Hidrata personalizadas do navegador uma vez (no-op fora do browser).
  useEffect(() => { hydrateCustomUnits(); }, []);
  const groups = groupCommercialUnits(searchCommercialUnits(query));

  const close = () => {
    setOpen(false);
    setQuery('');
    setCreating(false);
    setCErr(''); setCSuggestion(''); setCName(''); setCSigla(''); setCDecimals(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const pick = (c: string) => { onChange(c); close(); };

  const startCreate = () => { setCreating(true); setCErr(''); setCSuggestion(''); requestAnimationFrame(() => nameRef.current?.focus()); };
  const submitCreate = () => {
    const res = validateCustomUnit(cName, cSigla);
    if (!res.ok) { setCErr(res.error || 'Dados inválidos.'); setCSuggestion(res.canonicalSuggestion || ''); return; }
    registerCustomUnit({ code: res.code!, label: res.label!, allowDecimals: cDecimals });
    persistCustomUnits();
    pick(res.code!);
  };

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { if (creating) setCreating(false); else close(); } };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, creating]);

  return <>
    <button ref={triggerRef} type="button" disabled={disabled} aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} className={`flex min-h-[42px] w-full items-center justify-between rounded-lg border border-border-strong bg-surface px-3 py-2 text-left text-sm text-fg focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 ${className}`}>
      <span className="font-data-mono font-semibold">{code}</span><ChevronDown className="h-4 w-4 text-fg-muted" />
    </button>
    {open && <div className="fixed inset-0 z-[120] flex items-end justify-center bg-[#101036]/65 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl sm:max-h-[min(680px,88vh)] sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-muted">{creating ? 'Nova unidade' : 'Tipo de unidade'}</p><h2 id={titleId} className="mt-0.5 text-base font-bold text-primary">{creating ? 'Unidade personalizada' : 'Unidade de medida'}</h2></div><button type="button" onClick={close} aria-label="Fechar seletor" className="flex h-10 w-10 items-center justify-center rounded-lg text-fg-secondary hover:bg-surface-3"><X className="h-5 w-5" /></button></div>

        {creating ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:px-5">
            <div className="space-y-3">
              <label className="block"><span className="text-[11px] font-bold uppercase tracking-wide text-fg-secondary">Nome</span>
                <input ref={nameRef} value={cName} onChange={(e) => { setCName(e.target.value); setCErr(''); }} placeholder="Ex.: Ponto" className="mt-1 w-full rounded-lg border border-border-strong px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15" /></label>
              <label className="block"><span className="text-[11px] font-bold uppercase tracking-wide text-fg-secondary">Sigla</span>
                <input value={cSigla} onChange={(e) => { setCSigla(e.target.value); setCErr(''); }} placeholder="Ex.: pt" maxLength={8} className="mt-1 w-full rounded-lg border border-border-strong px-3 py-2.5 text-sm font-data-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15" /></label>
              <label className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-2 px-3 py-2.5 cursor-pointer">
                <input type="checkbox" checked={cDecimals} onChange={(e) => setCDecimals(e.target.checked)} className="h-4 w-4 accent-[#1A1A72]" />
                <span className="text-sm text-fg-secondary">Permite quantidade decimal (ex.: 2,5)</span>
              </label>
              {cErr && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                {cErr}
                {cSuggestion && <button type="button" onClick={() => pick(cSuggestion)} className="ml-1 font-bold underline">Usar {cSuggestion}</button>}
              </div>}
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setCreating(false)} className="min-h-10 rounded-lg px-4 text-xs font-bold uppercase text-fg-secondary hover:bg-surface-3">Voltar</button>
              <button type="button" onClick={submitCreate} className="min-h-10 rounded-lg bg-navy px-5 text-xs font-bold uppercase text-white hover:bg-navy-3">Criar e usar</button>
            </div>
          </div>
        ) : <>
          <div className="border-b border-border p-4 sm:px-5"><label className="relative block"><span className="sr-only">Buscar unidade</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar unidade..." className="w-full rounded-lg border border-border-strong py-2.5 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15" /></label></div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 sm:px-4">
            {groups.map((group) => <section key={group.category} className="py-2"><h3 className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-fg-muted">{group.label}</h3><div className="grid grid-cols-1 gap-1 sm:grid-cols-2">{group.units.map((unit) => { const selected = unit.code === code; return <button key={unit.code} type="button" aria-pressed={selected} onClick={() => pick(unit.code)} className={`flex min-h-12 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${selected ? 'bg-navy text-white' : 'text-fg-secondary hover:bg-surface-3'}`}><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-white/70' : 'border-border-strong'}`}>{selected && <Check className="h-3.5 w-3.5" />}</span><span className="min-w-0 flex-1"><span className="font-semibold">{unit.label}</span> <span className={selected ? 'text-white/75' : 'text-fg-muted'}>({unit.code})</span></span></button>; })}</div></section>)}
            {groups.length === 0 && <p className="px-3 py-8 text-center text-sm text-fg-secondary">Nenhuma unidade encontrada.</p>}
          </div>
          <div className="flex items-center justify-between border-t border-border bg-surface-2 px-4 py-3 sm:px-5" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <button type="button" onClick={startCreate} className="flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-bold uppercase text-primary hover:bg-surface-3"><Plus className="h-4 w-4" /> Criar unidade</button>
            <button type="button" onClick={close} className="min-h-10 rounded-lg px-4 text-xs font-bold uppercase text-fg-secondary hover:bg-surface-3">Cancelar</button>
          </div>
        </>}
      </div>
    </div>}
  </>;
}
