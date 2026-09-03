'use client';
import React, { useMemo, useState } from 'react';
import type { Client } from '@/lib/types';
import { clientDisplayName, clientLegalName, filterClients } from '@/lib/clientSelection';

interface Props { clients: Client[]; value: string; onChange: (id:string)=>void; label?:string; placeholder?:string; onCreate?:()=>void; }
export function ClientSelector({clients,value,onChange,label='Cliente',placeholder='Pesquisar cliente',onCreate}:Props){
  const [open,setOpen]=useState(false),[query,setQuery]=useState('');
  const selected=clients.find(c=>c.id===value), filtered=useMemo(()=>filterClients(clients,query),[clients,query]);
  return <div className="relative">
    {label&&<label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-fg-secondary">{label}</label>}
    <button type="button" onClick={()=>setOpen(v=>!v)} className="flex min-h-12 w-full items-center justify-between rounded-xl border border-border-strong bg-surface px-3 text-left text-sm">
      <span className={selected?'font-semibold text-fg':'text-fg-muted'}>{selected?clientDisplayName(selected):'Selecione o cliente'}</span><span className="material-symbols-outlined text-fg-muted">expand_more</span>
    </button>
    {open&&<div className="absolute z-[100] mt-1 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
      <div className="border-b border-border p-2"><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder={placeholder} className="min-h-11 w-full rounded-lg border border-border-strong px-3 text-sm"/></div>
      <div className="max-h-64 overflow-y-auto p-1">{filtered.map(c=>{const legal=clientLegalName(c.name),fantasy=clientDisplayName(c);return <button type="button" key={c.id} onClick={()=>{onChange(c.id);setOpen(false);setQuery('')}} className="w-full rounded-lg px-3 py-2.5 text-left hover:bg-surface-2"><p className="truncate text-sm font-bold text-fg">{fantasy}</p>{legal&&legal!==fantasy&&<p className="truncate text-[11px] text-fg-muted">{legal}</p>}</button>})}{filtered.length===0&&<p className="p-4 text-center text-sm text-fg-muted">Nenhum cliente encontrado.</p>}</div>
      {onCreate&&<button type="button" onClick={()=>{setOpen(false);onCreate()}} className="min-h-12 w-full border-t border-border px-3 text-left text-sm font-bold text-primary">+ Cadastrar novo cliente</button>}
    </div>}
  </div>;
}
