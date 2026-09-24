'use client';
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Client } from '@/lib/types';
import { useIsMobile } from '@/lib/useIsMobile';
import {
  CLIENT_SEARCH_MODES, ClientSearchMode, clientCnpjLabel, clientDisplayName, clientLegalName, filterClients,
} from '@/lib/clientSelection';

/* ===================================================================
 * Seletor canônico de CLIENTE (mesmo padrão do PickerField: popover no
 * desktop, bottom-sheet no mobile). Lê a lista canônica recebida do pai e
 * devolve só o id — não cria base paralela nem altera o cadastro.
 * =================================================================== */

interface Props {
  clients: Client[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  placeholder?: string;
  onCreate?: () => void;
  /** Mostra os chips Todos | Nome fantasia | Razão social | CNPJ. */
  showModeFilter?: boolean;
  createLabel?: string;
}

export function ClientSelector({
  clients, value, onChange, label = 'Cliente', placeholder = 'Pesquisar cliente', onCreate,
  showModeFilter = false, createLabel = '+ Cadastrar novo cliente',
}: Props) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<ClientSearchMode>('todos');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const uid = useId();

  const selected = clients.find((c) => c.id === value);
  const filtered = useMemo(() => filterClients(clients, query, mode), [clients, query, mode]);

  const close = () => { setOpen(false); setQuery(''); };
  const pick = (id: string) => { onChange(id); close(); };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) close(); };
    document.addEventListener('mousedown', onDown);
    const t = setTimeout(() => searchRef.current?.focus(), 50);
    return () => { document.removeEventListener('mousedown', onDown); clearTimeout(t); };
  }, [open]);
  useEffect(() => { setActive(0); }, [query, mode]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[active]) pick(filtered[active].id); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  };

  const panel = (
    <div className="flex flex-col min-h-0">
      <div className="border-b border-border p-2 space-y-2">
        <input
          ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onSearchKey}
          placeholder={placeholder} aria-label={placeholder}
          role="combobox" aria-expanded aria-controls={`${uid}-list`}
          aria-activedescendant={filtered[active] ? `${uid}-opt-${filtered[active].id}` : undefined}
          className="min-h-11 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-primary/25"
        />
        {showModeFilter && (
          <div className="flex flex-wrap gap-1.5">
            {CLIENT_SEARCH_MODES.map((m) => (
              <button key={m.id} type="button" onClick={() => { setMode(m.id); searchRef.current?.focus(); }}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${mode === m.id ? 'bg-navy-3 text-white border-navy' : 'bg-surface text-fg-secondary border-border-strong hover:border-navy'}`}>
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div ref={listRef} id={`${uid}-list`} role="listbox" className="max-h-72 overflow-y-auto p-1 min-h-0 flex-1">
        {filtered.map((c, idx) => {
          const fantasy = clientDisplayName(c);
          const legal = clientLegalName(c.name);
          const isSel = c.id === value;
          return (
            <button
              type="button" key={c.id} id={`${uid}-opt-${c.id}`} data-idx={idx} role="option" aria-selected={isSel}
              onClick={() => pick(c.id)} onMouseEnter={() => setActive(idx)}
              className={`w-full rounded-lg px-3 py-2.5 text-left ${idx === active ? 'bg-surface-2' : ''} ${isSel ? 'ring-1 ring-primary/40' : ''}`}
            >
              <p className="break-words text-sm font-bold uppercase text-fg">{fantasy}</p>
              {legal && legal !== fantasy && <p className="break-words text-[11px] text-fg-secondary">{legal}</p>}
              <p className="font-data-mono text-[11px] text-fg-muted">{clientCnpjLabel(c.cnpj)}</p>
            </button>
          );
        })}
        {filtered.length === 0 && <p className="p-4 text-center text-sm text-fg-muted">Nenhum cliente encontrado.</p>}
      </div>
      {onCreate && (
        <button type="button" onClick={() => { close(); onCreate(); }} className="min-h-12 w-full border-t border-border px-3 text-left text-sm font-bold text-primary">
          {createLabel}
        </button>
      )}
    </div>
  );

  return (
    <div ref={rootRef} className="relative">
      {label && <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-fg-secondary">{label}</label>}
      <button
        type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}
        className="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border border-border-strong bg-surface px-3 py-1.5 text-left text-sm"
      >
        {selected ? (
          <span className="min-w-0">
            <span className="block truncate font-semibold text-fg">{clientDisplayName(selected)}</span>
            <span className="block truncate text-[11px] text-fg-muted">
              {[clientLegalName(selected.name) !== clientDisplayName(selected) ? clientLegalName(selected.name) : '', clientCnpjLabel(selected.cnpj)].filter(Boolean).join(' · ')}
            </span>
          </span>
        ) : (
          <span className="text-fg-muted">Selecione o cliente</span>
        )}
        <span className="material-symbols-outlined shrink-0 text-fg-muted">expand_more</span>
      </button>
      {open && !isMobile && (
        <div className="absolute z-[100] mt-1 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-xl">{panel}</div>
      )}
      {open && isMobile && (
        <div className="fixed inset-0 z-[100] flex items-end bg-slate-900/50 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="flex max-h-[85vh] w-full flex-col rounded-t-2xl bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-fg-secondary">{label || 'Cliente'}</p>
              <button type="button" onClick={close} aria-label="Fechar" className="text-2xl leading-none text-fg-muted hover:text-fg-secondary">×</button>
            </div>
            {panel}
          </div>
        </div>
      )}
    </div>
  );
}
